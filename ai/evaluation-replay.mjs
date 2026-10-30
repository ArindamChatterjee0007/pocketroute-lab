import { summarizeClassification } from "./contract.mjs";

export function reusableDevelopment(previous, { protocolSha256, datasetSha256, runtimeVersions, candidate, records, confirmationCount }) {
  if (previous?.status !== "failed" || previous.protocol?.sha256 !== protocolSha256 || previous.dataset?.sha256 !== datasetSha256 || JSON.stringify(previous.environment?.runtimeVersions) !== JSON.stringify(runtimeVersions)) return null;
  if (!Array.isArray(previous.testCases) || previous.testCases.length < 1 || previous.testCases.length >= confirmationCount || previous.error !== "classify deadline exceeded; model process stopped." || previous.totalElapsedMs < 1200000) return null;
  const report = previous.candidates?.find(entry => entry.key === candidate.key && entry.id === candidate.id && entry.revision === candidate.revision && entry.dtype === candidate.dtype && entry.status === "evaluated");
  if (!report || !Array.isArray(report.cases) || report.cases.length !== records.length) return null;
  if (!report.cases.every((entry, index) => entry.id === records[index].id && entry.input === records[index].input && entry.expected === records[index].expected)) return null;
  const metrics = summarizeClassification(report.cases);
  if (metrics.accuracy <= 0.9 || metrics.acceptedPrecision < 0.95 || metrics.supportedCoverage < 0.8 || metrics.unsafeAcceptances !== 0) return null;
  return { cases: report.cases, metrics, sourceRun: previous.runUrl, sourceSha: previous.sourceSha, priorConfirmationCount: previous.testCases.length, reason: "Identical frozen classifier/data/runtime; prior run exhausted the overall budget after qualifying regression. All confirmation cases will be rerun, not merged or filtered." };
}