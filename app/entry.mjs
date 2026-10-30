import { createIcons, LayoutDashboard, ListTodo, FlaskConical, History, BookOpen, Map, Search, Menu, X, ArrowUpRight, ArrowRight, ArrowDownToLine, RefreshCw, Check, ChevronRight, ChevronDown, Network, Sparkles, BriefcaseBusiness, Cpu, Smartphone, ShieldCheck, Layers, Battery, MemoryStick, GitBranch, ExternalLink, Play, Copy, SlidersHorizontal, CircleCheck, Clock, Lock, Info, RotateCcw, FileText, Tags, AlignLeft, PanelsTopLeft, List, Send, FolderOpen } from "lucide";
import { escapeHtml, routeRequest, filterTasks, summarizeRun, formatDuration, scenarioEconomics, safeGitHubUrl } from "./domain.mjs";
import { project, units, tasks, sessions, sources, modelCandidates, milestones, samples } from "../data/office.mjs";
import { serviceEvidenceView } from "../ai/presentation.mjs";

const icons = { LayoutDashboard, ListTodo, FlaskConical, History, BookOpen, Map, Search, Menu, X, ArrowUpRight, ArrowRight, ArrowDownToLine, RefreshCw, Check, ChevronRight, ChevronDown, Network, Sparkles, BriefcaseBusiness, Cpu, Smartphone, ShieldCheck, Layers, Battery, MemoryStick, GitBranch, ExternalLink, Play, Copy, SlidersHorizontal, CircleCheck, Clock, Lock, Info, RotateCcw, FileText, Tags, AlignLeft, PanelsTopLeft, List, Send, FolderOpen };
const views = [
  { id: "overview", label: "Overview", icon: "layout-dashboard" },
  { id: "execution", label: "Execution", icon: "list-todo", count: tasks.length },
  { id: "lab", label: "Model lab", icon: "flask-conical" },
  { id: "service", label: "Service AI", icon: "cpu" },
  { id: "sessions", label: "Sessions", icon: "history" },
  { id: "evidence", label: "Evidence", icon: "book-open", count: sources.length },
  { id: "roadmap", label: "Roadmap", icon: "map" },
];
const preferencesKey = "pocketroute.preferences.v1";
const notesKey = "pocketroute.personal-notes.v1";
const state = { view: "overview", query: "", unit: "all", taskStatus: "all", boardMode: "board", sessionKind: "All", evidenceCategory: "all", labTab: "policy", labTask: "auto", labInput: samples[0].input, labMemory: 1536, labBattery: 65, labResult: null, compare: new Set(["smollm", "qwen-small"]), run: null, service: null, verification: null, loading: true, error: false, noteTask: null };
const workspace = document.getElementById("workspace");
const dialog = document.getElementById("detail-dialog");
const search = document.getElementById("workspace-search");
let toastTimer;
let evidenceRequest = 0;
let dialogOpener;

const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const badge = (text, tone = "", symbol = "") => `<span class="badge ${tone}">${symbol ? icon(symbol) : ""}${escapeHtml(text)}</span>`;
const external = (href, label, className = "text-button") => `<a class="${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${icon("arrow-up-right")}</a>`;
const statusTone = status => ({ done: "mint", ready: "cyan", blocked: "amber", Returned: "cyan", Completed: "mint", Failed: "rose" })[status] || "";
const statusLabel = status => ({ done: "Complete", ready: "Ready", blocked: "Blocked" })[status] || status;
const currency = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function refreshIcons() { createIcons({ icons, attrs: { "stroke-width": 1.6 } }); }
function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unrecorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date); }
function toast(message) { const element = document.getElementById("toast"); clearTimeout(toastTimer); element.hidden = false; element.textContent = ""; requestAnimationFrame(() => { element.textContent = message; }); toastTimer = setTimeout(() => { element.hidden = true; }, 3200); }
function heading(title, eyebrow, subtitle, actions = "") { return `<header class="page-heading reveal"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${subtitle ? `<p class="subheading">${subtitle}</p>` : ""}</div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`; }
function empty(title, detail, action = "") { return `<div class="empty-state">${icon("folder-open")}<h2>${title}</h2><p>${detail}</p>${action}</div>`; }
function metrics(entries) { return `<div class="metric-strip reveal">${entries.map(entry => `<div class="metric"><div class="metric-label">${icon(entry.icon)}${entry.label}</div><div class="metric-value ${entry.text ? "text-value" : ""}">${escapeHtml(entry.value)}</div><p class="metric-note">${escapeHtml(entry.note)}</p></div>`).join("")}</div>`; }
function unitOptions() { return `<option value="all">All business units</option>${units.map(unit => `<option value="${unit.id}" ${state.unit === unit.id ? "selected" : ""}>BU${unit.number} / ${unit.name}</option>`).join("")}`; }
function topology() {
  return `<div class="topology-diagram"><img class="topology-image" src="./assets/topology.png" alt="" width="1000" height="400"><button class="topology-node" data-go="lab" title="Open the request workbench">${icon("send")}<span>Request</span></button><span class="topology-wire"></span><button class="topology-node router" data-go="lab" title="Open the rule-based routing workbench">${icon("network")}<span>Task router</span><small>RULE-BASED PREVIEW</small></button><span class="topology-wire"></span><div class="worker-stack"><button class="topology-node tone-cyan" data-sample="0" title="Preview field extraction routing">${icon("file-text")}Fields</button><button class="topology-node tone-amber" data-sample="1" title="Preview classification routing">${icon("tags")}Labels</button><button class="topology-node tone-rose" data-sample="2" title="Preview summary routing">${icon("align-left")}Summaries</button></div></div>`;
}
function allSessions() {
  const rows = [...sessions];
  if (state.run?.status === "completed" || state.run?.status === "failed") rows.unshift({ id: "CLOUD-SLM-01", title: "SmolLM2 cloud smoke experiment", kind: "Cloud", status: state.run.status === "completed" ? "Completed" : "Failed", date: state.run.completedAt, detail: "Pretrained 135M model. Synthetic route-label development cases on a GitHub CPU runner.", model: `${state.run.model} / ${state.run.runtime || "runtime unavailable"}`, outcome: state.run.note, runUrl: state.run.runUrl, elapsedMs: state.run.totalElapsedMs });
  if (state.service?.status === "completed") rows.unshift({ id: "SERVICE-AI-01", title: "Service-classifier confirmation", kind: "Cloud", status: "Quality blocked", date: state.service.completedAt, detail: "Pinned 1.5B model, separate synthetic confirmation set and isolated runtime checks.", model: `${state.service.selected?.id || "Unrecorded model"} / ${state.service.environment?.runtimeVersions?.transformers || "runtime unavailable"}`, outcome: "Execution completed; pilot quality gate failed. Commercial and mobile readiness remain unverified.", runUrl: state.service.runUrl, elapsedMs: state.service.totalElapsedMs });
  return rows;
}
function overview() {
  const summary = summarizeRun(state.run);
  const selectedUnits = state.unit === "all" ? units : units.filter(unit => unit.id === state.unit);
  const recent = allSessions().slice(0, 3);
  const taskCounts = Object.fromEntries(["done", "ready", "blocked"].map(status => [status, tasks.filter(task => task.status === status).length]));
  const nextDecisions = ["B03-004", "B03-005", "B03-010"].map(id => tasks.find(task => task.id === id)).filter(Boolean);
  return `${heading("PocketRoute overview", "AI OFFICE / PORTFOLIO", "Three business units. One evidence-led delivery process.", `${external(project.repository, "Repository", "button quiet")}<button class="button primary" data-action="export-snapshot">${icon("arrow-down-to-line")}Export snapshot</button>`)}
  ${metrics([{ icon: "layers", label: "Business units", value: String(units.length).padStart(2, "0"), note: "One shared AI-DLC" }, { icon: "list-todo", label: "Research work items", value: tasks.length, note: `${taskCounts.done} complete / ${taskCounts.ready} ready / ${taskCounts.blocked} gated` }, { icon: "cpu", label: "Pretrained SLM probe", value: "135M", note: summary.available ? `${summary.total} cloud smoke cases recorded` : "GitHub CPU experiment" }, { icon: "battery", label: "Phone energy delta", value: "Not measured", note: "Real-device evidence required", text: true }])}
  <section class="reveal"><div class="section-heading"><h2>Portfolio pulse</h2><label><span class="sr-only">Business unit</span><select id="unit-filter" aria-label="Business unit">${unitOptions()}</select></label></div><div class="unit-grid">${selectedUnits.map(unit => `<article class="unit-card tone-${unit.tone}"><div class="unit-card-top"><span class="unit-icon">${icon(unit.icon)}</span><span class="unit-number">BU / ${unit.number}</span></div><h3><a href="${unit.href}" ${unit.href.startsWith("https") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${unit.name}</a>${icon("arrow-up-right")}</h3><p>${unit.detail}</p><div class="unit-footer"><span>${unit.category}</span>${badge(unit.status, unit.tone)}</div></article>`).join("")}</div></section>
  <div class="overview-grid"><section class="tool-surface reveal"><div class="tool-heading"><h2>Routing topology</h2>${badge("Policy preview", "mint", "network")}</div>${topology()}<div class="tool-footer"><span>No model executes in this browser</span><a class="text-button" href="#lab">Open workbench${icon("arrow-right")}</a></div></section><section class="reveal"><div class="section-heading"><h2>Next decisions</h2><a href="#execution" class="text-button">All tasks${icon("arrow-up-right")}</a></div><div class="decision-list">${nextDecisions.map((task, index) => `<div class="decision-row"><span class="decision-index">0${index + 1}</span><div><h3>${task.title}</h3><p>${task.dependency}</p><div class="task-inline-badge">${badge(statusLabel(task.status), statusTone(task.status))}</div></div><button class="icon-button" data-task="${task.id}" aria-label="Open ${task.id}" title="Open task">${icon("arrow-up-right")}</button></div>`).join("")}</div></section></div>
  <div class="activity-grid"><section class="reveal"><div class="section-heading"><h2>Cloud experiment</h2>${badge(summary.available ? "Recorded" : state.run?.status === "failed" ? "Failed" : "Pending", summary.available ? "mint" : "amber")}</div><div class="run-summary"><div class="datum"><span class="label">Exact route labels</span><strong>${summary.available ? `${summary.correct}<span class="dim"> / ${summary.total}</span>` : "--"}</strong><small>Synthetic development smoke cases</small></div><div class="datum"><span class="label">Mean generation time</span><strong>${summary.available ? formatDuration(summary.meanMs) : "--"}</strong><small>GitHub CPU, not a phone</small></div></div>${summary.available ? `<meter class="result-meter" min="0" max="${Math.max(1, summary.total)}" value="${summary.correct}" aria-label="Correct route labels">${summary.correct} of ${summary.total}</meter>` : ""}<div class="section-heading run-summary-footer"><p>Task-completion quality is not established.</p><button class="text-button" data-action="cloud-tab">View outputs${icon("arrow-up-right")}</button></div></section><section class="reveal"><div class="section-heading"><h2>Native research gate</h2>${badge("G0 / Readiness", "amber")}</div><div class="gate-line"><span class="gate-icon">${icon("smartphone")}</span><div><h3>Resources before results</h3><p>Physical phones and valid energy measurement are still required.</p></div></div><div class="mini-timeline" aria-label="First readiness gate remains unresolved">${milestones.map((_, index) => `<span class="${index === 0 ? "current" : ""}"></span>`).join("")}</div><div class="section-heading"><p>Conditional 90-day research sequence</p><a href="#roadmap" class="text-button">Roadmap${icon("arrow-up-right")}</a></div></section></div>
  <section class="reveal"><div class="section-heading"><h2>Recent sessions</h2><a class="text-button" href="#sessions">Session history${icon("arrow-up-right")}</a></div><div class="table-wrapper recent-sessions"><table><thead><tr><th>SESSION</th><th>WORKSTREAM</th><th>STATE</th><th>RECORDED</th></tr></thead><tbody>${recent.map(session => `<tr><td><button class="table-title" data-session="${session.id}">${icon(session.kind === "Cloud" ? "cpu" : "history")}${session.title}</button></td><td class="muted">${session.kind}</td><td>${badge(session.status, statusTone(session.status))}</td><td><small>${dateLabel(session.date)}</small></td></tr>`).join("")}</tbody></table></div></section>`;
}

function execution() {
  const filtered = filterTasks(tasks, { status: state.taskStatus, unit: state.unit });
  const card = task => `<article class="task-card"><button data-task="${task.id}"><div class="task-topline"><span>${task.id}</span><b>${task.priority}</b></div><h3>${task.title}</h3><p>${task.phase}</p><div class="task-bottom"><span>${task.owner}</span>${icon("arrow-up-right")}</div></button></article>`;
  return `${heading("Execution board", "AI OFFICE / DELIVERY", "Public research backlog. Phone validation remains separate from cloud prototype delivery.", external(`${project.repository}/blob/main/data/office.mjs`, "Source records", "button quiet"))}<div class="filters"><div class="filter-group"><select id="execution-unit" aria-label="Filter tasks by unit">${unitOptions()}</select><select id="task-status" aria-label="Filter tasks by status">${[["all", "All states"], ["ready", "Ready"], ["blocked", "Blocked"], ["done", "Complete"]].map(([value, text]) => `<option value="${value}" ${state.taskStatus === value ? "selected" : ""}>${text}</option>`).join("")}</select><span class="subtle-note">${filtered.length} work items</span></div><div class="segmented" aria-label="Task view"><button data-board="board" aria-pressed="${state.boardMode === "board"}" aria-label="Board view" title="Board view">${icon("panels-top-left")}</button><button data-board="list" aria-pressed="${state.boardMode === "list"}" aria-label="List view" title="List view">${icon("list")}</button></div></div>
  ${filtered.length ? state.boardMode === "board" ? `<div class="board">${["ready", "blocked", "done"].map(status => `<section class="board-column reveal"><div class="board-column-heading"><span class="status-dot ${statusTone(status)}"></span><h2>${statusLabel(status)}</h2><small>${filtered.filter(task => task.status === status).length}</small></div>${filtered.filter(task => task.status === status).map(card).join("")}</section>`).join("")}</div>` : `<div class="table-wrapper reveal"><table><thead><tr><th>ID / TASK</th><th>STATE</th><th>OWNER</th><th>PRIORITY</th></tr></thead><tbody>${filtered.map(task => `<tr><td><small>${task.id}</small><button class="table-title" data-task="${task.id}">${task.title}</button></td><td>${badge(statusLabel(task.status), statusTone(task.status))}</td><td class="muted">${task.owner}</td><td>${task.priority}</td></tr>`).join("")}</tbody></table></div>` : empty("No matching public tasks", "Detailed operational records for other units remain separate from this public research snapshot.", '<button class="button quiet" data-action="reset-filters">Reset filters</button>')}`;
}

function routeOutput() {
  const result = state.labResult;
  const selected = result?.status === "routed";
  return `<div class="tool-heading"><h3>Selection preview</h3>${badge(result ? statusLabel(result.status) : "Idle", selected ? "mint" : "amber")}</div><div class="route-output"><span class="eyebrow">DETERMINISTIC POLICY / NO MODEL EXECUTED</span><h3>${selected ? escapeHtml(result.worker) : result ? "No worker selected" : "Awaiting request"}</h3><p>${result ? escapeHtml(result.reason) : "No request has been evaluated in this session."}</p><div class="route-steps">${["Request", "Policy", "Selection", "Review"].map((label, index) => `<div class="route-step ${result && (selected || index < 2) ? "active" : ""}">${label}</div>`).join("")}</div><dl class="route-facts"><div><dt>Strategy</dt><dd>Rules / explicit task</dd></div><div><dt>Model execution</dt><dd>None</dd></div><div><dt>Memory scenario</dt><dd>${state.labMemory.toLocaleString()} MiB</dd></div><div><dt>Phone energy</dt><dd class="amber-text">Not measured</dd></div></dl></div>`;
}
function cloudEvidence() {
  const run = state.run;
  const summary = summarizeRun(run);
  if (!summary.available) return `${empty(run?.status === "failed" ? "Cloud experiment failed" : "No cloud model result yet", escapeHtml(run?.note || "A verified inference receipt has not been published."), external(project.workflow, "GitHub workflow", "button primary"))}`;
  const baselineCases = run.cases.filter(item => typeof item.ruleBaselineCorrect === "boolean");
  const baselineCorrect = baselineCases.filter(item => item.ruleBaselineCorrect).length;
  return `${metrics([{ icon: "cpu", label: "Pretrained model", value: "135M", note: "SmolLM2 / existing weights" }, { icon: "circle-check", label: "Exact route labels", value: `${summary.correct} / ${summary.total}`, note: "All attempted smoke cases" }, { icon: "clock", label: "Mean generation", value: formatDuration(summary.meanMs), note: "GitHub-hosted CPU" }, { icon: "battery", label: "Phone energy", value: "Not measured", note: "Not inferred from cloud latency", text: true }])}<div class="cloud-context">${icon("info")}<span>${escapeHtml(run.note)} Model outputs below are preserved, including incorrect or unparseable labels.</span></div><div class="section-heading"><h2>Same-fixture rule baseline</h2>${badge(baselineCases.length ? `${baselineCorrect} / ${baselineCases.length} exact labels` : "Not recorded", "cyan")}</div><p class="subtle-note baseline-note">Development fixture only. This comparison does not establish generalization, task-completion quality or energy savings.</p><div class="section-heading"><h2>Recorded model outputs</h2><button class="text-button" data-action="export-run">${icon("arrow-down-to-line")}JSON receipt</button></div><div>${run.cases.map(item => `<article class="cloud-case"><div><label>${escapeHtml(item.id)} / SYNTHETIC INPUT</label><p>${escapeHtml(item.input)}</p><p class="case-output">${escapeHtml(item.output)}</p></div><div><label>Expected / result</label><strong>${escapeHtml(item.expected)} / ${escapeHtml(item.predicted || "invalid")}</strong><div>${badge(item.routeCorrect ? "Exact match" : "Mismatch", item.routeCorrect ? "mint" : "amber")}</div></div><div><label>Generation</label><strong>${formatDuration(item.elapsedMs)}</strong></div></article>`).join("")}</div><div class="section-heading receipt-footer"><p>Revision ${escapeHtml(run.modelRevision?.slice(0, 12) || "unavailable")}</p>${safeGitHubUrl(run.runUrl) ? external(run.runUrl, "Execution receipt") : ""}</div>`;
}
function lab() {
  return `${heading("Model lab", "RESEARCH / BUSINESS UNIT 03", "Policy exploration and recorded cloud inference are separate experiments.", external(project.workflow, "Run on GitHub", "button primary"))}<div class="segmented lab-tabs" role="tablist" aria-label="Model lab view"><button role="tab" data-lab-tab="policy" aria-selected="${state.labTab === "policy"}">Policy workbench</button><button role="tab" data-lab-tab="cloud" aria-selected="${state.labTab === "cloud"}">Cloud evidence</button></div>${state.labTab === "cloud" ? cloudEvidence() : `<div class="lab-grid"><section class="tool-surface reveal"><div class="tool-heading"><h2>Request workbench</h2>${badge("Local policy only", "cyan")}</div><div class="lab-form"><div class="sample-tabs">${samples.map((sample, index) => `<button class="button quiet" data-sample="${index}">${sample.title}</button>`).join("")}</div><label class="field-label" for="lab-input">Request <output id="input-length">${state.labInput.length} / 4,000</output></label><textarea id="lab-input" maxlength="4000" spellcheck="false">${escapeHtml(state.labInput)}</textarea><div class="lab-options"><label><span class="field-label">Task selection</span><select id="lab-task">${[["auto", "Auto / rules"], ["extract", "Extract fields"], ["classify", "Classify request"], ["summarize", "Summarize notes"]].map(([value, label]) => `<option value="${value}" ${value === state.labTask ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span class="field-label">Memory scenario</span><select id="lab-memory">${[256, 512, 1024, 1536, 2048].map(value => `<option value="${value}" ${value === state.labMemory ? "selected" : ""}>${value.toLocaleString()} MiB</option>`).join("")}</select></label></div><div class="scenario-battery"><label class="field-label" for="lab-battery">Battery scenario <output id="battery-output">${state.labBattery}%</output></label><input id="lab-battery" type="range" min="0" max="100" step="5" value="${state.labBattery}"></div><div class="lab-run-actions"><small>Scenario limits, not device telemetry.</small><button class="button primary" data-action="run-policy">${icon("play")}Preview route</button></div></div></section><section class="tool-surface reveal" id="route-output" aria-live="polite">${routeOutput()}</section></div>`}<div class="section-separator"></div><section><div class="section-heading"><h2>Model register</h2><button class="button quiet" data-action="compare-models" ${state.compare.size < 2 ? "disabled" : ""}>${icon("layers")}Compare ${state.compare.size}</button></div><div class="model-grid">${modelCandidates.map(model => `<article class="model-card tone-${model.color} ${state.compare.has(model.id) ? "selected" : ""}"><div class="model-card-top">${icon("cpu")}${badge(model.id === "smollm" && state.run?.status === "completed" ? "Cloud run recorded" : model.status, model.id === "smollm" ? "mint" : "")}</div><h3>${model.name}</h3><div class="model-size">${model.size}</div><p>${model.role}</p><div class="model-card-footer"><label><input type="checkbox" id="compare-${model.id}" data-compare="${model.id}" ${state.compare.has(model.id) ? "checked" : ""}>Compare</label><button class="icon-button" data-model="${model.id}" title="Model details" aria-label="Details for ${model.name} ${model.size}">${icon("arrow-up-right")}</button></div></article>`).join("")}</div></section>`;
}

function sessionView() {
  const visible = allSessions().filter(session => state.sessionKind === "All" || session.kind === state.sessionKind);
  return `${heading("Research sessions", "AI OFFICE / SESSION RECORD", "Returned research reports and dated cloud runs. No unattended workers are implied.", external(project.workflow, "Workflow history", "button quiet"))}<div class="filters"><div class="segmented" aria-label="Session workstream">${["All", "Research", "Commercial", "Verification", "Cloud"].map(kind => `<button data-session-kind="${kind}" aria-pressed="${state.sessionKind === kind}">${kind}</button>`).join("")}</div><span class="subtle-note">${visible.length} recorded sessions</span></div><div class="session-list">${visible.length ? visible.map(session => `<button class="session-row reveal" data-session="${session.id}"><span class="session-symbol">${icon(session.kind === "Cloud" ? "cpu" : session.kind === "Verification" ? "shield-check" : "history")}</span><span class="session-info"><h3>${session.title}</h3><p>${escapeHtml(session.detail)}</p></span><span class="session-meta">${badge(session.status, statusTone(session.status))}<small>${dateLabel(session.date)}</small></span>${icon("chevron-right")}</button>`).join("") : empty("No sessions in this workstream", "No matching execution record has been published.")}</div>`;
}

function evidence() {
  const verified = state.verification?.stage === "prepublication-checks-passed";
  const categories = [...new Set(sources.map(source => source.category))];
  const visible = state.evidenceCategory === "all" ? sources : sources.filter(source => source.category === state.evidenceCategory);
  return `${heading("Evidence library", "RESEARCH / SOURCES & RECEIPTS", "Published documentation, research references and actual GitHub verification receipts.", '<button class="button primary" data-action="export-verification">'+icon("arrow-down-to-line")+'Export verification</button>')}<div class="evidence-grid"><section class="reveal"><div class="section-heading"><h2>Cloud verification</h2>${badge(verified ? "Checks passed" : "No receipt", verified ? "mint" : "amber")}</div><dl class="verification-lines"><div><dt>Unit checks</dt><dd>${verified ? escapeHtml(state.verification.unitTests) : "Not recorded"}</dd></div><div><dt>Browser results / test x configuration</dt><dd>${verified ? escapeHtml(state.verification.browserTests) : "Not recorded"}</dd></div><div><dt>Browser engines</dt><dd>${verified ? escapeHtml(state.verification.browsers?.join(" / ") || "Not recorded") : "Not recorded"}</dd></div><div><dt>Local builds or tests</dt><dd>0</dd></div><div><dt>Physical-phone benchmarks</dt><dd>0</dd></div></dl></section><section class="reveal"><div class="section-heading"><h2>Claim boundaries</h2>${badge("Research stage", "amber")}</div><dl class="verification-lines"><div><dt>Whole-device energy saving</dt><dd class="amber-text">Unmeasured</dd></div><div><dt>New foundation model trained</dt><dd>No</dd></div><div><dt>Full held-out task validation</dt><dd>Pending</dd></div><div><dt>Premium research runtime identity</dt><dd>Unattested</dd></div><div><dt>Evidence collection scope</dt><dd>Public / synthetic</dd></div></dl></section></div>${verified ? `<div class="cloud-context">${icon("git-branch")}<span>Source ${escapeHtml(state.verification.sourceSha?.slice(0, 12))} / ${dateLabel(state.verification.checkedAt)}. Prepublication checks passed; this is not mobile or customer acceptance.</span>${safeGitHubUrl(state.verification.runUrl) ? external(state.verification.runUrl, "Run") : ""}</div>` : ""}<div class="section-heading"><h2>Primary-source register <span class="dim">/ ${visible.length}</span></h2><select id="source-category" aria-label="Source category"><option value="all">All categories</option>${categories.map(category => `<option ${state.evidenceCategory === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><div class="source-list">${visible.map(source => `<a class="source-row" href="${source.href}" target="_blank" rel="noopener noreferrer"><span class="source-id">${source.id}</span><span><h3>${source.title}</h3><p>${source.publisher} / ${source.category}</p></span>${icon("arrow-up-right")}</a>`).join("")}</div>`;
}

function roadmap() {
  return `${heading("Research roadmap", "STRATEGY / NEXT 90 DAYS", "Planning windows begin only after resource readiness. No delivery deadline or running countdown.", external(`${project.repository}/blob/main/README.md`, "Project brief", "button quiet"))}<div class="cloud-context">${icon("lock")}<span>T0 is not established: actual phone access, whole-device instrumentation and permitted capacity are still required. Cloud prototype work does not clear those gates.</span></div><ol class="roadmap">${milestones.map((milestone, index) => `<li class="roadmap-step ${milestone.state} reveal"><div class="roadmap-days"><small>DAYS FROM T0</small>${milestone.days}</div><span class="roadmap-marker">${index + 1}</span><div><h3>${milestone.title}</h3><p>${milestone.detail}</p></div><div class="roadmap-gate">${badge(milestone.gate, index === 0 ? "amber" : "")}</div></li>`).join("")}</ol><section><div class="section-heading"><h2>Commercial scenario</h2><button class="text-button" data-action="reset-economics">${icon("rotate-ccw")}Reset</button></div><p class="subtle-note">Illustrative assumptions only. No quote, expense authorization, contract or revenue.</p><div class="economics-grid"><div class="economics-inputs">${[{ id: "price", label: "Pilot price / INR", value: 50000 }, { id: "hours", label: "Engineering hours", value: 20 }, { id: "hourlyCost", label: "Time cost / INR per hour", value: 1000 }, { id: "testCost", label: "Test allowance / INR", value: 5000 }, { id: "reserve", label: "Support reserve / INR", value: 5000 }].map(field => `<label>${field.label}<input type="number" id="economic-${field.id}" data-economics="${field.id}" min="0" max="100000000" value="${field.value}"></label>`).join("")}</div><div class="economics-result" aria-live="polite"><h3>Illustrative contribution</h3><strong id="economic-contribution">${escapeHtml(currency(20000))}</strong><p id="economic-margin">40% contribution margin</p><p>Before acquisition, fixed R&D, tax and other overhead.</p>${badge("Hypothetical / not revenue", "amber")}</div></div></section><div class="section-separator"></div><div class="activity-grid"><section><div class="section-heading"><h2>Earn through delivery</h2></div><dl class="verification-lines"><div><dt>Feasibility price test</dt><dd>INR 25k-75k</dd></div><div><dt>Integration price test</dt><dd>INR 1-3 lakh</dd></div><div><dt>Support price test / app-year</dt><dd>INR 60k-2.4 lakh</dd></div></dl></section><section><div class="section-heading"><h2>Demand before scale</h2></div><dl class="verification-lines"><div><dt>Qualified conversations target</dt><dd>10</dd></div><div><dt>Written scopes target</dt><dd>3</dd></div><div><dt>Funded pilot target</dt><dd>1</dd></div></dl><p class="subtle-note receipt-footer">Targets only. No acquisition assumption or buyer validation.</p></section></div>`;
}

function searchResults() {
  const needle = state.query.toLowerCase();
  const results = [...tasks.map(item => ({ ...item, type: "Task", icon: "list-todo", action: `data-task="${item.id}"` })), ...sources.map(item => ({ ...item, type: "Source", icon: "book-open", action: `data-source="${item.id}"` })), ...allSessions().map(item => ({ ...item, type: "Session", icon: "history", action: `data-session="${item.id}"` }))].filter(item => `${item.title} ${item.id} ${item.type}`.toLowerCase().includes(needle));
  return `${heading("Search results", "AI OFFICE / SEARCH", `${results.length} matches for &quot;${escapeHtml(state.query)}&quot;`, '<button class="button quiet" data-action="clear-search">'+icon("x")+'Clear search</button>')}<div class="search-results">${results.length ? results.map(item => `<button class="search-result" ${item.action}>${icon(item.icon)}<span>${escapeHtml(item.title)}<small>${item.type} / ${item.id}</small></span>${icon("arrow-up-right")}</button>`).join("") : empty("No matching records", "No public task, session or source matches this search.")}</div>`;
}

function service() { return `${heading("Service AI", "ACTUAL MODEL / EXPERIMENTAL SDK", "Recorded model-backed classification, with quality and commercial readiness reported separately.")}${serviceEvidenceView(state.service)}`; }

function render() {
  document.getElementById("primary-navigation").innerHTML = views.map(view => `<a class="nav-link" href="#${view.id}" ${state.view === view.id ? 'aria-current="page"' : ""}>${icon(view.icon)}${view.label}${view.count ? `<small>${view.count}</small>` : ""}</a>`).join("");
  document.getElementById("current-view-label").textContent = views.find(view => view.id === state.view).label;
  workspace.innerHTML = state.query ? searchResults() : ({ overview, execution, lab, service, sessions: sessionView, evidence, roadmap })[state.view]();
  document.title = `${views.find(view => view.id === state.view).label} / PocketRoute`;
  refreshIcons();
}

function closeNavigation() { document.getElementById("sidebar").classList.remove("is-open"); document.getElementById("navigation-backdrop").hidden = true; document.getElementById("open-navigation").setAttribute("aria-expanded", "false"); document.body.classList.remove("navigation-open"); document.querySelector(".workspace-shell").inert = false; }
function navigate(view) { state.query = ""; search.value = ""; if (location.hash === `#${view}`) { state.view = view; render(); } else location.hash = view; closeNavigation(); }
function openDialog(title, eyebrow, body) {
  dialogOpener = document.activeElement;
  document.getElementById("dialog-content").innerHTML = `<div class="dialog-head"><p class="eyebrow">${escapeHtml(eyebrow)}</p><button class="icon-button" data-action="close-dialog" aria-label="Close details" title="Close details">${icon("x")}</button></div><div class="dialog-body"><h2 id="dialog-title">${escapeHtml(title)}</h2>${body}</div>`;
  refreshIcons();
  dialog.showModal();
}
function openTask(taskId) {
  const task = tasks.find(item => item.id === taskId);
  if (!task) return;
  state.noteTask = taskId;
  const notes = readStorage(notesKey, {});
  openDialog(task.title, `${task.id} / ${task.phase}`, `${badge(statusLabel(task.status), statusTone(task.status))}<dl class="detail-facts"><div><dt>Accountable workstream</dt><dd>${task.owner}</dd></div><div><dt>Priority</dt><dd>${task.priority}</dd></div><div><dt>Dependency</dt><dd>${task.dependency}</dd></div><div><dt>Business unit</dt><dd>BU03 / Mobile AI</dd></div></dl><h3>Acceptance criteria</h3><p>${task.acceptance}</p><label class="dialog-label" for="personal-note">Personal note / this browser only<textarea id="personal-note" maxlength="2000">${escapeHtml(notes[taskId] || "")}</textarea></label><p id="note-status" class="subtle-note receipt-footer" role="status" aria-live="polite"></p><h3>Evidence state</h3><p>${task.evidence}</p><div class="dialog-actions">${external(`${project.repository}/blob/main/data/office.mjs`, "Source record", "button quiet")}<button class="button quiet" data-action="clear-note">Clear note</button><button class="button primary" data-action="save-note">${icon("check")}Save note</button></div>`);
}
function openSession(sessionId) {
  const session = allSessions().find(item => item.id === sessionId);
  if (!session) return;
  openDialog(session.title, `${session.id} / ${session.kind}`, `${badge(session.status, statusTone(session.status))}<dl class="detail-facts"><div><dt>Recorded date</dt><dd>${dateLabel(session.date)}</dd></div><div><dt>Duration</dt><dd>${formatDuration(session.elapsedMs)}</dd></div><div><dt>Model / routing record</dt><dd>${escapeHtml(session.model)}</dd></div><div><dt>Evidence class</dt><dd>${session.kind === "Cloud" ? "Synthetic CPU smoke experiment" : "Returned research report"}</dd></div></dl><h3>Scope</h3><p>${escapeHtml(session.detail)}</p><h3>Outcome</h3><p>${escapeHtml(session.outcome)}</p>${safeGitHubUrl(session.runUrl) ? `<div class="dialog-actions">${external(session.runUrl, "Open cloud receipt", "button primary")}</div>` : ""}`);
}
function downloadJson(value, filename) { const address = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = address; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(address), 1000); toast("JSON exported"); }
function updateEconomics() {
  const values = Object.fromEntries([...document.querySelectorAll("[data-economics]")].map(input => [input.dataset.economics, input.value === "" ? NaN : Number(input.value)]));
  const result = scenarioEconomics(values);
  document.getElementById("economic-contribution").textContent = result ? currency(result.contribution) : "Invalid scenario";
  document.getElementById("economic-margin").textContent = result?.margin != null ? `${Math.round(result.margin * 100)}% contribution margin` : "Margin unavailable";
}

async function loadEvidence() {
  const request = ++evidenceRequest;
  const status = document.getElementById("evidence-status");
  status.textContent = "Refreshing published evidence";
  const loaded = await Promise.allSettled(["slm-results.json", "verification.json", "ai-service-results.json"].map(async name => {
    const response = await fetch(`./data/${name}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Unavailable evidence");
    return response.json();
  }));
  if (request !== evidenceRequest) return;
  const model = loaded[0].status === "fulfilled" ? loaded[0].value : null;
  const verification = loaded[1].status === "fulfilled" ? loaded[1].value : null;
  const serviceReport = loaded[2].status === "fulfilled" ? loaded[2].value : null;
  state.service = serviceReport?.schemaVersion === 1 && Array.isArray(serviceReport.testCases) && serviceReport.testCases.length <= 200 ? serviceReport : null;
  state.run = model?.schemaVersion === 1 && ["not-run", "completed", "failed"].includes(model.status) && Array.isArray(model.cases) && model.cases.length <= 24 ? model : null;
  state.verification = verification?.schemaVersion === 1 ? verification : null;
  state.error = !state.run || !state.verification;
  state.loading = false;
  status.classList.toggle("is-error", state.error);
  status.innerHTML = state.error ? `${icon("info")}Evidence unavailable / public planning views remain available` : `${icon("git-branch")}Published snapshot / ${dateLabel(state.verification.checkedAt || state.run.completedAt || project.date)} / ${state.verification.stage === "prepublication-checks-passed" ? "Cloud checks recorded" : "Verification pending"}`;
  render();
}

document.addEventListener("click", event => {
  const target = event.target.closest("button,a,[data-source]");
  if (!target) return;
  if (target.matches(".nav-link,.brand")) { closeNavigation(); workspace.focus({ preventScroll: true }); }
  if (target.dataset.go) { navigate(target.dataset.go); return; }
  if (target.dataset.task) { openTask(target.dataset.task); return; }
  if (target.dataset.session) { openSession(target.dataset.session); return; }
  if (target.dataset.source) { const source = sources.find(item => item.id === target.dataset.source); if (source) openDialog(source.title, `${source.id} / ${source.category}`, `<p>${source.publisher}. Primary-source documentation or research, not a reproduced device result.</p><div class="dialog-actions">${external(source.href, "Open original source", "button primary")}</div>`); return; }
  if (target.dataset.model) { const model = modelCandidates.find(item => item.id === target.dataset.model); if (model) openDialog(`${model.name} / ${model.size}`, "MODEL REGISTER", `${badge(model.status, model.color)}<p class="receipt-footer">${model.detail}</p><dl class="detail-facts"><div><dt>Role</dt><dd>${model.role}</dd></div><div><dt>Published license</dt><dd>${model.license}</dd></div><div><dt>Phone measurement</dt><dd>Not measured</dd></div><div><dt>Training by this project</dt><dd>None</dd></div></dl><div class="dialog-actions">${external(model.href, "Model source", "button primary")}</div>`); return; }
  if (target.dataset.sample !== undefined) { const sample = samples[Number(target.dataset.sample)]; if (sample) { state.labInput = sample.input; state.labTask = "auto"; state.labTab = "policy"; state.labResult = null; navigate("lab"); } return; }
  if (target.dataset.board) { state.boardMode = target.dataset.board; render(); return; }
  if (target.dataset.labTab) { state.labTab = target.dataset.labTab; render(); return; }
  if (target.dataset.sessionKind) { state.sessionKind = target.dataset.sessionKind; render(); return; }
  const action = target.dataset.action;
  if (action === "close-dialog") dialog.close();
  if (action === "clear-search") { state.query = ""; search.value = ""; render(); search.focus(); }
  if (action === "reset-filters") { state.unit = "all"; state.taskStatus = "all"; render(); }
  if (action === "cloud-tab") { state.labTab = "cloud"; navigate("lab"); }
  if (action === "run-policy") { state.labResult = routeRequest(state.labInput, { task: state.labTask, memoryMiB: state.labMemory, batteryPercent: state.labBattery }); document.getElementById("route-output").innerHTML = routeOutput(); refreshIcons(); }
  if (action === "save-note" || action === "clear-note") { const notes = readStorage(notesKey, {}); if (action === "clear-note") { delete notes[state.noteTask]; document.getElementById("personal-note").value = ""; } else notes[state.noteTask] = document.getElementById("personal-note").value.slice(0, 2000); document.getElementById("note-status").textContent = saveStorage(notesKey, notes) ? action === "clear-note" ? "Personal note cleared" : "Personal note saved in this browser" : "Browser storage unavailable"; }
  if (action === "compare-models") { const selected = modelCandidates.filter(model => state.compare.has(model.id)); openDialog("Model comparison", "METADATA / NOT A PERFORMANCE BENCHMARK", `<div class="table-wrapper"><table class="compare-table"><thead><tr><th>Property</th>${selected.map(model => `<th>${model.name}<br>${model.size}</th>`).join("")}</tr></thead><tbody>${[["Role", "role"], ["License", "license"], ["State", "status"]].map(([label, key]) => `<tr><th>${label}</th>${selected.map(model => `<td>${model[key]}</td>`).join("")}</tr>`).join("")}<tr><th>Phone joules</th>${selected.map(() => "<td>Unmeasured</td>").join("")}</tr></tbody></table></div><p class="receipt-footer">Only the SmolLM2 cloud smoke probe can have a recorded inference result here. No cross-model phone comparison has been executed.</p>`); }
  if (action === "export-snapshot") downloadJson({ project, units, tasks, researchSessions: sessions, cloudRun: state.run, verification: state.verification, privateCustomerDataIncluded: false }, "pocketroute-public-snapshot.json");
  if (action === "export-run") { if (state.run) downloadJson(state.run, "pocketroute-cloud-experiment.json"); else toast("No cloud receipt available"); }
  if (action === "export-service") { if (state.service) downloadJson(state.service, "pocketroute-ai-service-evaluation.json"); else toast("No AI service receipt available"); }
  if (action === "export-verification") { if (state.verification?.stage === "prepublication-checks-passed") downloadJson(state.verification, "pocketroute-verification.json"); else toast("No verification receipt available"); }
  if (action === "reset-economics") render();
});

document.addEventListener("input", event => {
  const input = event.target;
  if (input.id === "workspace-search") { state.query = input.value.trim(); render(); }
  if (input.id === "lab-input") { state.labInput = input.value; document.getElementById("input-length").textContent = `${input.value.length} / 4,000`; }
  if (input.id === "lab-battery") { state.labBattery = Number(input.value); document.getElementById("battery-output").textContent = `${state.labBattery}%`; }
  if (input.dataset.economics) updateEconomics();
});
document.addEventListener("change", event => {
  const input = event.target;
  if (["unit-filter", "execution-unit"].includes(input.id)) { state.unit = input.value; render(); }
  if (input.id === "task-status") { state.taskStatus = input.value; render(); }
  if (input.id === "lab-task") state.labTask = input.value;
  if (input.id === "lab-memory") state.labMemory = Number(input.value);
  if (input.id === "source-category") { state.evidenceCategory = input.value; render(); }
  if (input.dataset.compare) { input.checked ? state.compare.add(input.dataset.compare) : state.compare.delete(input.dataset.compare); const id = input.id; render(); document.getElementById(id)?.focus({ preventScroll: true }); }
  if (input.id === "motion-toggle") { document.documentElement.dataset.motion = input.checked ? "on" : "off"; saveStorage(preferencesKey, { motion: input.checked }); }
});
document.getElementById("open-navigation").addEventListener("click", () => { document.getElementById("sidebar").classList.add("is-open"); document.getElementById("navigation-backdrop").hidden = false; document.getElementById("open-navigation").setAttribute("aria-expanded", "true"); document.body.classList.add("navigation-open"); document.querySelector(".workspace-shell").inert = true; document.getElementById("close-navigation").focus(); });
document.getElementById("close-navigation").addEventListener("click", () => { closeNavigation(); document.getElementById("open-navigation").focus(); });
document.getElementById("navigation-backdrop").addEventListener("click", () => { closeNavigation(); document.getElementById("open-navigation").focus(); });
document.getElementById("refresh-evidence").addEventListener("click", loadEvidence);
dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
dialog.addEventListener("close", () => { if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true }); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !dialog.open && document.getElementById("sidebar").classList.contains("is-open")) { closeNavigation(); document.getElementById("open-navigation").focus(); } });
window.addEventListener("hashchange", () => { const view = location.hash.slice(1); if (view === "workspace") { workspace.focus(); return; } state.view = views.some(item => item.id === view) ? view : "overview"; state.query = ""; search.value = ""; closeNavigation(); render(); workspace.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
document.addEventListener("visibilitychange", () => { document.documentElement.dataset.hidden = String(document.hidden); });
matchMedia("(min-width: 781px)").addEventListener("change", event => { if (event.matches) closeNavigation(); });
const motion = readStorage(preferencesKey, {}).motion ?? !matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("motion-toggle").checked = Boolean(motion);
document.documentElement.dataset.motion = motion ? "on" : "off";
state.view = views.some(view => view.id === location.hash.slice(1)) ? location.hash.slice(1) : "overview";
render();
loadEvidence();