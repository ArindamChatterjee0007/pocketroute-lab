import { readFile, stat } from "node:fs/promises";
import { evaluateDeviceReport } from "./device-report.mjs";

try {
  const [referencePath, reportPath, mode = "parity", ...extra] = process.argv.slice(2);
  if (!referencePath || !reportPath || extra.length || !["parity", "non-regression"].includes(mode)) throw new Error("Usage: node validate-device-report.mjs reference.json report.json [parity|non-regression]");
  for (const path of [referencePath, reportPath]) if ((await stat(path)).size > 2 * 1024 * 1024) throw new Error("Report/reference exceeds the 2 MiB limit.");
  const reference = JSON.parse(await readFile(referencePath, "utf8"));
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const assessment = evaluateDeviceReport(reference, report);
  console.log(JSON.stringify(assessment, null, 2));
  process.exitCode = (mode === "parity" ? assessment.parity.passed : assessment.nonRegression.passed) ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ status: "invalid-report", message: error instanceof SyntaxError ? "Invalid JSON." : String(error.message).replace(/\/[^\s]+/g, "[path]").slice(0, 250), productionReady: false }));
  process.exitCode = 2;
}