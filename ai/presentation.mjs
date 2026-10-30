import { escapeHtml, formatDuration, safeGitHubUrl } from "../app/domain.mjs";
import { summarizeClassification, pilotGate } from "./contract.mjs";

const percentage = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not measured";

export function serviceEvidenceView(report) {
  if (report?.schemaVersion !== 1 || report.status !== "completed" || !Array.isArray(report.testCases) || report.testCases.length > 200) return '<section class="empty-state"><h2>AI service evidence unavailable</h2><p>No completed service-classification evaluation is available. Model readiness is not established.</p></section>';
  let metrics;
  let gate;
  try { metrics = summarizeClassification(report.testCases); gate = pilotGate(metrics); }
  catch { return '<section class="empty-state"><h2>AI service evidence invalid</h2><p>The recorded cases could not be verified against the classification contract.</p></section>'; }
  const baseline = report.ruleBaseline?.metrics;
  const runUrl = safeGitHubUrl(report.runUrl);
  const blockers = [...gate.reasons, ...(Array.isArray(report.commercialReadiness?.blockers) ? report.commercialReadiness.blockers : [])];
  const failed = report.testCases.filter(entry => entry.expected !== entry.rawLabel);
  const hybrid = report.protocol?.systemKind === "model-plus-deterministic-review-policy";
  const modelCalls = report.testCases.filter(entry => entry.modelExecuted === true).length;
  const policyReviews = report.testCases.filter(entry => entry.decisionPath === "policy-review").length;
  return `<section id="service-ai-evidence">
    <div class="section-heading"><h2>${hybrid ? "Hybrid service classifier" : "Model-backed service classifier"}</h2><span class="badge amber">Commercial release blocked</span></div>
    <div class="cloud-context"><span>${hybrid ? "Qwen2.5 1.5B plus a reject-only policy. System accuracy, not pure-model accuracy." : "Recorded model-backed CPU evaluation."} ${gate.passed ? "The synthetic quality screen passed; production and mobile readiness remain unverified." : "The synthetic pilot-quality gate failed."} No inference runs in this browser.</span></div>
    <div class="metric-strip">
      <div class="metric"><div class="metric-label">Correct test labels</div><div class="metric-value">${metrics.correct} / ${metrics.total}</div><p class="metric-note">${percentage(metrics.accuracy)} / synthetic test set</p></div>
      <div class="metric"><div class="metric-label">Accepted-label precision</div><div class="metric-value">${percentage(metrics.acceptedPrecision)}</div><p class="metric-note">Required at least 95%</p></div>
      <div class="metric"><div class="metric-label">Unsafe acceptances</div><div class="metric-value amber-text">${metrics.unsafeAcceptances}</div><p class="metric-note">Required zero</p></div>
      <div class="metric"><div class="metric-label">Mean cloud request</div><div class="metric-value">${formatDuration(report.performance?.meanMs)}</div><p class="metric-note">GitHub CPU / not a phone</p></div>
    </div>
    <div class="activity-grid"><section><div class="section-heading"><h2>Runtime and comparison</h2></div><dl class="verification-lines">
      <div><dt>Accuracy target / above 90%</dt><dd>${metrics.accuracy > 0.9 ? "Met on this synthetic set" : "Not met"}</dd></div>
      <div><dt>Supported-request coverage</dt><dd>${percentage(metrics.supportedCoverage)}</dd></div>
      <div><dt>Model calls / policy rejections</dt><dd>${modelCalls} / ${policyReviews}</dd></div>
      <div><dt>Keyword baseline / same test set</dt><dd>${Number.isInteger(baseline?.correct) ? `${baseline.correct} / ${baseline.total}` : "Not recorded"}</dd></div>
      <div><dt>Peak cloud process memory</dt><dd>${Number.isFinite(report.performance?.processPeakRssBytes) ? `${(report.performance.processPeakRssBytes / 1073741824).toFixed(2)} GiB` : "Not measured"}</dd></div>
      <div><dt>Cached reload / blocked download</dt><dd>${report.cachedLoad?.passed ? "Verified" : "Not verified"}</dd></div>
      <div><dt>Cancellation / worker stop</dt><dd>${report.runtimeChecks?.cancellationStopsProcess ? "Verified" : "Not verified"}</dd></div>
      <div><dt>Phone energy</dt><dd class="amber-text">Not measured</dd></div>
    </dl></section><section><div class="section-heading"><h2>Open launch gates</h2></div><ul class="service-blockers">${blockers.map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      ${report.developmentReuse ? '<p>All confirmation cases were repeated unchanged after the first run exhausted its overall time budget. No classifier tuning followed that exposure.</p>' : ""}
      <p>Synthetic cases are not customer validation. Prior failures remain archived.</p>
      <a class="text-button" href="https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/ai/DEVICE_INTEGRATION.md" target="_blank" rel="noopener noreferrer">Device integration manual</a>
    </section></div>
    <div class="section-heading"><h2>Confirmation errors / ${failed.length}</h2><button class="text-button" data-action="export-service">Export AI receipt</button></div>
    <div>${failed.map(entry => `<article class="cloud-case"><div><label>${escapeHtml(entry.id)} / SYNTHETIC REQUEST</label><p>${escapeHtml(entry.input)}</p><p class="case-output">${escapeHtml(entry.output)}</p></div><div><label>Expected</label><strong>${escapeHtml(entry.expected)}</strong></div><div><label>System result</label><strong>${escapeHtml(entry.rawLabel || "invalid")}</strong></div></article>`).join("")}</div>
    <div class="section-heading receipt-footer"><a class="button quiet" href="./downloads/pocketroute-service-ai-0.1.0-experimental.zip" download>Experimental SDK</a><a class="button quiet" href="./downloads/pocketroute-device-test-kit-0.1.0.zip" download>Device test kit</a>${runUrl ? `<a class="text-button" href="${escapeHtml(runUrl)}" target="_blank" rel="noopener noreferrer">Evaluation run</a>` : ""}<a class="text-button" href="https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/ai/MODEL_CARD.md" target="_blank" rel="noopener noreferrer">Model card</a></div>
  </section>`;
}