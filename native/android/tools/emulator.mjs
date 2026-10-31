import "../../../scripts/cloud-only.mjs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function execute(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${program} failed (${result.status ?? result.error?.code}): ${String(result.stderr || "").slice(-1000)}`);
  return result.stdout;
}

export function selectEmulator(output) {
  const lines = output.trim().split(/\r?\n/);
  if (lines[0] !== "List of devices attached") throw new Error("Unrecognized ADB inventory.");
  const devices = lines.slice(1).map(line => line.trim()).filter(Boolean);
  if (devices.length !== 1 || !/^emulator-\d+\s+device$/.test(devices[0])) throw new Error("Exactly one ready emulator is required; physical, offline and ambiguous targets are rejected.");
  return devices[0].split(/\s/)[0];
}

export function emulatorClient() {
  const serial = selectEmulator(execute("adb", ["devices"]));
  const command = (args, options = {}) => execute("adb", ["-s", serial, ...args], options);
  if (command(["shell", "getprop", "ro.kernel.qemu"]).trim() !== "1") throw new Error("The target did not identify itself as an emulator.");
  const apiLevel = Number(command(["shell", "getprop", "ro.build.version.sdk"]).trim());
  if (apiLevel !== 36) throw new Error("The pinned Android API 36 emulator is required.");
  return { serial, apiLevel, command };
}

export function provisionModel(device, apk) {
  const adb = device.command;
  adb(["install", apk]);
  adb(["shell", "svc", "wifi", "disable"]);
  adb(["shell", "svc", "data", "disable"]);
  const staging = "/data/local/tmp/pocketroute-android-model";
  adb(["shell", "mkdir", "-p", staging]);
  adb(["shell", "run-as", "dev.pocketroute.lab", "mkdir", "-p", "files/model"]);
  for (const name of ["model_q4.onnx", "tokenizer.json"]) {
    adb(["push", join(process.env.RUNNER_TEMP, "pocketroute-android-model", name), `${staging}/${name}`]);
    adb(["shell", "run-as", "dev.pocketroute.lab", "cp", `${staging}/${name}`, `files/model/${name}`]);
    adb(["shell", "rm", `${staging}/${name}`]);
  }
  adb(["shell", "rmdir", staging]);
}
