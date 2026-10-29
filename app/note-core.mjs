export const coreVersion = "0.2.0";
export const noteLimit = 12000;
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