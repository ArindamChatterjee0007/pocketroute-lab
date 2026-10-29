import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { chromium, webkit, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = "https://arindamchatterjee007.github.io/pocketroute-lab/";
const expectedSource = process.env.EXPECTED_SOURCE;
if (!/^[a-f0-9]{40}$/.test(expectedSource || "")) throw new Error("An exact expected source SHA is required for live verification.");
const response = await fetch(`${base}publication.json?source=${expectedSource}`, { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200);
const publication = await response.json();
assert.equal(publication.sourceSha, expectedSource);
assert.equal(publication.stage, "prepublication-checks-passed");
const assets = publication.inventory.filter(item => !item.path.startsWith("evidence/"));
for (const asset of assets) {
  assert.ok(!asset.path.includes("..") && !asset.path.startsWith("/"));
  const assetResponse = await fetch(`${base}${asset.path}?source=${expectedSource}`, { signal: AbortSignal.timeout(30000) });
  assert.equal(assetResponse.status, 200, asset.path);
  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  assert.equal(bytes.length, asset.bytes, `${asset.path} length`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.path} digest`);
}
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
    assert.deepEqual(errors, []);
    assert.deepEqual(outsideRequests, []);
    results.push({ ...configuration, views: 6, policyPreview: "passed", recordedModelCases: 8, outsideRequests: 0, pageErrors: 0, status: "passed" });
  } finally { await browser.close(); }
}
const receipt = { schemaVersion: 1, status: "passed", checkedAt: new Date().toISOString(), url: base, sourceSha: expectedSource, runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`, artifactFilesVerified: assets.length, artifactHashAlgorithm: "SHA-256", configurations: results, modelRerun: false, phoneBenchmark: false, energyJoules: null, localBuildsOrTests: 0 };
await writeFile("data/live-verification.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));