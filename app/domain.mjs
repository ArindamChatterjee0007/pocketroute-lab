export const taskKinds = Object.freeze(["extract", "classify", "summarize"]);

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function routeRequest(input, { task = "auto", memoryMiB = 1536, batteryPercent = 65 } = {}) {
  const text = typeof input === "string" ? input.trim() : "";
  const base = { modelExecuted: false, strategy: "deterministic-policy", energyJoules: null };
  if (!text || text.length > 4000) return { ...base, status: "invalid", task: null, reason: "Enter a request between 1 and 4,000 characters." };
  if (!["auto", ...taskKinds].includes(task)) return { ...base, status: "invalid", task: null, reason: "Unsupported task selection." };
  if (!Number.isFinite(memoryMiB) || !Number.isFinite(batteryPercent) || memoryMiB < 0 || batteryPercent < 0 || batteryPercent > 100) return { ...base, status: "invalid", task: null, reason: "Scenario resource values are invalid." };
  const matches = taskKinds.filter(kind => ({ extract: /\b(extract|fields|structured|json)\b/i, classify: /\b(classify|categorize|category|label)\b/i, summarize: /\b(summarize|summarise|summary|condense)\b/i })[kind].test(text));
  const selected = task !== "auto" ? task : matches.length === 1 ? matches[0] : null;
  if (!selected) return { ...base, status: "abstained", task: null, reason: matches.length > 1 ? "More than one task matches. An explicit task is required." : "This request is outside the three supported task types." };
  if (batteryPercent < 15 || memoryMiB < 512) return { ...base, status: "unavailable", task: selected, reason: "The scenario is below the illustrative resource floor." };
  return { ...base, status: "routed", task: selected, worker: { extract: "Structured fields", classify: "Request labels", summarize: "Grounded summaries" }[selected], reason: task === "auto" ? "One supported task matched the request." : "Explicit task selected; no router model needed." };
}

export function filterTasks(tasks, { query = "", status = "all", unit = "all" } = {}) {
  const needle = query.trim().toLowerCase();
  return tasks.filter(task => (status === "all" || task.status === status) && (unit === "all" || task.unit === unit) && `${task.id} ${task.title} ${task.owner} ${task.phase}`.toLowerCase().includes(needle));
}

export function summarizeRun(run) {
  if (run?.status !== "completed" || !Array.isArray(run.cases)) return { available: false, total: 0, correct: 0, meanMs: null, energyJoules: null };
  const durations = run.cases.map(item => item.elapsedMs).filter(value => Number.isFinite(value) && value >= 0);
  return { available: true, total: run.cases.length, correct: run.cases.filter(item => item.routeCorrect === true).length, meanMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null, energyJoules: null };
}

export function parseRoute(text) {
  const normalized = String(text ?? "").trim().toLowerCase().replace(/^['"`]+|['"`.!`]+$/g, "");
  return [...taskKinds, "unsupported"].includes(normalized) ? normalized : null;
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Not measured";
  return milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;
}

export function scenarioEconomics({ price, hours, hourlyCost, testCost, reserve }) {
  const inputs = [price, hours, hourlyCost, testCost, reserve];
  if (inputs.some(value => !Number.isFinite(value) || value < 0)) return null;
  const contribution = price - hours * hourlyCost - testCost - reserve;
  return { contribution, margin: price > 0 ? contribution / price : null, hypothetical: true };
}

export function safeGitHubUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && url.pathname.startsWith("/ArindamChatterjee007/pocketroute-lab/") ? url.href : null;
  } catch { return null; }
}