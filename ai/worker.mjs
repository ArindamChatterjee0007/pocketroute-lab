import { performance } from "node:perf_hooks";
import { pipeline, env } from "@huggingface/transformers";
import { modelCandidates, systemPrompt, inferencePolicy } from "./config.mjs";
import { examples } from "./examples.mjs";
import { validateServiceRequest, parseServiceLabel, requestTokenLimit } from "./contract.mjs";
import { join } from "node:path";

let generator;
let candidate;
let active = false;
let networkAttempts = 0;
const blockNetwork = async () => { networkAttempts += 1; throw new Error("NETWORK_DISABLED_DURING_INFERENCE"); };
const messagesFor = input => [
  { role: "system", content: systemPrompt },
  ...examples.flatMap(example => [{ role: "user", content: JSON.stringify({ request: example.input }) }, { role: "assistant", content: example.expected }]),
  { role: "user", content: JSON.stringify({ request: input }) },
];

process.on("message", async message => {
  if (!Number.isSafeInteger(message?.id)) return;
  if (active) { process.send?.({ id: message.id, error: "MODEL_BUSY" }); return; }
  active = true;
  try {
    if (message.kind === "initialize") {
      if (generator) throw new Error("ALREADY_INITIALIZED");
      candidate = modelCandidates.find(value => value.key === message.model);
      if (!candidate || typeof message.cacheDir !== "string") throw new Error("INVALID_MODEL_CONFIGURATION");
      env.cacheDir = message.cacheDir;
      env.allowLocalModels = message.allowDownload !== true;
      env.localModelPath = join(message.cacheDir, "__unversioned_local_models_disabled__");
      env.allowRemoteModels = message.allowDownload === true;
      if (!message.allowDownload) { globalThis.fetch = blockNetwork; env.fetch = blockNetwork; }
      const started = performance.now();
      generator = await pipeline("text-generation", candidate.id, { revision: candidate.revision, local_files_only: message.allowDownload !== true, dtype: candidate.dtype, device: "cpu", session_options: { intraOpNumThreads: inferencePolicy.intraOpThreads, interOpNumThreads: inferencePolicy.interOpThreads } });
      env.allowRemoteModels = false;
      globalThis.fetch = blockNetwork;
      env.fetch = blockNetwork;
      process.send?.({ id: message.id, result: { model: candidate.id, revision: candidate.revision, dtype: candidate.dtype, loadMs: Math.round(performance.now() - started), inferenceNetworkDisabled: true, networkAttemptsDuringLoad: networkAttempts, runtime: `@huggingface/transformers ${env.version}`, node: process.version } });
    } else if (message.kind === "classify") {
      if (!generator) throw new Error("MODEL_NOT_INITIALIZED");
      const input = validateServiceRequest(message.input);
      const tokens = generator.tokenizer.encode(input, { add_special_tokens: false });
      if (tokens.length > requestTokenLimit) throw new Error("REQUEST_TOKEN_LIMIT");
      const messages = messagesFor(input);
      const prompt = generator.tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
      const promptTokens = generator.tokenizer.encode(prompt, { add_special_tokens: false }).length;
      if (promptTokens > inferencePolicy.maxPromptTokens) throw new Error("PROMPT_TOKEN_LIMIT");
      const started = performance.now();
      const response = await generator(messages, { max_new_tokens: inferencePolicy.maxNewTokens, do_sample: false });
      const generated = response[0]?.generated_text;
      const output = Array.isArray(generated) ? String(generated.at(-1)?.content || "") : "";
      const parsed = parseServiceLabel(output);
      const status = parsed && parsed !== "review" ? "suggested" : "review-required";
      process.send?.({ id: message.id, result: { schemaVersion: 1, status, label: status === "suggested" ? parsed : null, rawLabel: parsed, output: output.slice(0, 500), modelExecuted: true, model: candidate.id, modelRevision: candidate.revision, requiresHumanReview: true, confidenceCalibrated: false, confidence: null, requestTokens: tokens.length, promptTokens, elapsedMs: Math.round(performance.now() - started), processPeakRssBytes: process.resourceUsage().maxRSS * 1024, networkAttemptsDuringInference: networkAttempts, phoneEnergyJoules: null } });
    } else throw new Error("UNSUPPORTED_WORKER_OPERATION");
  } catch (error) {
    const controlled = /^(MODEL_|INVALID_|ALREADY_|REQUEST_|PROMPT_|NETWORK_|UNSUPPORTED_)/.test(error.message || "");
    const detail = message.kind === "initialize" ? `${error.name}: ${String(error.message).replace(/https?:\/\/\S+/g, "[remote resource]").slice(0, 180)}` : error.name;
    process.send?.({ id: message.id, error: controlled ? error.message : `${message.kind === "initialize" ? "MODEL_LOAD_FAILED" : "MODEL_INFERENCE_FAILED"}: ${detail}` });
  } finally { active = false; }
});

process.on("disconnect", () => process.exit(0));