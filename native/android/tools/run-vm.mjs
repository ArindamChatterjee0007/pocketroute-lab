import "../../../scripts/cloud-only.mjs";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { evaluateDeviceReport } from "../../../ai/device-report.mjs";
import { emulatorClient, provisionModel } from "./emulator.mjs";

for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) delete process.env[name];
const root = resolve("native/android");
const out = join(root, "out");
await mkdir(out, { recursive: true });
const device = emulatorClient();
const { serial, apiLevel } = device;
provisionModel(device, join(root, "app/build/outputs/apk/debug/app-debug.apk"));
const test = spawnSync("./gradlew", ["--no-daemon", "--dependency-verification", "strict", "-Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true", ":app:connectedDebugAndroidTest"], {
  cwd: root, env: { ...process.env, ANDROID_SERIAL: serial }, stdio: "inherit", timeout: 2100000,
});
const required = ["vm-contract.json", "vm-report.json", "vm-lifecycle.json", "vm-ui.json", "vm-setup.png", "vm-result.png"];
const missing = [];
for (const name of required) {
  const result = spawnSync("adb", ["-s", serial, "exec-out", "run-as", "dev.pocketroute.lab", "cat", `files/${name}`], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  if (result.status === 0 && result.stdout?.length) await writeFile(join(out, name), result.stdout);
  else missing.push(name);
}
const log = spawnSync("adb", ["-s", serial, "logcat", "-d", "-s", "AndroidRuntime:E", "libc:F", "PocketRoute:E"], { timeout: 30000, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
if (log.status !== 0) throw new Error("Android diagnostic collection failed.");
await writeFile(join(out, "vm-log.txt"), log.stdout);
if (missing.length) throw new Error(`Native VM reports were not produced: ${missing.join(", ")}; instrumentation exit ${test.status ?? test.error?.code}.`);
const report = JSON.parse(await readFile(join(out, "vm-report.json"), "utf8"));
if (report.appSourceSha !== process.env.GITHUB_SHA || report.executionKind !== "simulator") throw new Error("The VM report has stale or non-emulator provenance.");
const reference = JSON.parse(await readFile(join(out, "reference.json"), "utf8"));
const assessment = evaluateDeviceReport(reference, report);
await writeFile(join(out, "vm-assessment.json"), JSON.stringify(assessment, null, 2));
if (test.error || test.status !== 0 || report.cases.length !== 96 || report.cases.some(entry => entry.outcome !== "completed")) throw new Error("Android instrumentation did not complete every required software check.");
for (const name of ["vm-contract.json", "vm-lifecycle.json", "vm-ui.json"]) {
  const receipt = JSON.parse(await readFile(join(out, name), "utf8"));
  if (receipt.status !== "passed") throw new Error(`Android software gate failed: ${name}`);
}
const receipt = {
  schemaVersion: 1, status: "software-checks-passed", sourceSha: process.env.GITHUB_SHA,
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  checkedAt: new Date().toISOString(), executionKind: "simulator", emulatorSerial: serial,
  apiLevel, architecture: "x86_64", configuredRamMiB: 8192, exposedRegressionCases: report.cases.length,
  actualNativeModelCalls: report.cases.filter(entry => entry.result?.modelExecuted === true).length,
  parity: assessment.parity, nonRegression: assessment.nonRegression,
  syntheticQualityScreen: assessment.syntheticQualityScreen,
  aggregatePeakMemoryBytes: null, energyJoules: null, physicalDeviceValidated: false,
  humanLabelledQualityValidated: false, productionReady: false, localBuildsOrTests: 0,
};
await writeFile(join(out, "android-verification.json"), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
