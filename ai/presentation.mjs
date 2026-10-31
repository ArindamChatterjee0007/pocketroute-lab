import { escapeHtml, formatDuration, safeGitHubUrl } from "../app/domain.mjs";
import { summarizeClassification, pilotGate } from "./contract.mjs";
import { evaluateDeviceReport } from "./device-report.mjs";
import { project } from "../data/office.mjs";

const percentage = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not measured";

export function validateAndroidEvidence(snapshot) {
  const build = snapshot?.build;
  const verification = snapshot?.verification;
  if (snapshot?.schemaVersion !== 1 || snapshot.scope !== "technical-work-only" || !/^[a-z0-9][a-z0-9._-]{0,80}$/.test(snapshot.releaseTag || "")
      || build?.status !== "vm-tested-experimental-artifacts" || !/^[a-f0-9]{40}$/.test(build.sourceSha || "")
      || verification?.status !== "software-checks-passed" || verification.sourceSha !== build.sourceSha
      || snapshot.report?.appSourceSha !== build.sourceSha || snapshot.report?.executionKind !== "simulator"
      || verification.executionKind !== "simulator" || verification.physicalDeviceValidated !== false
      || verification.apiLevel !== 36 || verification.architecture !== "x86_64" || verification.configuredRamMiB !== 8192
      || build.jvmTests !== 3 || build.goldenVectors !== 160 || build.productionReady !== false || verification.productionReady !== false
      || verification.humanLabelledQualityValidated !== false || build.modelWeightsBundled !== false || build.privateKeysBundled !== false
      || snapshot.contract?.status !== "passed" || snapshot.contract.goldenVectors !== build.goldenVectors || snapshot.contract.requestedPermissions !== 0
      || snapshot.contract.modelFilesHashVerified !== true || snapshot.contract.tamperedModelRejected !== true || snapshot.lifecycle?.status !== "passed"
      || snapshot.lifecycle.workerTerminationConfirmed !== true || snapshot.lifecycle.concurrentRequestRejected !== true
      || snapshot.ui?.status !== "passed" || snapshot.ui.actualModelRequest !== true || snapshot.ui.explicitUnload !== true) throw new TypeError("Native evidence is incomplete or has inconsistent provenance.");
  const assessment = evaluateDeviceReport(snapshot.reference, snapshot.report);
  if (assessment.metrics.total !== 96 || assessment.performance.errors || assessment.metrics.invalidOutputs
      || verification.parity?.passed !== assessment.parity.passed || verification.nonRegression?.passed !== assessment.nonRegression.passed) throw new TypeError("Native software verification does not match the recorded attempts.");
  const runUrl = safeGitHubUrl(verification.runUrl);
  const apk = build.artifacts?.find(entry => entry.name === "pocketroute-android-lab-0.1.0-debug.apk");
  const aar = build.artifacts?.find(entry => entry.name === "pocketroute-runtime-0.1.0-debug.aar");
  if (!runUrl || ![apk, aar].every(entry => entry && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && /^[a-f0-9]{64}$/.test(entry.sha256))) throw new TypeError("Native artifact hashes or run links are invalid.");
  const downloadRoot = `${project.repository}/releases/download/${snapshot.releaseTag}/`;
  return { assessment, build, verification, runUrl, apk, aar, downloadRoot };
}

export function androidEvidenceView(snapshot) {
  if (!snapshot) return '<section id="android-vm-evidence" class="empty-state"><h2>Android VM evidence unavailable</h2><p>No verified native download is offered without its matching software receipt.</p></section>';
  let evidence;
  try { evidence = validateAndroidEvidence(snapshot); }
  catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return '<section id="android-vm-evidence" class="empty-state"><h2>Android VM evidence invalid</h2><p>The native source, attempts or artifacts could not be verified. No native readiness or download is implied.</p></section>';
  }
  const { assessment, build, verification, runUrl, apk, aar, downloadRoot } = evidence;
  const media = snapshot.media?.status === "passed" && snapshot.media.appSourceSha === build.sourceSha && snapshot.media.apkSha256 === apk.sha256
    && snapshot.media.images?.some(image => image.path === "android-vm-summary.png" && /^[a-f0-9]{64}$/.test(image.sha256));
  return `<section id="android-vm-evidence" class="native-evidence">
    <div class="section-heading"><h2>Android VM prototype</h2><span class="badge amber">Experimental / emulator only</span></div>
    <div class="cloud-context">A native app and reusable AAR run the frozen Qwen reference. ${assessment.syntheticQualityScreen.passed ? "The exposed synthetic screen passed, not independent validation." : "The model-quality gate still fails."} No physical-phone or energy qualification is claimed.</div>
    <div class="metric-strip">
      <div class="metric"><div class="metric-label">Reference outputs matched</div><div class="metric-value">${96 - assessment.parity.differences.length} / 96</div><p class="metric-note">Parity, not correctness</p></div>
      <div class="metric"><div class="metric-label">Correct regression labels</div><div class="metric-value">${assessment.metrics.correct} / 96</div><p class="metric-note">${percentage(assessment.metrics.accuracy)} / exposed synthetic cases</p></div>
      <div class="metric"><div class="metric-label">Unsafe acceptances</div><div class="metric-value amber-text">${assessment.metrics.unsafeAcceptances}</div><p class="metric-note">Human review remains required</p></div>
      <div class="metric"><div class="metric-label">Warm VM p95</div><div class="metric-value">${formatDuration(assessment.performance.p95Ms)}</div><p class="metric-note">Client round trip / not a phone</p></div>
    </div>
    <div class="activity-grid"><section><div class="section-heading"><h3>Verified software, open qualification</h3></div><dl class="verification-lines">
      <div><dt>Runtime target</dt><dd>API ${escapeHtml(verification.apiLevel)} / ${escapeHtml(verification.architecture)} emulator</dd></div>
      <div><dt>Configured VM RAM</dt><dd>${escapeHtml(verification.configuredRamMiB)} MiB</dd></div>
      <div><dt>JVM checks / cross-runtime vectors</dt><dd>${escapeHtml(build.jvmTests)} / ${escapeHtml(build.goldenVectors)}</dd></div>
      <div><dt>Worker stop / deadline / concurrency</dt><dd>Verified on the emulator</dd></div>
      <div><dt>App Internet permission / bundled weights</dt><dd>Neither included</dd></div>
      <div><dt>ARM64</dt><dd>Built only / not executed</dd></div>
      <div><dt>Aggregate memory / whole-device energy</dt><dd class="amber-text">Not measured</dd></div>
    </dl><p>These are exposed regression cases, not a fresh accuracy claim. Physical devices, permitted human-labelled data and deployment rights remain separate gates.</p>
    <div class="receipt-footer native-downloads"><a class="button primary" href="${escapeHtml(downloadRoot + apk.name)}">Experimental Android APK</a><a class="button quiet" href="${escapeHtml(downloadRoot + aar.name)}">Android runtime AAR</a><a class="text-button" href="${escapeHtml(downloadRoot + "SHA256SUMS")}">Native checksums</a><button class="text-button" data-action="export-android">Export Android receipt</button></div>
    <div class="receipt-footer native-downloads"><a class="text-button" href="${escapeHtml(project.repository + "/blob/" + build.sourceSha + "/native/android/README.md")}" target="_blank" rel="noopener noreferrer">Android installation guide</a><a class="text-button" href="${escapeHtml(runUrl)}" target="_blank" rel="noopener noreferrer">Native verification run</a></div>
    </section><figure class="native-preview">${media ? '<img src="./assets/android-vm-summary.png" width="1200" height="1120" alt="Technical summary containing an actual Android emulator capture: 96 reference outputs match, but only 73 are correct; quality remains blocked.">' : '<p>Verified native images are unavailable.</p>'}<figcaption>Android emulator / synthetic request. Not a physical-phone photograph or benchmark.</figcaption></figure></div>
  </section>`;
}

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
    <div class="section-heading"><h2>${hybrid ? "Hybrid service classifier" : "Model-backed service classifier"}</h2><span class="badge amber">Release qualification blocked</span></div>
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
      <a class="text-button" href="./downloads/pocketroute-device-integration.pdf" download>Device manual (PDF)</a>
    </section></div>
    <div class="section-heading"><h2>Confirmation errors / ${failed.length}</h2><button class="text-button" data-action="export-service">Export AI receipt</button></div>
    <div>${failed.map(entry => `<article class="cloud-case"><div><label>${escapeHtml(entry.id)} / SYNTHETIC REQUEST</label><p>${escapeHtml(entry.input)}</p><p class="case-output">${escapeHtml(entry.output)}</p></div><div><label>Expected</label><strong>${escapeHtml(entry.expected)}</strong></div><div><label>System result</label><strong>${escapeHtml(entry.rawLabel || "invalid")}</strong></div></article>`).join("")}</div>
    <div class="section-heading receipt-footer"><a class="button quiet" href="./downloads/pocketroute-service-ai-0.1.0-experimental.zip" download>Experimental SDK</a><a class="button quiet" href="./downloads/pocketroute-device-test-kit-0.1.0.zip" download>Device test kit</a><a class="text-button" href="./downloads/pocketroute-sdk-reference.pdf" download>SDK reference (PDF)</a>${runUrl ? `<a class="text-button" href="${escapeHtml(runUrl)}" target="_blank" rel="noopener noreferrer">Evaluation run</a>` : ""}</div>
  </section>`;
}