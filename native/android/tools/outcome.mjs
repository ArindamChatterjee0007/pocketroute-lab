import "../../../scripts/cloud-only.mjs";
import { mkdir, writeFile } from "node:fs/promises";

if (!["success", "failure", "cancelled"].includes(process.env.NATIVE_JOB_STATUS)) throw new Error("An explicit GitHub job outcome is required.");
const directory = process.env.NATIVE_MODE === "android-media" ? "native/android/out/media" : "native/android/out";
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/job-outcome.json`, JSON.stringify({
  schemaVersion: 1,
  jobStatus: process.env.NATIVE_JOB_STATUS,
  mode: process.env.NATIVE_MODE,
  sourceSha: process.env.GITHUB_SHA,
  runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  recordedAt: new Date().toISOString(),
  scope: "Job execution metadata only. Consult actual build, test and VM receipts; this is not a qualification result.",
}, null, 2));
