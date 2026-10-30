import { serviceLabels, summarizeClassification, pilotGate } from "./contract.mjs";

const deviceClasses = ["phone", "watch", "linux-board", "mcu"];
const outcomes = ["completed", "timeout", "cancelled", "error", "unavailable"];
const boundedText = value => typeof value === "string" && value.trim().length > 0 && value.length <= 160;
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function createDeviceReference(receipt) {
  if (receipt?.status !== "completed" || !hash(receipt.protocol?.sha256) || !hash(receipt.dataset?.sha256) || !Array.isArray(receipt.testCases)) throw new TypeError("A completed, fingerprinted reference receipt is required.");
  summarizeClassification(receipt.testCases);
  return {
    schemaVersion: 1,
    suiteId: receipt.dataset.version,
    referenceRunUrl: receipt.runUrl,
    protocolSha256: receipt.protocol.sha256,
    datasetSha256: receipt.dataset.sha256,
    modelRevision: receipt.selected.revision,
    scope: "Exposed synthetic regression/parity cases, not a fresh quality test or physical-device evidence.",
    cases: receipt.testCases.map(entry => ({ id: entry.id, expected: entry.expected, output: entry.output })),
  };
}

export function evaluateDeviceReport(reference, report) {
  if (reference?.schemaVersion !== 1 || !boundedText(reference.suiteId) || !hash(reference.protocolSha256) || !hash(reference.datasetSha256) || !/^[a-f0-9]{40}$/.test(reference.modelRevision || "") || !Array.isArray(reference.cases) || reference.cases.length > 1000) throw new TypeError("Invalid reference manifest.");
  const baseline = summarizeClassification(reference.cases);
  if (reference.cases.some(entry => !serviceLabels.includes(entry.output))) throw new TypeError("Reference predictions must be canonical labels.");
  if (report?.schemaVersion !== 1 || ["suiteId", "protocolSha256", "datasetSha256", "modelRevision"].some(key => report[key] !== reference[key])) throw new TypeError("Report does not match the frozen suite, protocol or model revision.");
  if (!["physical-device", "simulator", "cloud-fixture"].includes(report.executionKind) || !["cold", "warm"].includes(report.phase)) throw new TypeError("Execution kind and cold/warm phase are required.");
  if (!deviceClasses.includes(report.device?.class) || ![report.device?.model, report.device?.os, report.device?.architecture, report.runtime?.name, report.runtime?.version, report.runtime?.backend].every(boundedText) || !/^[a-f0-9]{40}$/.test(report.appSourceSha || "")) throw new TypeError("Device, runtime and source provenance are incomplete.");
  if (!Array.isArray(report.cases) || report.cases.length !== reference.cases.length) throw new TypeError("Every frozen case must have exactly one recorded attempt.");
  const expected = new Map(reference.cases.map(entry => [entry.id, entry]));
  const seen = new Set();
  const evaluated = [];
  const differences = [];
  for (const entry of report.cases) {
    if (!expected.has(entry?.id) || seen.has(entry.id) || !outcomes.includes(entry.outcome)) throw new TypeError("Unknown, duplicated or unexecuted case.");
    seen.add(entry.id);
    if (!Number.isFinite(entry.elapsedMs) || entry.elapsedMs < 0 || (entry.peakMemoryBytes !== null && (!Number.isSafeInteger(entry.peakMemoryBytes) || entry.peakMemoryBytes < 0))) throw new TypeError("Invalid latency or memory measurement; use null for unknown memory.");
    if (entry.outcome === "completed" ? typeof entry.output !== "string" || entry.output.length > 500 : entry.output !== null) throw new TypeError("Non-completed attempts must have null output.");
    const original = expected.get(entry.id);
    evaluated.push({ id: entry.id, expected: original.expected, output: entry.outcome === "completed" ? entry.output : null });
    if (entry.outcome !== "completed" || entry.output !== original.output) differences.push(entry.id);
  }
  const metrics = summarizeClassification(evaluated);
  const durations = report.cases.map(entry => entry.elapsedMs).sort((first, second) => first - second);
  const memoryComplete = report.cases.every(entry => entry.peakMemoryBytes !== null);
  const errors = report.cases.filter(entry => entry.outcome !== "completed").length;
  const regressionReasons = [];
  if (metrics.correct < baseline.correct) regressionReasons.push("Correct labels decreased.");
  if (metrics.unsafeAcceptances > baseline.unsafeAcceptances) regressionReasons.push("Unsafe acceptances increased.");
  if (metrics.supportedCoverage < baseline.supportedCoverage) regressionReasons.push("Supported-request coverage decreased.");
  if (metrics.acceptedPrecision === null || metrics.acceptedPrecision < baseline.acceptedPrecision) regressionReasons.push("Accepted-label precision decreased or is undefined.");
  if (metrics.invalidOutputs > baseline.invalidOutputs || errors) regressionReasons.push("Invalid labels or failed attempts were recorded.");
  return {
    schemaVersion: 1,
    suiteId: reference.suiteId,
    scope: "Reported regression evidence only; not independently attested hardware or a new held-out result.",
    executionKind: report.executionKind,
    phase: report.phase,
    metrics,
    referenceMetrics: baseline,
    parity: { passed: differences.length === 0, differences },
    nonRegression: { passed: regressionReasons.length === 0, reasons: regressionReasons },
    syntheticQualityScreen: { ...pilotGate(metrics), greaterThan90Percent: metrics.accuracy > 0.9 },
    performance: { attempted: report.cases.length, errors, p50Ms: durations[Math.ceil(durations.length * 0.5) - 1], p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], peakMemoryBytes: memoryComplete ? Math.max(...report.cases.map(entry => entry.peakMemoryBytes)) : null, memoryComplete, energyJoules: null },
    physicalEvidenceIndependentlyVerified: false,
    productionReady: false,
  };
}