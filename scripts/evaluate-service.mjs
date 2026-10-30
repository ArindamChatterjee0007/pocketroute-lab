import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { cpus } from "node:os";
import assert from "node:assert/strict";
import { examples, development, confirmation, datasetVersion, datasetNotice } from "../ai/dataset.mjs";
import { modelCandidates, systemPrompt, inferencePolicy } from "../ai/config.mjs";
import { createServiceClassifier } from "../ai/client.mjs";
import { summarizeClassification, pilotGate } from "../ai/contract.mjs";
import { analyzeNote } from "../app/note-core.mjs";

const startedAt = new Date().toISOString();
const deadline = Date.now() + 12 * 60 * 1000;
const cacheDir = join(process.env.RUNNER_TEMP, "pocketroute-service-models");
const hash = value => createHash("sha256").update(value).digest("hex");
const result = {
  schemaVersion: 1,
  id: `service-v1-${process.env.GITHUB_RUN_ID}`,
  status: "running",
  startedAt,
  sourceSha: process.env.GITHUB_SHA,
  runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  environment: { runner: "GitHub-hosted Linux", cpu: cpus()[0]?.model, runtime: inferencePolicy.runtime },
  dataset: { version: datasetVersion, notice: datasetNotice, examples: examples.length, development: development.length, confirmation: confirmation.length, sha256: hash(JSON.stringify({ examples, development, confirmation })), sourceSha256: hash(await readFile("ai/dataset.mjs")) },
  protocol: { candidateOrder: modelCandidates.map(candidate => candidate.key), selection: "Use the smaller model if development accuracy >=90%, accepted precision >=95%, supported coverage >=80% and zero unsafe acceptances; otherwise compare the fixed larger candidate on development only. Prefer zero unsafe acceptances, then precision, accuracy, coverage, then smaller size. Evaluate only the selected candidate on the confirmation set.", systemPromptSha256: hash(systemPrompt), policy: inferencePolicy, testSetUsedForSelection: false, promptTunedAfterConfirmation: false },
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
const qualifiedDevelopment = metrics => metrics.total === 24 && metrics.accuracy >= 0.9 && metrics.acceptedPrecision >= 0.95 && metrics.supportedCoverage >= 0.8 && metrics.unsafeAcceptances === 0;
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
  if (base.sha !== candidate.baseRevision || base.private || base.gated || base.cardData?.license !== "apache-2.0" || converted.sha !== candidate.revision || converted.private || converted.gated || converted.cardData?.base_model !== candidate.baseId) throw new Error("Pinned model identity, base license or conversion provenance did not match.");
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
  let selected;
  for (const candidate of modelCandidates) {
    let engine;
    const report = { ...candidate, status: "loading", cases: [] };
    result.candidates.push(report);
    try {
      report.licenseEvidence = await modelMetadata(candidate);
      engine = await open(candidate, true);
      report.load = engine.metadata;
      const evaluated = await evaluate(engine, development, "development", report.cases);
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
  result.cachedLoad = { passed: true, allowDownload: false, metadata: engine.metadata };
  const evaluated = await evaluate(engine, confirmation, "confirmation", result.testCases);
  result.testCases = evaluated.cases;
  result.metrics = evaluated.metrics;
  result.pilotScreen = pilotGate(result.metrics);
  const ruleCases = confirmation.map(record => ({ ...record, output: ({ Maintenance: "maintenance", Delivery: "delivery", Inspection: "inspection", General: "review" })[analyzeNote(record.input).category] }));
  result.ruleBaseline = { cases: ruleCases, metrics: summarizeClassification(ruleCases), scope: "Existing keyword rules on the exact same confirmation requests." };
  const durations = evaluated.cases.map(record => record.elapsedMs).sort((first, second) => first - second);
  result.performance = { meanMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length), p50Ms: durations[Math.ceil(durations.length * 0.5) - 1], p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], processPeakRssBytes: Math.max(...evaluated.cases.map(record => record.processPeakRssBytes)), scope: "This GitHub CPU run only; not a mobile or energy measurement." };
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(engine.classify("Inspect the routine checklist.", { signal: preAborted.signal }), /aborted/);
  assert.throws(() => engine.classify("a".repeat(2001)), /2000/);
  await assert.rejects(engine.classify("界".repeat(1500)), /TOKEN_LIMIT/);
  const abort = new AbortController();
  const stopped = engine.classify("The conveyor belt is no longer moving.", { signal: abort.signal });
  abort.abort();
  await assert.rejects(stopped, /aborted/);
  await assert.rejects(engine.classify("Inspect the routine checklist."), /closed/);
  await close(engine);
  result.runtimeChecks = { cachedModelReload: true, preAbortedRequest: true, oversizedInput: true, tokenLimit: true, cancellationStopsProcess: true, closedWorkerRejectsWork: true, runtimeFetchAttemptsDuringInference: 0, networkControlScope: "Model download disabled and JS fetch blocked after initialization; not an OS network sandbox." };
  result.artifacts = [];
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const location = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(location);
      else if (/\.(onnx|json|txt)$/.test(entry.name)) {
        const digest = createHash("sha256");
        let bytes = 0;
        for await (const chunk of createReadStream(location)) { digest.update(chunk); bytes += chunk.length; }
        result.artifacts.push({ path: relative(cacheDir, location), bytes, sha256: digest.digest("hex") });
      }
    }
  }
  await inventory(cacheDir);
  if (!result.artifacts.some(entry => entry.path.endsWith(".onnx"))) throw new Error("No model artifact fingerprint was recorded.");
  result.status = "completed";
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