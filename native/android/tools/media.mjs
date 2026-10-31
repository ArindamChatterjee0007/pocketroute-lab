import "../../../scripts/cloud-only.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import sharp from "sharp";
import { fetchEvidence } from "../../../scripts/evidence-fetch.mjs";
import { emulatorClient, provisionModel } from "./emulator.mjs";

for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) delete process.env[name];
const sourceSha = "ea48bb38df3197d5012f24f7a6a8394e6ee8a11f";
const apkSha256 = "8b75134bafc277fa2c54837ef95b2eae5b6539aa3f039936033129325834f5b5";
const release = "https://github.com/ArindamChatterjee0007/pocketroute-lab/releases/download/android-vm-0.1.0/";
const directory = resolve("native/android/out/media");
await mkdir(directory, { recursive: true });
const result = await fetchEvidence(`${release}pocketroute-android-lab-0.1.0-debug.apk`, url => fetch(url, { signal: AbortSignal.timeout(180000) }));
if (result.response.status !== 200) throw new Error(`Verified APK retrieval failed: HTTP ${result.response.status}`);
const bytes = Buffer.from(await result.response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== apkSha256) throw new Error("The release APK differs from the fully verified binary.");
const apk = join(process.env.RUNNER_TEMP, "pocketroute-verified.apk");
await writeFile(apk, bytes);
const device = emulatorClient();
const adb = device.command;
provisionModel(device, apk);
const sizeText = adb(["shell", "wm", "size"]);
const size = /Override size:\s*(\d+)x(\d+)/.exec(sizeText) || /Physical size:\s*(\d+)x(\d+)/.exec(sizeText);
if (!size) throw new Error("The emulator display dimensions were not reported.");
const width = Number(size[1]);
const height = Number(size[2]);
if (width < 720 || height < 1280) throw new Error("High-resolution captures require at least a 720 x 1280 emulator display.");
const decodeXml = value => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number(code))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function hierarchy() {
  adb(["shell", "uiautomator", "dump", "/data/local/tmp/pocketroute-media.xml"]);
  const xml = adb(["exec-out", "cat", "/data/local/tmp/pocketroute-media.xml"]);
  if (!xml.includes("<hierarchy")) throw new Error("The Android UI hierarchy is unavailable.");
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], decodeXml(attribute[2])])));
}

function nodeFor(nodes, id) {
  return nodes.find(node => node["resource-id"] === `dev.pocketroute.lab:id/${id}`);
}

function bounds(node) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(node?.bounds || "");
  if (!match) return null;
  const [, left, top, right, bottom] = match.map(Number);
  return right > left && bottom > top && left >= 0 && top >= 0 && right <= width && bottom <= height ? { left, top, right, bottom } : null;
}

async function visible(id, timeout = 25000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const node = nodeFor(hierarchy(), id);
    if (bounds(node)) return node;
    adb(["shell", "input", "swipe", String(Math.round(width * 0.5)), String(Math.round(height * 0.78)), String(Math.round(width * 0.5)), String(Math.round(height * 0.3)), "350"]);
    await pause(250);
  }
  throw new Error(`The required UI control was not visible: ${id}`);
}

async function tap(id) {
  const node = await visible(id);
  if (node.enabled !== "true") throw new Error(`The required UI control is disabled: ${id}`);
  const rectangle = bounds(node);
  adb(["shell", "input", "tap", String(Math.round((rectangle.left + rectangle.right) / 2)), String(Math.round((rectangle.top + rectangle.bottom) / 2))]);
}

async function waitText(id, prefix, timeout) {
  const deadline = Date.now() + timeout;
  let latest = "";
  while (Date.now() < deadline) {
    const nodes = hierarchy();
    const node = nodeFor(nodes, id);
    latest = node?.text || "";
    if (latest.startsWith(prefix)) return latest;
    const status = nodeFor(nodes, "status")?.text || "";
    if (/Exception|deadline expired|could not|not confirmed|exited before/i.test(status)) throw new Error(`Native UI failed: ${status}`);
    await pause(500);
  }
  throw new Error(`Native UI did not reach ${prefix}; last value: ${latest}`);
}

async function capture(name, id, expected) {
  await visible(id);
  await pause(500);
  const nodes = hierarchy();
  const node = nodeFor(nodes, id);
  if (!bounds(node) || !node.text.startsWith(expected)) throw new Error(`Capture would omit its required content: ${name}`);
  const image = adb(["exec-out", "screencap", "-p"], { encoding: null, maxBuffer: 16 * 1024 * 1024 });
  const metadata = await sharp(image).metadata();
  if (metadata.format !== "png" || metadata.width !== width || metadata.height !== height) throw new Error("Unexpected emulator capture dimensions or format.");
  await writeFile(join(directory, name), image);
  return { path: name, width, height, sha256: createHash("sha256").update(image).digest("hex"), visibleContent: node.text, caption: "Android emulator / synthetic request. Not a physical-phone photograph or benchmark." };
}

adb(["shell", "am", "start", "-n", "dev.pocketroute.lab/.MainActivity"]);
await tap("load_model");
await waitText("status", "Ready.", 185000);
const images = [await capture("android-vm-ready.png", "status", "Ready.")];
await tap("request");
adb(["shell", "input", "text", "The%sworkshop%spump%sstopped%srunning.%sPlease%ssend%ssomeone%sto%sfix%sit."]);
if (/mInputShown=true/.test(adb(["shell", "dumpsys", "input_method"]))) adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
await tap("classify");
await visible("result");
const resultText = await waitText("result", "Suggestion:", 25000);
images.push(await capture("android-vm-result.png", "result", "Suggestion:"));
await tap("stop");
await waitText("status", "Worker stopped", 5000);

const poster = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1120">
<rect width="1200" height="1120" fill="#0b0e10"/><rect x="28" y="28" width="1144" height="1064" rx="26" fill="#101819" stroke="#29423a"/>
<g font-family="DejaVu Sans,sans-serif"><text x="60" y="88" font-size="29" fill="#a0f1c8">POCKETROUTE / ANDROID LAB</text>
<text x="60" y="126" font-size="18" fill="#eac27d">EXPERIMENTAL - ANDROID EMULATOR, NOT A PHYSICAL PHONE</text>
<text x="550" y="215" font-size="32" fill="#eef5f1">Native port verified</text>
<text x="550" y="310" font-size="74" fill="#a0f1c8">96 / 96</text>
<text x="550" y="350" font-size="21" fill="#bdcac4">frozen reference outputs matched</text>
<text x="550" y="442" font-size="46" fill="#eac27d">73 / 96 correct</text>
<text x="550" y="480" font-size="23" fill="#eac27d">76.0% - quality gate still FAILED</text>
<text x="550" y="550" font-size="22" fill="#eef5f1">160 tokenizer / protocol vectors</text>
<text x="550" y="590" font-size="22" fill="#eef5f1">Offline app and worker-stop checks</text>
<text x="550" y="630" font-size="22" fill="#eef5f1">API 36 / x86_64 / 8 GiB VM</text>
<text x="550" y="710" font-size="20" fill="#bdcac4">No new independent accuracy claim.</text>
<text x="550" y="745" font-size="20" fill="#bdcac4">Phone performance and energy:</text>
<text x="550" y="780" font-size="23" fill="#eac27d">NOT MEASURED</text>
<text x="550" y="860" font-size="19" fill="#bdcac4">Actual app capture / synthetic request.</text>
<text x="60" y="1030" font-size="17" fill="#bdcac4">App source: ea48bb38df31 - Full verification: GitHub run 41203062823</text>
<text x="60" y="1062" font-size="16" fill="#bdcac4">Exact released APK; capture run ${process.env.GITHUB_RUN_ID}. No weights bundled. Human review required.</text></g></svg>`;
const screen = await sharp(await readFile(join(directory, "android-vm-result.png"))).resize({ width: 430, height: 850, fit: "inside", withoutEnlargement: true }).png().toBuffer();
const graphic = await sharp(Buffer.from(poster)).composite([{ input: screen, left: 60, top: 160 }]).png().toBuffer();
await writeFile(join(directory, "android-vm-summary.png"), graphic);
images.push({ path: "android-vm-summary.png", width: 1200, height: 1120, sha256: createHash("sha256").update(graphic).digest("hex"), caption: "Designed technical summary containing an actual emulator capture. Reference parity is not correctness or phone qualification." });
const receipt = {
  schemaVersion: 1, status: "passed", checkedAt: new Date().toISOString(),
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  captureSourceSha: process.env.GITHUB_SHA, appSourceSha: sourceSha, apkSha256,
  binaryRebuilt: false, releaseTagMoved: false, executionKind: "simulator", emulatorProfile: "pixel_6",
  apiLevel: device.apiLevel, architecture: "x86_64", configuredRamMiB: 8192,
  additionalSyntheticUiRequests: 1, frozenRegressionSuiteRerun: false,
  resultText, explicitWorkerUnloadObserved: true, physicalDeviceValidated: false,
  retrievalRetries: result.retries, images,
};
await writeFile(join(directory, "media-verification.json"), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
