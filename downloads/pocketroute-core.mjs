export const coreVersion = "0.2.0";
export const noteLimit = 12000;
export const recordLimit = 100;
export const backupByteLimit = 8 * 1024 * 1024;
export const categoryLabels = Object.freeze(["Maintenance", "Delivery", "Inspection", "General"]);

const fieldPatterns = Object.freeze({
  site: /^\s*(?:site|site id|location)\s*:\s*(.+?)\s*$/i,
  date: /^\s*(?:date|visit date|inspection date)\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/i,
  reference: /^\s*(?:reference|ticket|ticket id|reference id)\s*:\s*(.+?)\s*$/i,
});

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function analyzeNote(input) {
  if (typeof input !== "string" || !input.trim()) throw new TypeError("Enter a note before preparing a record.");
  if (input.length > noteLimit) throw new RangeError(`A note must be at most ${noteLimit.toLocaleString()} characters.`);
  const source = input.trim();
  const lines = source.split(/\r?\n/);
  const fields = { site: "", date: "", reference: "" };
  const evidence = {};
  const warnings = [];
  const candidates = Object.fromEntries(Object.keys(fields).map(field => [field, []]));
  for (const [index, line] of lines.entries()) {
    for (const [field, pattern] of Object.entries(fieldPatterns)) {
      const match = pattern.exec(line);
      if (match) candidates[field].push({ value: match[1].trim(), line: index + 1, quote: line });
    }
  }
  for (const [field, matches] of Object.entries(candidates)) {
    const distinct = [...new Set(matches.map(match => match.value))];
    if (distinct.length > 1) warnings.push(`Conflicting ${field} values need review.`);
    else if (distinct.length === 1 && (field !== "date" || validDate(distinct[0]))) {
      fields[field] = distinct[0];
      evidence[field] = matches[0];
    } else if (distinct.length) warnings.push("The labelled date is not a valid calendar date.");
  }
  const rules = {
    Maintenance: /\b(repair|replace|replacement|broken|leak|maintenance|faulty)\b/i,
    Delivery: /\b(delivery|shipment|parcel|courier|dispatch)\b/i,
    Inspection: /\b(inspect|inspection|audit|checklist|survey)\b/i,
  };
  const categoryMatches = Object.entries(rules).filter(([, pattern]) => pattern.test(source));
  const category = categoryMatches.length === 1 ? categoryMatches[0][0] : "General";
  if (categoryMatches.length > 1) warnings.push("Multiple categories matched; choose the appropriate category.");
  const summaryLines = lines.map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(item => item.text && !Object.values(fieldPatterns).some(pattern => pattern.test(item.text))).slice(0, 3);
  const summary = summaryLines.map(item => item.text).join("\n");
  return { schemaVersion: 1, engine: "rules-and-extractive", engineVersion: coreVersion, modelExecuted: false, energyJoules: null, source, fields, evidence, category, categoryCandidates: categoryMatches.map(([label]) => label), summary, summaryEvidence: summaryLines, warnings, reviewRequired: true };
}

export function validateRecordDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object") return ["Record is missing."];
  if (typeof draft.source !== "string" || !draft.source.trim() || draft.source.length > noteLimit) errors.push("Source note is required and must fit the note limit.");
  for (const field of ["title", "site", "reference"]) if (typeof draft[field] !== "string" || draft[field].length > 160) errors.push(`${field} must be at most 160 characters.`);
  if (!draft.title?.trim()) errors.push("A record title is required.");
  if (typeof draft.date !== "string" || (draft.date && !validDate(draft.date))) errors.push("Use a valid YYYY-MM-DD date or leave it empty.");
  if (!categoryLabels.includes(draft.category)) errors.push("Select a supported category.");
  if (typeof draft.summary !== "string" || draft.summary.length > noteLimit) errors.push("The summary exceeds the permitted length.");
  if (draft.reviewed !== true) errors.push("Review the record before saving it.");
  return errors;
}

export function createRecord(draft, metadata) {
  const errors = validateRecordDraft(draft);
  if (errors.length) throw new TypeError(errors.join(" "));
  if (!metadata || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(metadata.id || "")) throw new TypeError("Invalid record identifier.");
  const timestampValid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (!timestampValid(metadata.createdAt) || !timestampValid(metadata.updatedAt) || metadata.updatedAt < metadata.createdAt || !Number.isSafeInteger(metadata.version) || metadata.version < 1) throw new TypeError("Invalid record metadata.");
  return {
    schemaVersion: 1,
    id: metadata.id,
    version: metadata.version,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    title: draft.title.trim(),
    site: draft.site.trim(),
    date: draft.date,
    reference: draft.reference.trim(),
    category: draft.category,
    source: draft.source,
    summary: draft.summary,
    summaryOrigin: draft.summary === analyzeNote(draft.source).summary ? "extractive" : "user-edited",
    reviewed: true,
    engine: "rules-and-extractive",
    engineVersion: coreVersion,
    modelExecuted: false,
  };
}

export function normalizeRecord(record) {
  if (!record || record.schemaVersion !== 1 || record.engine !== "rules-and-extractive" || record.modelExecuted !== false) throw new TypeError("Unsupported record format or processing engine.");
  if (!["extractive", "user-edited"].includes(record.summaryOrigin) || !/^\d+\.\d+\.\d+$/.test(record.engineVersion || "")) throw new TypeError("Invalid processing provenance.");
  return { ...createRecord(record, record), summaryOrigin: record.summaryOrigin, engineVersion: record.engineVersion };
}

export function createBackup(records, exportedAt = new Date().toISOString()) {
  if (!Array.isArray(records) || records.length > recordLimit) throw new RangeError(`A backup supports at most ${recordLimit} records.`);
  const clean = records.map(normalizeRecord);
  if (new Set(clean.map(record => record.id)).size !== clean.length) throw new TypeError("Duplicate identifiers in backup.");
  return { kind: "pocketroute-notes-backup", schemaVersion: 1, productVersion: coreVersion, exportedAt, records: clean };
}

export function parseBackup(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > backupByteLimit) throw new RangeError("Backup exceeds the 8 MiB limit.");
  let value;
  try { value = JSON.parse(text); } catch { throw new TypeError("The selected file is not valid JSON."); }
  if (value?.kind !== "pocketroute-notes-backup" || value.schemaVersion !== 1) throw new TypeError("This is not a supported PocketRoute Notes backup.");
  return createBackup(value.records, value.exportedAt).records;
}

export function planImport(existing, incoming) {
  const known = new Map(existing.map(record => [record.id, record]));
  const additions = [];
  const conflicts = [];
  const unchanged = [];
  for (const value of incoming) {
    const record = normalizeRecord(value);
    if (!known.has(record.id)) additions.push(record);
    else {
      let same = false;
      try { same = JSON.stringify(normalizeRecord(known.get(record.id))) === JSON.stringify(record); } catch {}
      (same ? unchanged : conflicts).push(record.id);
    }
  }
  return { additions, conflicts, unchanged };
}