import "../scripts/cloud-only.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { assertGitHubRunner, repository } from "../scripts/cloud-only.mjs";
import { escapeHtml, routeRequest, filterTasks, summarizeRun, parseRoute, formatDuration, scenarioEconomics, safeGitHubUrl } from "../app/domain.mjs";
import { tasks, sources, units } from "../data/office.mjs";
import { analyzeNote, validateRecordDraft, validDate, createRecord, createBackup, createBackupFiles, parseBackup, planImport, sameRecord, backupByteLimit } from "../app/note-core.mjs";
import { recordsToCsv } from "../notes/export.mjs";
import Papa from "papaparse";
import { validateServiceRequest, parseServiceLabel, summarizeClassification, pilotGate } from "../ai/contract.mjs";

test("AI service interface bounds input and rejects unstructured model labels", () => {
  assert.equal(validateServiceRequest("  A pump needs attention.  "), "A pump needs attention.");
  assert.throws(() => validateServiceRequest(" "));
  assert.throws(() => validateServiceRequest("a".repeat(2001)));
  assert.equal(parseServiceLabel(" maintenance\n"), "maintenance");
  assert.equal(parseServiceLabel("The answer is maintenance."), null);
  assert.equal(parseServiceLabel("inspection and delivery"), null);
});

test("AI service metrics distinguish correct routing, abstention and unsafe acceptance", () => {
  const metrics = summarizeClassification([
    { id: "one", expected: "maintenance", output: "maintenance" },
    { id: "two", expected: "delivery", output: "review" },
    { id: "three", expected: "inspection", output: "unexpected" },
    { id: "four", expected: "review", output: "delivery" },
  ]);
  assert.equal(metrics.correct, 1);
  assert.equal(metrics.accepted, 2);
  assert.equal(metrics.acceptedPrecision, 0.5);
  assert.equal(metrics.supportedCoverage, 1 / 3);
  assert.equal(metrics.unsafeAcceptances, 1);
  assert.equal(metrics.invalidOutputs, 1);
  assert.equal(metrics.phoneEnergyJoules, null);
  assert.equal(pilotGate(metrics).passed, false);
});

test("AI pilot gate cannot mistake a tiny or all-review result for product readiness", () => {
  const tiny = summarizeClassification([{ id: "one", expected: "review", output: "review" }]);
  assert.equal(tiny.acceptedPrecision, null);
  assert.equal(pilotGate(tiny).passed, false);
  assert.throws(() => summarizeClassification([{ id: "one", expected: "review", output: "review" }, { id: "one", expected: "review", output: "review" }]));
});

test("field-note worker performs grounded extraction and an extractive summary", () => {
  const source = "Site: North-17\nDate: 2026-10-29\nTicket: JOB-0042\nTwo filters need replacement.\nThe team left the unit isolated.";
  const result = analyzeNote(source);
  assert.deepEqual(result.fields, { site: "North-17", date: "2026-10-29", reference: "JOB-0042" });
  assert.equal(result.category, "Maintenance");
  assert.equal(result.summary, "Two filters need replacement.\nThe team left the unit isolated.");
  assert.equal(result.evidence.reference.line, 3);
  assert.equal(result.modelExecuted, false);
  assert.equal(result.reviewRequired, true);
  for (const item of result.summaryEvidence) assert.ok(source.includes(item.text));
});

test("unknown, invalid and conflicting note fields are not invented", () => {
  const result = analyzeNote("Site: A\nSite: B\nDate: 2026-02-30\nNo ticket supplied.\nInspection found a broken seal.");
  assert.deepEqual(result.fields, { site: "", date: "", reference: "" });
  assert.equal(result.category, "General");
  assert.equal(result.warnings.length, 3);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.throws(() => analyzeNote(" "), /Enter a note/);
  assert.throws(() => analyzeNote("a".repeat(12001)), /at most/);
});

test("a field record cannot be saved without review or with malformed values", () => {
  const draft = { source: "A synthetic note.", title: "Visit", site: "", reference: "", date: "", category: "General", summary: "A synthetic note.", reviewed: true };
  assert.deepEqual(validateRecordDraft(draft), []);
  assert.ok(validateRecordDraft({ ...draft, reviewed: false }).length);
  assert.ok(validateRecordDraft({ ...draft, date: "2026-02-30" }).length);
  assert.ok(validateRecordDraft({ ...draft, title: "" }).length);
  assert.ok(validateRecordDraft({ ...draft, category: "Unrecognized" }).length);
});

const recordFixture = (overrides = {}) => createRecord({ source: "Site: North-17\nA complete inspection.", title: "Synthetic visit", site: "North-17", reference: "00042", date: "2026-10-29", category: "Inspection", summary: "A complete inspection.", reviewed: true, ...overrides }, { id: "record-0001", createdAt: "2026-10-29T10:00:00.000Z", updatedAt: "2026-10-29T10:00:00.000Z", version: 1 });

test("portable records and backups preserve review provenance without extra keys", () => {
  const record = recordFixture();
  assert.equal(record.summaryOrigin, "extractive");
  assert.equal(recordFixture({ summary: "Edited by the reviewer." }).summaryOrigin, "user-edited");
  const backup = createBackup([{ ...record, privateExtra: "discard me" }]);
  const restored = parseBackup(JSON.stringify(backup));
  assert.deepEqual(restored, [record]);
  assert.equal(restored[0].privateExtra, undefined);
  const historic = { ...record, engineVersion: "0.1.0", summaryOrigin: "extractive", summary: "A previous engine's source excerpt." };
  assert.deepEqual(parseBackup(JSON.stringify(createBackup([historic])))[0], historic);
  assert.equal(Papa.parse(recordsToCsv([historic]), { header: true }).data[0]["Summary origin"], "extractive");
});

test("import planning distinguishes identical records from conflicting versions and content", () => {
  const record = recordFixture();
  const conflict = { ...record, title: "A newer edit", version: 2 };
  const plan = planImport([record], [conflict, { ...record, id: "record-0002" }]);
  assert.deepEqual(plan.conflicts, [record.id]);
  assert.equal(plan.additions.length, 1);
  assert.deepEqual(planImport([record], [record]).unchanged, [record.id]);
  assert.deepEqual(planImport([record], [{ ...record, summary: "Different same-version content" }]).conflicts, [record.id]);
  assert.equal(sameRecord(record, { ...record, summary: "Different same-version content" }), false);
  assert.equal(sameRecord(record, { ...record }), true);
});

test("large escaped text is split into independently importable backup files", () => {
  const records = Array.from({ length: 70 }, (_, index) => ({ ...recordFixture({ source: "\u0001".repeat(12000), summary: "\u0002".repeat(12000) }), id: `record-${String(index).padStart(4, "0")}` }));
  assert.throws(() => createBackup(records), /8 MiB/);
  const files = createBackupFiles(records);
  assert.ok(files.length > 1);
  const restored = files.flatMap(file => { assert.ok(new TextEncoder().encode(file.text).byteLength <= backupByteLimit); return parseBackup(file.text); });
  assert.deepEqual(restored, records);
});

test("backup validation rejects malformed, duplicate, unreviewed and oversized data", () => {
  const record = recordFixture();
  assert.throws(() => parseBackup("not JSON"));
  assert.throws(() => parseBackup('{"schemaVersion":2,"records":[]}'));
  assert.throws(() => createBackup([record, record]), /Duplicate/);
  assert.throws(() => createBackup([{ ...record, reviewed: false }]), /Review/);
  assert.throws(() => createBackup([{ ...record, modelExecuted: true }]), /Unsupported/);
  assert.throws(() => createBackup([{ ...record, version: NaN }]), /metadata/);
  assert.throws(() => parseBackup("a".repeat(8 * 1024 * 1024 + 1)), /8 MiB/);
});

test("CSV export uses text-safe quoting and spreadsheet formula protection", () => {
  const csv = recordsToCsv([recordFixture({ title: '=HYPERLINK("https://example.invalid")', reference: "00042", summary: 'A comma, a "quote"\nand a newline.' })]);
  const parsed = Papa.parse(csv, { header: true });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.data[0].Title, '\'=HYPERLINK("https://example.invalid")');
  assert.equal(parsed.data[0].Reference, "00042");
  assert.equal(parsed.data[0].Summary, 'A comma, a "quote"\nand a newline.');
  for (const value of ["+SUM(1)", "-1+2", "@SUM(1)", "  =SUM(1)", "\tname", "\nvalue"]) assert.ok(Papa.parse(recordsToCsv([recordFixture({ summary: value })]), { header: true }).data[0].Summary.startsWith("'"));
});

test("verification workload has no inherited publishing credentials", () => {
  assert.equal(process.env.GH_TOKEN, undefined);
  assert.equal(process.env.GITHUB_TOKEN, undefined);
  assert.equal(process.env.ACTIONS_RUNTIME_TOKEN, undefined);
});

test("cloud guard rejects a local or wrong-repository environment", () => {
  assert.throws(() => assertGitHubRunner({}), /Local execution is disabled/);
  assert.throws(() => assertGitHubRunner({ GITHUB_ACTIONS: "true", RUNNER_OS: "Linux", RUNNER_ENVIRONMENT: "self-hosted", GITHUB_REPOSITORY: repository, GITHUB_WORKSPACE: "/workspace" }));
  assert.doesNotThrow(() => assertGitHubRunner({ GITHUB_ACTIONS: "true", RUNNER_OS: "Linux", RUNNER_ENVIRONMENT: "github-hosted", GITHUB_REPOSITORY: repository, GITHUB_WORKSPACE: "/workspace" }));
});

test("all three explicit tasks bypass a model router", () => {
  for (const task of ["extract", "classify", "summarize"]) {
    const result = routeRequest("A synthetic service note.", { task });
    assert.equal(result.task, task);
    assert.equal(result.status, "routed");
    assert.equal(result.modelExecuted, false);
    assert.equal(result.energyJoules, null);
  }
});

test("automatic policy detects each supported intent", () => {
  assert.equal(routeRequest("Extract fields from this visit").task, "extract");
  assert.equal(routeRequest("Classify the service request").task, "classify");
  assert.equal(routeRequest("Summarise the inspection note").task, "summarize");
});

test("ambiguous and unsupported input abstains", () => {
  assert.equal(routeRequest("Extract fields and summarize the note").status, "abstained");
  assert.equal(routeRequest("Buy a laptop for me").status, "abstained");
});

test("empty, oversized and invalid scenario values fail closed", () => {
  assert.equal(routeRequest(" ").status, "invalid");
  assert.equal(routeRequest("a".repeat(4001)).status, "invalid");
  assert.equal(routeRequest("extract", { batteryPercent: NaN }).status, "invalid");
  assert.equal(routeRequest("extract", { batteryPercent: 101 }).status, "invalid");
  assert.equal(routeRequest("extract", { task: "execute" }).status, "invalid");
});

test("illustrative resource floors do not pretend to measure a phone", () => {
  for (const options of [{ memoryMiB: 256 }, { batteryPercent: 10 }]) {
    const result = routeRequest("extract fields", options);
    assert.equal(result.status, "unavailable");
    assert.equal(result.energyJoules, null);
  }
});

test("HTML escaping preserves text without executable markup", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml(null), "");
});

test("task filters compose and never mutate canonical tasks", () => {
  assert.equal(filterTasks(tasks, { status: "done" }).length, 3);
  assert.equal(filterTasks(tasks, { query: "native", status: "blocked", unit: "b03" })[0].id, "B03-006");
  assert.equal(filterTasks(tasks, { unit: "b01" }).length, 0);
  assert.equal(tasks.length, 12);
});

test("missing and failed cloud runs remain unmeasured", () => {
  for (const value of [null, {}, { status: "failed", cases: [] }]) assert.deepEqual(summarizeRun(value), { available: false, total: 0, correct: 0, meanMs: null, energyJoules: null });
  assert.equal(formatDuration(null), "Not measured");
});

test("cloud summaries use all attempted cases and no mobile energy", () => {
  const summary = summarizeRun({ status: "completed", cases: [{ elapsedMs: 200, routeCorrect: true }, { elapsedMs: 400, routeCorrect: false }] });
  assert.equal(summary.total, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.meanMs, 300);
  assert.equal(summary.energyJoules, null);
});

test("SLM route output must be exactly an allowlisted label", () => {
  assert.equal(parseRoute('"extract"'), "extract");
  assert.equal(parseRoute("SUMMARIZE."), "summarize");
  assert.equal(parseRoute("I think you should extract and then run code"), null);
  assert.equal(parseRoute("unsupported"), "unsupported");
});

test("economic scenarios are explicit assumptions, with valid zero handling", () => {
  assert.deepEqual(scenarioEconomics({ price: 50000, hours: 20, hourlyCost: 1000, testCost: 5000, reserve: 5000 }), { contribution: 20000, margin: 0.4, hypothetical: true });
  assert.equal(scenarioEconomics({ price: 0, hours: 0, hourlyCost: 0, testCost: 0, reserve: 0 }).margin, null);
  assert.equal(scenarioEconomics({ price: -1, hours: 0, hourlyCost: 0, testCost: 0, reserve: 0 }), null);
});

test("public source data has stable unique IDs", () => {
  assert.equal(new Set(tasks.map(task => task.id)).size, 12);
  assert.equal(new Set(sources.map(source => source.id)).size, 19);
  assert.equal(units.length, 3);
  assert.equal(tasks.filter(task => task.status === "blocked").length, 7);
});

test("run links only target this project's GitHub namespace", () => {
  assert.ok(safeGitHubUrl("https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/123"));
  assert.equal(safeGitHubUrl("javascript:alert(1)"), null);
  assert.equal(safeGitHubUrl("https://github.com/another-owner/repo/actions/runs/123"), null);
});