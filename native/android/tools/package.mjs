import "../../../scripts/cloud-only.mjs";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) delete process.env[name];
const mode = process.env.NATIVE_MODE;
if (!["android-prepare", "android"].includes(mode)) throw new Error("An explicit native verification mode is required.");
const root = resolve("native/android");
const out = join(root, "out");
await mkdir(out, { recursive: true });
const apk = join(root, "app/build/outputs/apk/debug/app-debug.apk");
const aar = join(root, "runtime/build/outputs/aar/runtime-debug.aar");
function execute(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Artifact check failed: ${program}; ${(result.stderr || "").slice(-1200)}`);
  return result.stdout;
}
const signer = execute(join(process.env.ANDROID_HOME, "build-tools/36.0.0/apksigner"), ["verify", "--verbose", "--print-certs", apk]);
const certificateSha256 = /Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})/i.exec(signer)?.[1]?.toLowerCase();
if (!certificateSha256) throw new Error("A verified APK signer fingerprint is required.");
await writeFile(join(out, "apk-signature.txt"), signer);
for (const [kind, file] of [["apk", apk], ["aar", aar]]) {
  execute("unzip", ["-tq", file]);
  const entries = execute("unzip", ["-Z1", file]).trim().split(/\r?\n/);
  const prefix = kind === "apk" ? "lib" : "jni";
  for (const abi of ["arm64-v8a", "x86_64"]) {
    for (const library of ["libonnxruntime.so", "libpocketroute_native.so"]) {
      if (!entries.includes(`${prefix}/${abi}/${library}`)) throw new Error(`Missing ${kind} native library: ${abi}/${library}`);
    }
  }
  if (entries.some(name => /\.(?:onnx|onnx_data|safetensors|gguf|jks|keystore)$/i.test(name) || /(?:^|\/)(?:tokenizer\.json|\.env[^/]*)$/.test(name))) {
    throw new Error(`Model assets or secrets entered the ${kind}.`);
  }
  for (const required of ["assets/protocol.json", "assets/POCKETROUTE_LICENSE.txt", "assets/ONNXRUNTIME_LICENSE.txt", "assets/ONNXRUNTIME_THIRD_PARTY_NOTICES.txt"]) {
    if (!entries.includes(required)) throw new Error(`Missing ${kind} provenance/license entry: ${required}`);
  }
  const protocol = JSON.parse(execute("unzip", ["-p", file, "assets/protocol.json"]));
  if (protocol.sourceSha !== process.env.GITHUB_SHA || protocol.modelRevision !== "d54957e3af1be04546436e874a60fe386041b244") throw new Error("The native artifact has stale provenance.");
}
const unitXml = await readFile(join(root, "runtime/build/test-results/testDebugUnitTest/TEST-dev.pocketroute.runtime.ProtocolTest.xml"), "utf8");
const suite = /<testsuite\b([^>]*)>/.exec(unitXml)?.[1];
if (!suite) throw new Error("The native unit report is missing.");
const number = key => {
  const value = new RegExp(`\\b${key}="(\\d+)"`).exec(suite)?.[1];
  if (value === undefined) throw new Error(`Missing unit report metric: ${key}`);
  return Number(value);
};
if (number("tests") !== 3 || number("failures") || number("errors") || number("skipped")) throw new Error("The complete native unit contract did not pass.");
const preparation = JSON.parse(await readFile(join(out, "preparation.json"), "utf8"));
if (mode === "android") {
  const verification = JSON.parse(await readFile(join(out, "android-verification.json"), "utf8"));
  if (verification.sourceSha !== process.env.GITHUB_SHA || verification.status !== "software-checks-passed") throw new Error("Native VM verification is required before packaging a VM-tested handover.");
}
const artifacts = [];
for (const [source, name] of [[apk, "pocketroute-android-lab-0.1.0-debug.apk"], [aar, "pocketroute-runtime-0.1.0-debug.aar"]]) {
  const bytes = await readFile(source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await copyFile(source, join(out, name));
  artifacts.push({ name, bytes: bytes.length, sha256 });
}
await copyFile(join(root, "README.md"), join(out, "README.md"));
await writeFile(join(out, "SHA256SUMS"), artifacts.map(artifact => `${artifact.sha256}  ${artifact.name}`).join("\n") + "\n");
const receipt = {
  schemaVersion: 1, status: mode === "android" ? "vm-tested-experimental-artifacts" : "build-only-bootstrap",
  sourceSha: process.env.GITHUB_SHA, checkedAt: new Date().toISOString(),
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  toolchain: { jdk: 17, gradle: "9.6.0", agp: "9.4.1", compileSdk: 36, buildTools: "36.0.0", ndk: "28.2.13676358", cmake: "3.22.1", onnxRuntimeAndroid: "1.31.1" },
  jvmTests: number("tests"), goldenVectors: preparation.goldenVectors, modelFiles: preparation.files,
  artifacts, apkCertificateSha256: certificateSha256, signing: "Ephemeral debug certificate; not production signing or a stable upgrade key.",
  dependencyVerification: mode === "android" ? "strict, committed SHA-256 metadata and dependency locks" : "bootstrap metadata generated; strict replay still required",
  lintPolicy: { codeAndResourceWarningsAreErrors: true, informationalUpgradeChecks: ["OldTargetApi", "AndroidGradlePluginVersion", "GradleDependency", "NewerVersionAvailable"], rationale: "Fixed available API 36 experiment and pinned compatible tools; upgrade advisories remain visible, not disabled." },
  execution: { x86_64: mode === "android" ? "Android API 36 emulator" : "not executed", arm64_v8a: "built only; not executed" },
  modelWeightsBundled: false, privateKeysBundled: false, productionReady: false, physicalDeviceValidated: false,
};
await writeFile(join(out, "build-manifest.json"), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
