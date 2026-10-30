import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { createRequire } from "node:module";
import { cpus } from "node:os";
import assert from "node:assert/strict";
import { confirmation as exposedConfirmation } from "../ai/dataset.mjs";
import { examples } from "../ai/examples.mjs";
import { modelCandidates, systemPrompt, inferencePolicy, evaluationRevision, evaluationCandidateKeys } from "../ai/config.mjs";
import { createServiceClassifier } from "../ai/client.mjs";
import { summarizeClassification, pilotGate } from "../ai/contract.mjs";
import { analyzeNote } from "../app/note-core.mjs";
import { entailmentPolicy, serviceHypotheses } from "../ai/entailment.mjs";
import { reusableDevelopment } from "../ai/evaluation-replay.mjs";

const startedAt = new Date().toISOString();
const deadline = Date.now() + 20 * 60 * 1000;
const cacheDir = join(process.env.RUNNER_TEMP, "pocketroute-service-models");
const hash = value => createHash("sha256").update(value).digest("hex");
const confirmationBytes = await readFile("ai/confirmation-v2.json");
const confirmationSource = JSON.parse(confirmationBytes);
const confirmation = confirmationSource.cases.map(({ id, family, expected, input }) => ({ id, family, expected, input }));
const development = exposedConfirmation.map(entry => ({ ...entry, id: `regression-${entry.id}` }));
const datasetVersion = confirmationSource.datasetId;
const datasetNotice = confirmationSource.provenance;
assert.equal(confirmation.length, 96);
assert.equal(development.length, 48);
assert.equal(new Set(confirmation.map(entry => entry.id)).size, 96);
assert.equal(new Set(confirmation.map(entry => entry.family)).size, 96);
assert.equal(new Set(confirmation.map(entry => entry.input.trim().toLowerCase())).size, 96);
const knownInputs = new Set([...examples, ...development].map(entry => entry.input.trim().toLowerCase()));
assert.ok(confirmation.every(entry => !knownInputs.has(entry.input.trim().toLowerCase())));
for (const label of ["maintenance", "delivery", "inspection", "review"]) assert.equal(confirmation.filter(entry => entry.expected === label).length, 24);
const require = createRequire(import.meta.url);
async function installedVersion(name) {
  let directory = dirname(require.resolve(name));
  for (let depth = 0; depth < 8; depth += 1) {
    try { const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8")); if (metadata.name === name) return metadata.version; } catch {}
    directory = dirname(directory);
  }
  throw new Error(`Unable to record installed runtime version for ${name}.`);
}
const runtimeVersions = { node: process.version, transformers: await installedVersion("@huggingface/transformers"), onnxruntimeNode: await installedVersion("onnxruntime-node") };
assert.equal(`@huggingface/transformers ${runtimeVersions.transformers}`, inferencePolicy.runtime);
const implementationSha256 = hash((await Promise.all(["ai/worker.mjs", "ai/client.mjs", "ai/contract.mjs", "ai/labels.mjs", "ai/logits.mjs", "ai/entailment.mjs", "ai/review-policy.mjs"].map(path => readFile(path, "utf8")))).join("\n"));
const protocolSha256 = hash(JSON.stringify({ evaluationRevision, evaluationCandidateKeys, modelCandidates, systemPrompt, inferencePolicy, examples, implementationSha256, runtimeVersions: { transformers: runtimeVersions.transformers, onnxruntimeNode: runtimeVersions.onnxruntimeNode } }));
const result = {
  schemaVersion: 1,
  id: `service-v2-${process.env.GITHUB_RUN_ID}`,
  status: "running",
  startedAt,
  sourceSha: process.env.GITHUB_SHA,
  runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  environment: { runner: "GitHub-hosted Linux", cpu: cpus()[0]?.model, runtimeVersions },
  dataset: { version: datasetVersion, notice: datasetNotice, examples: examples.length, development: development.length, confirmation: confirmation.length, sha256: hash(JSON.stringify({ examples, development, confirmation })), sourceSha256: hash(confirmationBytes), developmentScope: "Previously exposed v1 confirmation cases, now regression/development data only.", confirmationScope: "Fresh 96-case separate-agent-authored synthetic set; not human-labelled or customer data." },
  protocol: { revision: evaluationRevision, candidateOrder: evaluationCandidateKeys, selection: "Revision 7 returns to revision 3's fixed Qwen prompt/letter decoder and adds a deterministic reject-only policy for explicit manipulation, secret requests, unsupported content generation and weather queries. This measures a HYBRID SYSTEM, not pure-model accuracy. Policy rules never assign a supported category. Both NLI alternatives and the category-word failure remain archived. The same exposed 48 cases are a regression gate. Only after >90% regression accuracy, >=95% accepted precision, >=80% coverage and zero unsafe acceptances may the unchanged fresh balanced 96-case confirmation set run. No policy or threshold tuning after confirmation.", sha256: protocolSha256, implementationSha256, systemPromptSha256: hash(systemPrompt), policy: inferencePolicy, entailmentPolicy, serviceHypotheses, modelUsesPromptExamples: true, systemKind: "model-plus-deterministic-review-policy", accuracyTarget: ">90%", testSetUsedForSelection: false, confirmationUse: "not-started" },
  candidates: [],
  selected: null,
  testCases: [],
  pilotScreen: { passed: false, reasons: ["Not evaluated"], productionReady: false },
  commercialReadiness: { ready: false, blockers: ["Synthetic cases are not independent customer validation.", "Physical mobile-device, memory and energy acceptance remains unperformed.", "ONNX conversion repositories do not declare separate license metadata; no weight redistribution or blanket commercial clearance is claimed."] },
  newFoundationModelTrained: false,
  fineTuned: false,
  phoneValidated: false,
  phoneEnergyJoules: null,
};
const engines = new Set();
const timeLeft = () => { const remaining = deadline - Date.now(); if (remaining < 1000) throw new Error("Evaluation budget exhausted."); return remaining; };
const qualifiedDevelopment = metrics => metrics.total === development.length && metrics.accuracy > 0.9 && metrics.acceptedPrecision >= 0.95 && metrics.supportedCoverage >= 0.8 && metrics.unsafeAcceptances === 0;
const rank = entry => [entry.metrics.unsafeAcceptances === 0 ? 1 : 0, entry.metrics.acceptedPrecision ?? 0, entry.metrics.accuracy, entry.metrics.supportedCoverage ?? 0];
function best(first, second) {
  if (!first) return second;
  const firstRank = rank(first);
  const secondRank = rank(second);
  for (let index = 0; index < firstRank.length; index += 1) if (firstRank[index] !== secondRank[index]) return firstRank[index] > secondRank[index] ? first : second;
  return first;
}
async function modelMetadata(candidate) {
  const baseResponse = await fetch(`https://huggingface.co/api/models/${candidate.baseId}/revision/${candidate.baseRevision}`, { signal: AbortSignal.timeout(30000) });
  const convertedResponse = await fetch(`https://huggingface.co/api/models/${candidate.id}/revision/${candidate.revision}`, { signal: AbortSignal.timeout(30000) });
  if (!baseResponse.ok || !convertedResponse.ok) throw new Error("Pinned model metadata unavailable.");
  const base = await baseResponse.json();
  const converted = await convertedResponse.json();
  if (base.sha !== candidate.baseRevision || base.private || base.gated || base.cardData?.license !== "apache-2.0" || converted.sha !== candidate.revision || converted.private || converted.gated || ![].concat(converted.cardData?.base_model || []).includes(candidate.baseId)) throw new Error("Pinned model identity, base license or conversion provenance did not match.");
  return { baseLicense: base.cardData.license, conversionLicenseMetadata: converted.cardData?.license || null, baseRevision: base.sha, conversionRevision: converted.sha };
}
async function open(candidate, allowDownload) {
  const engine = await createServiceClassifier({ model: candidate.key, cacheDir, allowDownload, initializationTimeoutMs: Math.min(inferencePolicy.initializationTimeoutMs, timeLeft()) });
  engines.add(engine);
  return engine;
}
async function close(engine) { await engine.close(); engines.delete(engine); }
async function evaluate(engine, records, split, cases) {
  for (const record of records) {
    const prediction = await engine.classify(record.input, { timeoutMs: Math.min(inferencePolicy.generationTimeoutMs, timeLeft()) });
    if (prediction.networkAttemptsDuringInference !== 0) throw new Error("Model attempted a network request during inference.");
    cases.push({ ...record, ...prediction, expected: record.expected });
    console.log(JSON.stringify({ split, case: record.id, expected: record.expected, predicted: prediction.rawLabel, elapsedMs: prediction.elapsedMs }));
  }
  return { cases, metrics: summarizeClassification(cases) };
}

try {
  let priorConfirmation = false;
  const interruptedRuns = [];
  const testInputs = new Set(confirmation.map(record => record.input.trim().toLowerCase()));
  const priorFiles = await readdir("data/ai-runs").catch(() => []);
  for (const filename of priorFiles.filter(name => name.endsWith(".json"))) {
    const prior = JSON.parse(await readFile(join("data/ai-runs", filename), "utf8"));
    if (prior.testCases?.some(record => testInputs.has(record.input.trim().toLowerCase()))) {
      if (prior.protocol?.sha256 !== protocolSha256 || prior.dataset?.sha256 !== result.dataset.sha256) throw new Error("Confirmation examples were previously exposed under a different protocol. Create a fresh confirmation set before further tuning.");
      priorConfirmation = true;
      interruptedRuns.push(prior);
    }
  }
  let selected;
  for (const candidate of modelCandidates.filter(value => evaluationCandidateKeys.includes(value.key))) {
    let engine;
    const report = { ...candidate, status: "loading", cases: [] };
    result.candidates.push(report);
    try {
      report.licenseEvidence = await modelMetadata(candidate);
      engine = await open(candidate, true);
      report.load = engine.metadata;
      const replay = interruptedRuns.map(previous => reusableDevelopment(previous, { protocolSha256, datasetSha256: result.dataset.sha256, runtimeVersions, candidate, records: development, confirmationCount: confirmation.length })).find(Boolean);
      if (replay) result.developmentReuse = { sourceRun: replay.sourceRun, sourceSha: replay.sourceSha, priorConfirmationCount: replay.priorConfirmationCount, reason: replay.reason };
      const evaluated = replay || await evaluate(engine, development, "development", report.cases);
      report.status = "evaluated";
      report.cases = evaluated.cases;
      report.metrics = evaluated.metrics;
      selected = best(selected, report);
      if (qualifiedDevelopment(report.metrics)) break;
    } catch (error) {
      report.status = "failed";
      report.error = String(error.message).replace(/https?:\/\/\S+/g, "[remote resource]").slice(0, 250);
    } finally { if (engine) await close(engine); }
  }
  if (!selected) throw new Error("No candidate completed the development evaluation.");
  result.selected = { key: selected.key, id: selected.id, revision: selected.revision, dtype: selected.dtype, parameters: selected.parameters, developmentQualified: qualifiedDevelopment(selected.metrics) };
  const candidate = modelCandidates.find(value => value.key === selected.key);
  const engine = await open(candidate, false);
  assert.equal(engine.metadata.networkAttemptsDuringLoad, 0);
  result.cachedLoad = { passed: true, allowDownload: false, metadata: engine.metadata };
  if (result.selected.developmentQualified) {
    result.confirmationBaseline = await evaluate(engine, [{ id: "regression-parity", input: development[0].input, expected: development[0].expected }], "cached-parity", []);
    assert.equal(result.confirmationBaseline.cases[0].rawLabel, selected.cases[0].rawLabel, "Cached model changed its regression prediction.");
    result.protocol.confirmationUse = result.developmentReuse ? "exact-protocol-reproduction-after-budget-interruption" : priorConfirmation ? "exact-protocol-reproduction" : "first-use";
    const evaluated = await evaluate(engine, confirmation, "confirmation", result.testCases);
    result.metrics = evaluated.metrics;
    result.pilotScreen = pilotGate(result.metrics);
    result.executionPaths = { scope: "Complete hybrid system; not pure-model accuracy.", modelCalls: evaluated.cases.filter(entry => entry.modelExecuted === true).length, policyReviews: evaluated.cases.filter(entry => entry.decisionPath === "policy-review").length };
    result.userAccuracyTarget = { required: ">90%", observed: result.metrics.accuracy, met: result.metrics.accuracy > 0.9, sampleType: "fresh synthetic confirmation", populationAccuracyEstablished: false };
    const ruleCases = confirmation.map(record => ({ ...record, output: ({ Maintenance: "maintenance", Delivery: "delivery", Inspection: "inspection", General: "review" })[analyzeNote(record.input).category] }));
    result.ruleBaseline = { cases: ruleCases, metrics: summarizeClassification(ruleCases), scope: "Existing keyword rules on the exact same confirmation requests." };
    const durations = evaluated.cases.map(record => record.elapsedMs).sort((first, second) => first - second);
    result.performance = { meanMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length), p50Ms: durations[Math.ceil(durations.length * 0.5) - 1], p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], processPeakRssBytes: Math.max(...evaluated.cases.map(record => record.processPeakRssBytes)), scope: "This GitHub CPU run only; not a mobile or energy measurement." };
  } else {
    result.protocol.confirmationUse = "withheld-development-gate-failed";
    result.pilotScreen = { passed: false, reasons: ["No candidate met development quality gates; confirmation cases were not executed."], productionReady: false };
  }
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(engine.classify("Inspect the routine checklist.", { signal: preAborted.signal }), /aborted/);
  assert.throws(() => engine.classify("a".repeat(2001)), /2000/);
  await assert.rejects(engine.classify(Array(600).fill("x").join(" ")), /REQUEST_TOKEN_LIMIT/);
  const abort = new AbortController();
  const stopped = engine.classify("The conveyor belt is no longer moving.", { signal: abort.signal });
  abort.abort();
  await assert.rejects(stopped, /aborted/);
  await assert.rejects(engine.classify("Inspect the routine checklist."), /closed/);
  await close(engine);
  result.runtimeChecks = { cachedModelReload: true, preAbortedRequest: true, oversizedInput: true, tokenLimit: true, cancellationStopsProcess: true, workerCloseAwaited: true, closedWorkerRejectsWork: true, runtimeFetchAttemptsDuringInference: 0, networkControlScope: "Model download disabled and both library/global JS fetch blocked after initialization; not an OS network sandbox." };
  result.artifacts = [];
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const location = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(location);
      else if (/\.(onnx|onnx_data|json|txt)$/.test(entry.name)) {
        const digest = createHash("sha256");
        let bytes = 0;
        for await (const chunk of createReadStream(location)) { digest.update(chunk); bytes += chunk.length; }
        result.artifacts.push({ path: relative(cacheDir, location), bytes, sha256: digest.digest("hex") });
      }
    }
  }
  await inventory(cacheDir);
  if (!result.artifacts.some(entry => entry.path.endsWith(".onnx"))) throw new Error("No model artifact fingerprint was recorded.");
  result.status = result.selected.developmentQualified ? "completed" : "development-only";
} catch (error) {
  result.status = "failed";
  result.error = String(error.message).replace(/https?:\/\/\S+/g, "[remote resource]").slice(0, 250);
  result.pilotScreen = { passed: false, reasons: ["Evaluation did not complete all required gates."], productionReady: false };
} finally {
  for (const engine of engines) await engine.close();
  result.completedAt = new Date().toISOString();
  result.totalElapsedMs = Date.parse(result.completedAt) - Date.parse(startedAt);
  await mkdir("data/ai-runs", { recursive: true });
  await writeFile(`data/ai-runs/${process.env.GITHUB_RUN_ID}.json`, JSON.stringify(result, null, 2));
  await writeFile("data/ai-service-results.json", JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ status: result.status, selected: result.selected, metrics: result.metrics, pilotScreen: result.pilotScreen, commercialReadiness: result.commercialReadiness, runUrl: result.runUrl }));