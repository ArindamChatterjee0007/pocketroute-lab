import "../scripts/cloud-only.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { assertGitHubRunner, repository } from "../scripts/cloud-only.mjs";
import { escapeHtml, routeRequest, filterTasks, summarizeRun, parseRoute, formatDuration, scenarioEconomics, safeGitHubUrl } from "../app/domain.mjs";
import { tasks, sources, units } from "../data/office.mjs";
import { analyzeNote, validateRecordDraft, validDate } from "../app/note-core.mjs";

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