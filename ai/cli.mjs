import { resolve } from "node:path";
import { createServiceClassifier } from "./client.mjs";
import { validateServiceRequest } from "./contract.mjs";

const args = process.argv.slice(2);
const permitted = new Set(["--cache", "--model", "--allow-download"]);
const values = {};
for (let index = 0; index < args.length; index += 1) {
  const name = args[index];
  if (!permitted.has(name)) throw new Error("Use --cache DIRECTORY [--model qwen-0.5b|qwen-1.5b] [--allow-download]. Pass the request as JSON on stdin.");
  if (name === "--allow-download") values[name] = true;
  else { if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing value for ${name}.`); values[name] = args[++index]; }
}
if (!values["--cache"] || !values["--model"]) throw new Error("Explicit --cache and --model values are required. Model downloads require --allow-download.");
let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  input += chunk.toString("utf8");
  if (Buffer.byteLength(input, "utf8") > 12000) throw new Error("Input JSON is too large.");
}
const request = JSON.parse(input);
const text = validateServiceRequest(request.text);
const engine = await createServiceClassifier({ model: values["--model"], cacheDir: resolve(values["--cache"]), allowDownload: values["--allow-download"] === true });
try { console.log(JSON.stringify(await engine.classify(text), null, 2)); }
finally { await engine.close(); }