import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { chromium, webkit, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile, mkdtemp } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const base = "https://arindamchatterjee007.github.io/pocketroute-lab/";
const expectedSource = process.env.EXPECTED_SOURCE;
if (!/^[a-f0-9]{40}$/.test(expectedSource || "")) throw new Error("An exact expected source SHA is required for live verification.");
const response = await fetch(`${base}publication.json?source=${expectedSource}`, { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200);
const publication = await response.json();
assert.equal(publication.sourceSha, expectedSource);
assert.equal(publication.stage, "prepublication-checks-passed");
const assets = publication.inventory.filter(item => !item.path.startsWith("evidence/"));
let bundleBytes;
for (const asset of assets) {
  assert.ok(!asset.path.includes("..") && !asset.path.startsWith("/"));
  const assetResponse = await fetch(`${base}${asset.path}?source=${expectedSource}`, { signal: AbortSignal.timeout(30000) });
  assert.equal(assetResponse.status, 200, asset.path);
  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  assert.equal(bytes.length, asset.bytes, `${asset.path} length`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.path} digest`);
  if (asset.path === "downloads/pocketroute-notes-0.2.0.zip") bundleBytes = bytes;
}
assert.ok(bundleBytes, "The product bundle is absent from the publication.");
const bundleDirectory = await mkdtemp(join(process.env.RUNNER_TEMP, "pocketroute-release-"));
const bundlePath = join(bundleDirectory, "product.zip");
await writeFile(bundlePath, bundleBytes);
execFileSync("unzip", ["-tq", bundlePath], { stdio: "inherit" });
const bundleEntries = execFileSync("unzip", ["-Z1", bundlePath], { encoding: "utf8" }).trim().split(/\r?\n/);
for (const required of ["notes/index.html", "notes/notes.js", "notes/sw.js", "notes/manifest.webmanifest", "notes/guide.html", "LICENSE.txt", "THIRD_PARTY_NOTICES.txt", "downloads/pocketroute-core.mjs", "downloads/README.md"]) assert.ok(bundleEntries.includes(required), `Missing bundle file: ${required}`);
assert.ok(bundleEntries.every(name => !name.startsWith("/") && !name.split("/").includes("..") && !/^(data|\.git|\.local|node_modules)\//.test(name)), "Unexpected private or nonportable bundle path.");
const configurations = [
  { engine: "chromium", width: 1440, height: 1000 },
  { engine: "chromium", width: 390, height: 844 },
  { engine: "chromium", width: 320, height: 740 },
  { engine: "webkit", width: 390, height: 844 },
];
const results = [];
for (const configuration of configurations) {
  const browser = await ({ chromium, webkit })[configuration.engine].launch();
  try {
    const context = await browser.newContext({ viewport: { width: configuration.width, height: configuration.height }, reducedMotion: "reduce", isMobile: configuration.width < 600, hasTouch: configuration.width < 600 });
    const page = await context.newPage();
    const errors = [];
    const outsideRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (!request.url().startsWith(base) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outsideRequests.push(request.url()); });
    await page.goto(`${base}#overview`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.getByRole("heading", { level: 1, name: "PocketRoute overview", exact: true })).toBeVisible();
    await expect(page.locator("#evidence-status")).toContainText("Cloud checks recorded");
    for (const view of ["overview", "execution", "lab", "sessions", "evidence", "roadmap"]) {
      await page.goto(`${base}#${view}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#workspace h1")).toHaveText({ overview: "PocketRoute overview", execution: "Execution board", lab: "Model lab", sessions: "Research sessions", evidence: "Evidence library", roadmap: "Research roadmap" }[view]);
      assert.equal(await page.evaluate(() => innerWidth), configuration.width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${view} overflow`);
    }
    await page.goto(`${base}#lab`, { waitUntil: "domcontentloaded" });
    await page.locator("#lab-input").fill("Extract the date from the synthetic inspection note.");
    await page.getByRole("button", { name: "Preview route", exact: true }).click();
    await expect(page.locator("#route-output")).toContainText("Structured fields");
    await page.getByRole("tab", { name: "Cloud evidence", exact: true }).click();
    await expect(page.locator(".cloud-case")).toHaveCount(8);
    await expect(page.locator("#workspace")).toContainText("8 / 8 exact labels");
    await page.goto(`${base}notes/`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Field-note workbench" })).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-storage", "ready");
    await expect(page.locator("body")).toHaveAttribute("data-offline-ready", "true");
    const sdk = await page.evaluate(async () => {
      const core = await import("../downloads/pocketroute-core.mjs");
      const result = core.analyzeNote("Site: Cloud-check\nDate: 2026-10-29\nTwo filters need replacement.");
      return { site: result.fields.site, summary: result.summary, modelExecuted: result.modelExecuted, version: core.coreVersion };
    });
    assert.deepEqual(sdk, { site: "Cloud-check", summary: "Two filters need replacement.", modelExecuted: false, version: "0.2.0" });
    await page.locator("#source-note").fill("Site: Live-synthetic\nDate: 2026-10-29\nTwo filters need replacement.");
    await page.getByRole("button", { name: "Prepare record", exact: true }).click();
    await expect(page.locator("#record-site")).toHaveValue("Live-synthetic");
    await expect(page.getByRole("button", { name: "Save reviewed record", exact: true })).toBeDisabled();
    await page.locator("#review-confirmed").check();
    await page.getByRole("button", { name: "Save reviewed record", exact: true }).click();
    await expect(page.locator("#draft-state")).toHaveText("Saved locally");
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#record-count")).toHaveText("1");
    await page.locator(".saved-record").click();
    await expect(page.locator("#record-site")).toHaveValue("Live-synthetic");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Backup JSON", exact: true }).click()]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(backup.records[0].site, "Live-synthetic");
    await page.getByRole("button", { name: "Storage and privacy", exact: true }).click();
    await page.getByRole("button", { name: "Clear all local records", exact: true }).click();
    await page.getByRole("button", { name: "Clear records", exact: true }).click();
    await expect(page.locator("#record-count")).toHaveText("0");
    await context.setOffline(false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "Notes overflow");
    assert.deepEqual(errors, []);
    assert.deepEqual(outsideRequests, []);
    results.push({ ...configuration, views: 7, policyPreview: "passed", recordedModelCases: 8, notesLifecycle: "passed", offlineReload: "passed", standaloneSdk: "passed", privateBackup: "passed", confirmedLocalDeletion: "passed", outsideRequests: 0, pageErrors: 0, status: "passed" });
  } finally { await browser.close(); }
}
const receipt = { schemaVersion: 1, status: "passed", checkedAt: new Date().toISOString(), url: base, productUrl: `${base}notes/`, sourceSha: expectedSource, runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`, artifactFilesVerified: assets.length, artifactHashAlgorithm: "SHA-256", bundleIntegrity: "passed", bundleEntries: bundleEntries.length, configurations: results, modelRerun: false, phoneBenchmark: false, energyJoules: null, localBuildsOrTests: 0 };
await writeFile("data/live-verification.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));