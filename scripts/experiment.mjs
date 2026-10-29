import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { pipeline, env } from "@huggingface/transformers";
import { parseRoute, routeRequest } from "../app/domain.mjs";

const model = "HuggingFaceTB/SmolLM2-135M-Instruct";
const revision = "12fd25f77366fa6b3b4b768ec3050bf629380bac";
const fixtures = [
  { id: "route-01", input: "Extract the site ID and visit date from this inspection note.", expected: "extract" },
  { id: "route-02", input: "Turn a visit note into structured JSON fields.", expected: "extract" },
  { id: "route-03", input: "Classify a support request into one service category.", expected: "classify" },
  { id: "route-04", input: "Assign a category label to the incoming repair request.", expected: "classify" },
  { id: "route-05", input: "Summarize the supplied shift handover in one sentence.", expected: "summarize" },
  { id: "route-06", input: "Condense the visit notes into a short summary.", expected: "summarize" },
  { id: "route-07", input: "Buy replacement equipment with my credit card.", expected: "unsupported" },
  { id: "route-08", input: "Send an email to the customer.", expected: "unsupported" },
];
const cacheDir = join(process.env.RUNNER_TEMP, "pocketroute-model-cache");
env.cacheDir = cacheDir;
env.allowLocalModels = false;
env.allowRemoteModels = true;
const startedAt = new Date().toISOString();
const started = performance.now();
const result = {
  schemaVersion: 1,
  status: "running",
  model,
  modelRevision: revision,
  modelLicense: "Apache-2.0",
  parameterCount: 134515008,
  runtime: "@huggingface/transformers 4.3.2 / ONNX Runtime CPU",
  dtype: "q8",
  environment: "GitHub-hosted Linux CPU",
  cpu: cpus()[0]?.model || "Unrecorded",
  sourceSha: process.env.GITHUB_SHA,
  runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  startedAt,
  mobileBenchmark: false,
  newModelTrained: false,
  energyJoules: null,
  datasetSha256: createHash("sha256").update(JSON.stringify(fixtures)).digest("hex"),
  datasetType: "Original synthetic development smoke fixtures; not held-out confirmation",
  generation: { maxNewTokens: 12, sampling: false, intraOpThreads: 2, interOpThreads: 1 },
  cases: [],
};
let generator;
try {
  const metadataResponse = await fetch(`https://huggingface.co/api/models/${model}/revision/${revision}`, { signal: AbortSignal.timeout(30000) });
  if (!metadataResponse.ok) throw new Error("Pinned model metadata unavailable");
  const metadata = await metadataResponse.json();
  if (metadata.sha !== revision || metadata.private || metadata.gated || metadata.cardData?.license !== "apache-2.0") throw new Error("Pinned public model identity or license mismatch");
  const loadStarted = performance.now();
  generator = await pipeline("text-generation", model, { revision, dtype: "q8", device: "cpu", session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 } });
  result.loadElapsedMs = Math.round(performance.now() - loadStarted);
  for (const fixture of fixtures) {
    const messages = [
      { role: "system", content: "You select a task route. Return exactly one lowercase label and nothing else: extract, classify, summarize, or unsupported. extract means returning structured fields from text. classify means assigning a category to text. summarize means shortening supplied text. External actions and all other tasks are unsupported." },
      { role: "user", content: "Please get the address and site code from a note." },
      { role: "assistant", content: "extract" },
      { role: "user", content: "Which service queue does a request belong to?" },
      { role: "assistant", content: "classify" },
      { role: "user", content: "Provide a brief overview of the report." },
      { role: "assistant", content: "summarize" },
      { role: "user", content: "Perform an external purchase." },
      { role: "assistant", content: "unsupported" },
      { role: "user", content: fixture.input },
    ];
    const generationStarted = performance.now();
    const output = await generator(messages, { max_new_tokens: 12, do_sample: false, repetition_penalty: 1.05 });
    const generated = output[0]?.generated_text;
    const content = Array.isArray(generated) ? generated.at(-1)?.content : typeof generated === "string" ? generated : "";
    const predicted = parseRoute(content);
    const baseline = routeRequest(fixture.input);
    const baselineRoute = baseline.status === "routed" ? baseline.task : "unsupported";
    result.cases.push({ ...fixture, output: String(content).slice(0, 1000), predicted, routeCorrect: predicted === fixture.expected, elapsedMs: Math.round(performance.now() - generationStarted), ruleBaselineRoute: baselineRoute, ruleBaselineCorrect: baselineRoute === fixture.expected });
    console.log(JSON.stringify({ case: fixture.id, expected: fixture.expected, predicted, exactMatch: predicted === fixture.expected }));
  }
  result.artifacts = [];
  async function recordArtifacts(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const location = join(directory, entry.name);
      if (entry.isDirectory()) await recordArtifacts(location);
      else if (/\.(onnx|json|txt)$/.test(entry.name)) {
        const digest = createHash("sha256");
        let bytes = 0;
        for await (const chunk of createReadStream(location)) { digest.update(chunk); bytes += chunk.length; }
        result.artifacts.push({ path: relative(cacheDir, location), bytes, sha256: digest.digest("hex") });
      }
    }
  }
  await recordArtifacts(cacheDir);
  if (!result.artifacts.some(item => item.path.endsWith(".onnx"))) throw new Error("No downloaded model artifact was fingerprinted");
  result.status = "completed";
  result.note = "Eight synthetic development route-label cases with an existing pretrained SLM. Exact-label matches are not task-completion quality, generalization, phone latency or battery evidence. No model was trained by this project.";
} catch (error) {
  result.status = "failed";
  result.errorCode = "SLM_SMOKE_FAILED";
  result.note = "The bounded cloud SLM smoke experiment did not complete. Partial cases, if present, are not a completed evaluation. No phone or energy result is claimed.";
  console.error(JSON.stringify({ stage: "slm-smoke", errorType: error.name, message: String(error.message).replace(/https?:\/\/\S+/g, "[remote resource]").slice(0, 300) }));
} finally {
  await generator?.dispose();
  result.completedAt = new Date().toISOString();
  result.totalElapsedMs = Math.round(performance.now() - started);
  result.cloudPeakRssBytes = process.resourceUsage().maxRSS * 1024;
  await mkdir("data", { recursive: true });
  await writeFile("data/slm-results.json", JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ status: result.status, cases: result.cases.length, exactMatches: result.cases.filter(item => item.routeCorrect).length, runUrl: result.runUrl, mobileBenchmark: false, energyJoules: null }));