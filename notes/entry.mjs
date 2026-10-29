import { createIcons, Plus, Search, Download, Upload, Settings2, ShieldCheck, LayoutDashboard, FileUp, FileDown, ScanText, Workflow, Check, Trash2, Sheet, ArrowUpRight, GitBranch, X, RefreshCw, FileText } from "lucide";
import { analyzeNote, categoryLabels, createBackup, createRecord, parseBackup, validateRecordDraft, noteLimit, backupByteLimit, coreVersion } from "../app/note-core.mjs";
import { escapeHtml } from "../app/domain.mjs";
import { listRecords, saveRecord, deleteRecord, importRecords, clearRecords, exportRecovery } from "./store.mjs";
import { recordsToCsv } from "./export.mjs";

const icons = { Plus, Search, Download, Upload, Settings2, ShieldCheck, LayoutDashboard, FileUp, FileDown, ScanText, Workflow, Check, Trash2, Sheet, ArrowUpRight, GitBranch, X, RefreshCw, FileText };
const element = id => document.getElementById(id);
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const fields = { title: "record-title", site: "record-site", date: "record-date", reference: "record-reference", category: "record-kind", summary: "record-summary" };
const freshDraft = () => ({ title: "", site: "", date: "", reference: "", category: "General", source: "", summary: "", reviewed: false });
const state = { draft: freshDraft(), draftId: crypto.randomUUID(), previous: null, prepared: false, dirty: false, busy: false, storage: false, records: [], unreadable: 0, analysis: null, query: "", category: "all" };
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("pocketroute-notes-records-v1") : null;
let lastDialogFocus;
let installPrompt;
let registration;

function renderIcons() { createIcons({ icons, attrs: { "stroke-width": 1.6 } }); }
function setStatus(message, error = false) { element("work-status").textContent = message; element("work-status").classList.toggle("error", error); }
function notifyChange() { channel?.postMessage({ kind: "records-changed" }); }
function controls() {
  element("review-fields").disabled = !state.prepared || state.busy;
  element("source-note").disabled = state.busy;
  for (const button of document.querySelectorAll("[data-mutates]")) button.disabled = state.busy;
  for (const button of document.querySelectorAll("[data-record]")) button.disabled = state.busy;
  element("save-button").disabled = state.busy || !state.storage || !state.prepared || !state.dirty || !state.draft.reviewed;
  element("backup-button").disabled = state.busy || !state.storage || !state.records.length;
  element("csv-button").disabled = state.busy || !state.storage || !state.records.length;
  element("import-button").disabled = state.busy || !state.storage;
  element("delete-button").hidden = !state.previous;
  element("draft-export").disabled = state.busy || !state.draft.source.trim();
  element("source-count").textContent = `${state.draft.source.length.toLocaleString()} / 12,000`;
  element("draft-state").textContent = state.busy ? "Working" : state.dirty ? "Unsaved changes" : state.previous ? "Saved locally" : "New draft";
  element("draft-state").className = `badge ${state.dirty ? "amber" : state.previous ? "mint" : ""}`;
  element("version-state").textContent = state.previous ? `Version ${state.previous.version}` : "Not saved";
}
function syncFields() {
  element("source-note").value = state.draft.source;
  for (const [field, id] of Object.entries(fields)) element(id).value = state.draft[field];
  element("review-confirmed").checked = state.draft.reviewed;
  const analysis = state.analysis;
  element("evidence-count").textContent = `${Object.keys(analysis?.evidence || {}).length} fields`;
  element("evidence-content").innerHTML = analysis ? Object.entries(analysis.evidence).map(([field, value]) => `<div class="evidence-item"><b>${escapeHtml(field)}</b><span>${escapeHtml(value.quote)}<small>Source line ${value.line}</small></span></div>`).join("") || "<p>No unambiguous labelled fields were found. Empty fields remain editable.</p>" : "<p>No record prepared.</p>";
  element("review-warnings").innerHTML = analysis?.warnings.length ? `<ul>${analysis.warnings.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "";
  controls();
}
function renderRecords() {
  const query = state.query.toLowerCase();
  const visible = state.records.filter(record => (state.category === "all" || record.category === state.category) && `${record.title} ${record.site} ${record.reference} ${record.summary}`.toLowerCase().includes(query));
  element("record-count").textContent = String(state.records.length);
  element("record-list").innerHTML = visible.length ? visible.map(record => `<button class="saved-record" data-record="${record.id}" aria-pressed="${state.previous?.id === record.id}" ${state.busy ? "disabled" : ""}><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.site || "No site")} / ${escapeHtml(record.date || "No date")}</small><span class="record-row-meta"><span>${escapeHtml(record.category)} / v${record.version}</span>${icon("check")}</span></button>`).join("") : `<div class="record-empty">${icon("file-text")}${state.records.length ? "No matching records." : "No saved records yet."}</div>`;
  element("recovery-banner").hidden = !state.unreadable;
  element("recovery-banner").textContent = `${state.unreadable} unsupported local record(s) were retained. Export a recovery file in Storage and privacy before deleting data.`;
  renderIcons();
  controls();
}
async function refreshRecords() {
  try {
    const result = await listRecords();
    state.records = result.records;
    state.unreadable = result.unreadable;
    state.storage = true;
    element("storage-state").textContent = "This browser / local storage ready";
    document.body.dataset.storage = "ready";
  } catch (error) {
    state.storage = false;
    element("storage-state").textContent = "Storage unavailable";
    document.body.dataset.storage = "unavailable";
    setStatus(error.message, true);
  }
  renderRecords();
}
async function busy(operation) {
  if (state.busy) return;
  state.busy = true;
  controls();
  try { await operation(); } catch (error) { setStatus(error.message || "The operation did not complete. Your draft is retained.", true); }
  finally { state.busy = false; controls(); }
}
function showDialog(title, body) {
  const dialog = element("notes-dialog");
  if (dialog.open) dialog.close();
  lastDialogFocus = document.activeElement;
  element("notes-dialog-content").innerHTML = `<div class="dialog-head"><p class="eyebrow">POCKETROUTE NOTES</p><button class="icon-button" id="notes-dialog-close" aria-label="Close dialog" title="Close dialog">${icon("x")}</button></div><div class="dialog-body"><h2 id="notes-dialog-title">${escapeHtml(title)}</h2>${body}</div>`;
  element("notes-dialog-close").onclick = () => dialog.close();
  renderIcons();
  dialog.showModal();
}
function confirmAction(title, message, label, danger = false) {
  return new Promise(resolve => {
    showDialog(title, `<p>${escapeHtml(message)}</p><div class="notes-dialog-actions"><button id="confirmation-cancel" class="button quiet" autofocus>Cancel</button><button id="confirmation-accept" class="button ${danger ? "danger-button" : "primary"}">${escapeHtml(label)}</button></div>`);
    const dialog = element("notes-dialog");
    let accepted = false;
    const close = () => { dialog.removeEventListener("close", close); resolve(accepted); };
    dialog.addEventListener("close", close);
    element("confirmation-cancel").onclick = () => dialog.close();
    element("confirmation-accept").onclick = () => { accepted = true; dialog.close(); };
    element("confirmation-cancel").focus();
  });
}
async function allowDraftReplacement() { return !state.dirty || await confirmAction("Discard unsaved changes?", "The current draft has not been saved. Export it first if you need to keep these edits.", "Discard draft", true); }
function replaceDraft(draft = freshDraft(), previous = null) {
  state.draft = draft;
  state.previous = previous;
  state.draftId = previous?.id || crypto.randomUUID();
  state.prepared = Boolean(previous);
  state.dirty = false;
  state.analysis = previous ? analyzeNote(previous.source) : null;
  syncFields();
  renderRecords();
}
function download(content, name, type = "application/json") {
  const address = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = address;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), 1500);
}
function prepare() {
  const analysis = analyzeNote(state.draft.source);
  state.draft = { ...state.draft, source: analysis.source, ...analysis.fields, category: analysis.category, summary: analysis.summary, title: state.draft.title || (analysis.fields.site ? `Visit / ${analysis.fields.site}` : "Untitled visit"), reviewed: false };
  state.analysis = analysis;
  state.prepared = true;
  state.dirty = true;
  syncFields();
  setStatus(analysis.warnings.length ? "Prepared with review warnings. No uncertain fields were filled." : "Record prepared. Review the fields and summary against the source before saving.");
}

element("source-note").addEventListener("input", event => {
  state.draft.source = event.target.value;
  state.draft.reviewed = false;
  state.prepared = false;
  state.dirty = true;
  element("review-confirmed").checked = false;
  controls();
});
for (const [field, id] of Object.entries(fields)) element(id).addEventListener("input", event => {
  state.draft[field] = event.target.value;
  state.draft.reviewed = false;
  state.dirty = true;
  element("review-confirmed").checked = false;
  controls();
});
element("review-confirmed").addEventListener("change", event => { state.draft.reviewed = event.target.checked; controls(); });
element("prepare-button").addEventListener("click", async () => { await busy(async () => prepare()); if (state.prepared) element("record-title").focus(); });
element("record-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!state.prepared || !state.dirty || !state.storage) return;
  busy(async () => {
    const errors = validateRecordDraft(state.draft);
    if (errors.length) throw new Error(errors.join(" "));
    const saved = await saveRecord(state.draft, state.previous, state.draftId);
    state.previous = saved;
    state.draft = { ...saved };
    state.dirty = false;
    await refreshRecords();
    notifyChange();
    setStatus(`Saved locally: ${saved.title}. Version ${saved.version}.`);
  });
});
element("new-note").addEventListener("click", async () => { if (!state.busy && await allowDraftReplacement()) { replaceDraft(); setStatus("New draft. No record is saved until review is confirmed."); element("source-note").focus(); } });
element("sample-button").addEventListener("click", async () => {
  if (state.busy || !await allowDraftReplacement()) return;
  replaceDraft();
  state.draft.source = "Site: North-17\nDate: 2026-10-29\nTicket: JOB-0042\n\nTwo filters need replacement.\nThe unit remains isolated.\nA return visit is scheduled after the replacement parts arrive.";
  state.dirty = true;
  syncFields();
  setStatus("Synthetic sample loaded. It is not a customer record or a model result.");
});
element("record-list").addEventListener("click", async event => {
  const button = event.target.closest("[data-record]");
  if (!button || state.busy || !await allowDraftReplacement()) return;
  const selected = state.records.find(record => record.id === button.dataset.record);
  if (!selected) return;
  replaceDraft({ ...selected }, selected);
  setStatus(`Saved record opened. Summary origin: ${selected.summaryOrigin}; processing version ${selected.engineVersion}.`);
});
element("record-search").addEventListener("input", event => { state.query = event.target.value; renderRecords(); });
element("record-category").addEventListener("change", event => { state.category = event.target.value; renderRecords(); });
element("delete-button").addEventListener("click", async () => {
  const previous = state.previous;
  if (!previous || state.busy || !await confirmAction("Delete this saved record?", `Delete ${previous.title} from this browser? Existing exported files are not deleted.`, "Delete record", true)) return;
  busy(async () => { await deleteRecord(previous.id, previous.version); replaceDraft(); await refreshRecords(); notifyChange(); setStatus("Saved record deleted from this browser."); });
});
element("draft-export").addEventListener("click", () => { download(JSON.stringify({ kind: "pocketroute-note-draft", schemaVersion: 1, productVersion: coreVersion, ...state.draft, reviewed: false }, null, 2), "pocketroute-unsaved-draft.json"); setStatus("Unencrypted draft exported. Draft files are not reviewed-record backups."); });
element("backup-button").addEventListener("click", () => busy(async () => { const { records } = await listRecords(); download(JSON.stringify(createBackup(records), null, 2), "pocketroute-notes-backup.json"); setStatus(`Private, unencrypted backup exported: ${records.length} readable record(s).`); }));
element("csv-button").addEventListener("click", () => busy(async () => { const { records } = await listRecords(); download(recordsToCsv(records), "pocketroute-notes.csv", "text/csv;charset=utf-8"); setStatus("CSV exported. Formula-like text is escaped; JSON backups preserve the original values."); }));
element("import-button").addEventListener("click", () => element("backup-file").click());
element("backup-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || state.busy) return;
  try {
    if (file.size > backupByteLimit) throw new Error("Backup exceeds the 8 MiB limit.");
    const records = parseBackup(await file.text());
    if (!await confirmAction("Import reviewed records?", `Add up to ${records.length} record(s) to this browser. Existing IDs will not be overwritten; conflicting records will be reported. The file is not uploaded.`, "Import records")) return;
    await busy(async () => {
      const result = await importRecords(records);
      await refreshRecords();
      notifyChange();
      const summary = `${result.imported} imported, ${result.unchanged} unchanged, ${result.conflicts.length} conflict(s) retained without overwrite.`;
      setStatus(summary, result.conflicts.length > 0);
      if (result.conflicts.length) showDialog("Import conflicts retained", `<p>${escapeHtml(summary)}</p><p class="import-outcome">${result.conflicts.map(escapeHtml).join("<br>")}</p>`);
    });
  } catch (error) { setStatus(error.message, true); }
});
element("load-text").addEventListener("click", () => element("text-file").click());
element("text-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || state.busy) return;
  try {
    if (file.size > noteLimit * 4) throw new Error("The text note is too large.");
    const text = await file.text();
    if (!text.trim() || text.length > noteLimit) throw new Error("A text note must contain 1 to 12,000 characters.");
    if (!await allowDraftReplacement()) return;
    replaceDraft();
    state.draft.source = text;
    state.dirty = true;
    syncFields();
    setStatus("Text note opened locally; no upload was performed.");
  } catch (error) { setStatus(error.message, true); }
});
element("settings-button").addEventListener("click", () => {
  showDialog("Storage and privacy", `<p>Records are stored in this browser's IndexedDB, unencrypted. Anyone with access to this browser profile may read them. Browser cleanup or storage eviction can erase them. There is no account, cloud sync, telemetry or model download.</p><p>Use permitted data only. Keep backups private. Clearing records does not delete exported files or the public offline app cache.</p><div class="notes-settings-actions"><button id="recover-export" class="button quiet" ${!state.storage ? "disabled" : ""}>${icon("file-down")}Export raw recovery file</button><button id="clear-records" class="button danger-button" ${!state.storage ? "disabled" : ""}>${icon("trash-2")}Clear all local records</button><a href="./guide.html" class="button quiet">Privacy, limits and self-hosting${icon("arrow-up-right")}</a></div>`);
  renderIcons();
  element("recover-export").onclick = () => { element("notes-dialog").close(); busy(async () => { download(JSON.stringify(await exportRecovery(), null, 2), "pocketroute-notes-recovery.json"); setStatus("Raw unencrypted recovery file exported, including unsupported stored records. Keep it private."); }); };
  element("clear-records").onclick = async () => {
    if (!await confirmAction("Clear all local records?", "All readable and unsupported PocketRoute Notes records in this browser will be deleted. Export a backup or recovery file first. Other apps and exported files are not changed.", "Clear records", true)) return;
    busy(async () => { await clearRecords(); replaceDraft(); await refreshRecords(); notifyChange(); setStatus("All PocketRoute Notes records were cleared from this browser."); });
  };
});
element("notes-dialog").addEventListener("close", () => { if (lastDialogFocus?.isConnected) lastDialogFocus.focus({ preventScroll: true }); else element("new-note").focus({ preventScroll: true }); });
window.addEventListener("beforeunload", event => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
channel?.addEventListener("message", event => { if (event.data?.kind === "records-changed") refreshRecords(); });

function updateOfflineState() {
  const cached = Boolean(navigator.serviceWorker?.controller);
  element("offline-state").textContent = cached ? navigator.onLine ? "Offline-ready" : "Offline" : "Offline cache pending";
  element("offline-state").className = `badge ${cached ? "mint" : "amber"}`;
  document.body.dataset.offlineReady = String(cached);
}
window.addEventListener("online", updateOfflineState);
window.addEventListener("offline", updateOfflineState);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", updateOfflineState);
  navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then(value => {
    registration = value;
    if (registration.waiting) element("update-button").hidden = false;
    registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) element("update-button").hidden = false; }); });
    updateOfflineState();
  }).catch(() => { element("offline-state").textContent = "Offline cache unavailable"; document.body.dataset.offlineReady = "false"; });
}
element("update-button").addEventListener("click", async () => {
  if (!await allowDraftReplacement()) return;
  state.dirty = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  registration?.waiting?.postMessage({ kind: "ACTIVATE_UPDATE" });
});
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; element("install-button").hidden = false; });
element("install-button").addEventListener("click", async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; element("install-button").hidden = true; } });
document.documentElement.dataset.motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "off" : "on";
renderIcons();
syncFields();
refreshRecords();
updateOfflineState();