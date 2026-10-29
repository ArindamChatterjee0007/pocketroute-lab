import Papa from "papaparse";
import { normalizeRecord } from "../app/note-core.mjs";

export function recordsToCsv(records) {
  const columns = ["Record ID", "Title", "Site", "Visit date", "Reference", "Category", "Summary", "Original note", "Summary origin", "Reviewed", "Updated UTC"];
  return Papa.unparse({ fields: columns, data: records.map(value => {
    const record = normalizeRecord(value);
    return [record.id, record.title, record.site, record.date, record.reference, record.category, record.summary, record.source, record.summaryOrigin, "yes", record.updatedAt];
  }) }, { quotes: true, newline: "\r\n", escapeFormulae: /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/ });
}