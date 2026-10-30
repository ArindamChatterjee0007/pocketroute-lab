import "../scripts/cloud-only.mjs";
import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import { assertPublicContent } from "../scripts/public-content.mjs";

const views = [
  ["overview", "PocketRoute overview"],
  ["execution", "Execution board"],
  ["lab", "Model lab"],
  ["service", "Service AI"],
  ["sessions", "Research sessions"],
  ["evidence", "Evidence library"],
  ["roadmap", "Research roadmap"],
];

async function openView(page, view) {
  await page.goto(`/#${view}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#evidence-status")).toContainText("Published snapshot");
  await page.evaluate(() => document.fonts.ready);
}

async function checkLayout(page) {
  const result = await page.evaluate(() => {
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" && !element.closest("[hidden]");
    return {
      actualWidth: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      clipped: [...document.querySelectorAll("h1,h2,h3,p,button,label,td,th")].filter(element => visible(element) && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2 && !element.closest(".table-wrapper")).map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 80), width: element.clientWidth, scroll: element.scrollWidth })),
      missingImages: [...document.images].filter(element => visible(element) && (!element.complete || element.naturalWidth === 0)).map(element => element.getAttribute("src")),
    };
  });
  expect(result.pageWidth, JSON.stringify(result)).toBeLessThanOrEqual(result.actualWidth + 1);
  expect(result.clipped, JSON.stringify(result)).toEqual([]);
  expect(result.missingImages).toEqual([]);
}

for (const [view, title] of views) test(`${view} is nonblank, responsive and self-contained`, async ({ page }, testInfo) => {
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:4173/") && !request.url().startsWith("data:")) externalRequests.push(request.url()); });
  await openView(page, view);
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => innerWidth)).toBe(testInfo.project.use.viewport.width);
  await checkLayout(page);
  assertPublicContent(await page.locator("body").innerText(), view);
  if (view === "overview" && testInfo.project.use.viewport.width < 561) expect(await page.locator(".recent-sessions").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  if (["desktop", "phone"].includes(testInfo.project.name)) {
    await mkdir("test-results/screenshots", { recursive: true });
    const filename = `test-results/screenshots/${view}-${testInfo.project.name}.png`;
    await page.screenshot({ path: filename, fullPage: true, caret: "initial" });
    const stats = await sharp(filename).stats();
    expect(stats.channels.some(channel => channel.stdev > 15)).toBe(true);
    await sharp(filename).resize({ width: testInfo.project.name === "desktop" ? 1000 : 390 }).png().toFile(`test-results/screenshots/${view}-${testInfo.project.name}-review.png`);
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("navigation works with keyboard and a closed mobile drawer", async ({ page }, testInfo) => {
  await openView(page, "overview");
  const mobile = testInfo.project.use.viewport.width < 781;
  if (mobile) {
    await expect(page.locator("#sidebar")).toHaveCSS("visibility", "hidden");
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.locator(".workspace-shell")).toHaveJSProperty("inert", true);
  }
  await page.locator(".nav-link[href='#execution']").click();
  await expect(page.getByRole("heading", { level: 1, name: "Execution board" })).toBeVisible();
  await expect(page.locator(".workspace-shell")).toHaveJSProperty("inert", false);
  if (mobile) {
    await expect(page.locator("#navigation-backdrop")).toBeHidden();
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#sidebar")).toHaveCSS("visibility", "hidden");
  }
  await checkLayout(page);
});

test("task filters, detail dialog and personal notes persist safely", async ({ page }) => {
  await openView(page, "execution");
  await page.getByLabel("Filter tasks by status").selectOption("done");
  await expect(page.locator(".task-card")).toHaveCount(5);
  await page.locator('[data-task="B03-001"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const note = 'Synthetic personal note <img src=x onerror="window.noteExecuted=true">';
  await page.locator("#personal-note").fill(note);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Personal note saved in this browser");
  await page.getByRole("button", { name: "Close details" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#evidence-status")).toContainText("Published snapshot");
  await page.locator('[data-task="B03-001"]').click();
  await expect(page.locator("#personal-note")).toHaveValue(note);
  expect(await page.evaluate(() => window.noteExecuted)).toBeUndefined();
  await page.getByRole("button", { name: "Clear note", exact: true }).click();
  await expect(page.locator("#personal-note")).toHaveValue("");
  await page.keyboard.press("Escape");
  await page.getByLabel("Filter tasks by project").selectOption("b01");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await expect(page.locator(".task-card")).toContainText("Publish PocketRoute Notes alpha");
  await page.getByLabel("Filter tasks by status").selectOption("blocked");
  await expect(page.getByRole("heading", { name: "No matching public tasks" })).toBeVisible();
});

test("policy workbench routes, abstains and respects scenario floors", async ({ page }) => {
  await openView(page, "lab");
  await page.locator("#lab-input").fill("Extract the date and site ID from this visit.");
  await page.getByRole("button", { name: "Preview route", exact: true }).click();
  await expect(page.locator("#route-output h3").last()).toHaveText("Structured fields");
  await expect(page.locator("#route-output")).toContainText("NO MODEL EXECUTED");
  await page.locator("#lab-battery").focus();
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Preview route", exact: true }).click();
  await expect(page.locator("#route-output")).toContainText("below the illustrative resource floor");
  await page.locator("#lab-input").fill("Make a purchase and send an email.");
  await page.getByRole("button", { name: "Preview route", exact: true }).click();
  await expect(page.locator("#route-output")).toContainText("outside the three supported task types");
  await page.getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("METADATA / NOT A PERFORMANCE BENCHMARK");
  await checkLayout(page);
});

test("workspace search, source filters and engineering roadmap work", async ({ page }) => {
  await openView(page, "overview");
  await page.getByRole("searchbox", { name: "Search workspace" }).fill("B03-004");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator(".search-result").click();
  await expect(page.getByRole("dialog")).toContainText("Verify device and release readiness");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await openView(page, "evidence");
  await page.getByLabel("Source category").selectOption("Measurement");
  await expect(page.locator(".source-row")).toHaveCount(3);
  await openView(page, "roadmap");
  await expect(page.locator(".roadmap-step")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Device manual (PDF)", exact: true })).toBeVisible();
  await expect(page.locator("[data-economics]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/commercial scenario|contribution margin|pilot price|funded pilot/i);
});

test("export is a real public JSON download without personal notes", async ({ page }) => {
  await openView(page, "overview");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export snapshot", exact: true }).click()]);
  const file = await download.path();
  const data = JSON.parse(await readFile(file, "utf8"));
  expect(data.privateCustomerDataIncluded).toBe(false);
  expect(data.tasks).toHaveLength(12);
  expect(data.projects).toHaveLength(3);
  expect(data.units).toBeUndefined();
  expect(data.scope).toBe("technical-work-only");
  expect(JSON.stringify(data)).not.toMatch(/business units?|direct-client|revenue|funded pilot|pilot price|support reserve|contribution margin/i);
  expect(data.personalNotes).toBeUndefined();
});

test("cloud evidence preserves model outputs, baseline and downloadable receipt", async ({ page }, testInfo) => {
  await openView(page, "lab");
  const receipt = await page.evaluate(async () => (await fetch("./data/slm-results.json")).json());
  expect(receipt.status).toBe("completed");
  await page.getByRole("tab", { name: "Cloud evidence", exact: true }).click();
  await expect(page.locator(".cloud-case")).toHaveCount(receipt.cases.length);
  await expect(page.locator(".cloud-case .case-output").first()).toHaveText(receipt.cases[0].output);
  const expectedMatches = receipt.cases.filter(item => item.routeCorrect).length;
  const baselineMatches = receipt.cases.filter(item => item.ruleBaselineCorrect).length;
  await expect(page.locator(".metric-value").nth(1)).toHaveText(`${expectedMatches} / ${receipt.cases.length}`);
  await expect(page.locator("#workspace")).toContainText(`${baselineMatches} / ${receipt.cases.length} exact labels`);
  await expect(page.locator("#workspace")).toContainText("Phone energy");
  await checkLayout(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "JSON receipt", exact: true }).click()]);
  const downloaded = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(downloaded).toEqual(receipt);
  if (["desktop", "phone"].includes(testInfo.project.name)) {
    await mkdir("test-results/screenshots", { recursive: true });
    const bytes = await page.screenshot({ fullPage: true, caret: "initial" });
    await sharp(bytes).resize({ width: testInfo.project.name === "desktop" ? 1000 : 390 }).png().toFile(`test-results/screenshots/cloud-model-${testInfo.project.name}-review.png`);
  }
});

test("missing evidence remains visibly unavailable, never a fake pass", async ({ page }) => {
  await page.route("**/data/*.json", route => route.abort());
  await page.goto("/#evidence", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#evidence-status")).toContainText("Evidence unavailable");
  await expect(page.locator("#workspace")).toContainText("No receipt");
  await expect(page.locator("#workspace")).not.toContainText("Checks passed");
  await expect(page.locator(".source-row")).toHaveCount(19);
});

test("real service AI evidence preserves blocked quality and exact exported results", async ({ page }) => {
  await openView(page, "service");
  const receipt = await page.evaluate(async () => (await fetch("./data/ai-service-results.json")).json());
  await expect(page.locator("#service-ai-evidence")).toContainText("Release qualification blocked");
  await expect(page.locator("#service-ai-evidence")).toContainText("73 / 96");
  await expect(page.locator("#service-ai-evidence")).toContainText("80.3%");
  await expect(page.locator("#service-ai-evidence")).toContainText("5.42 GiB");
  await expect(page.locator("#service-ai-evidence")).toContainText("System accuracy, not pure-model accuracy");
  await expect(page.locator("#service-ai-evidence")).toContainText("94 / 2");
  await expect(page.getByRole("link", { name: "Device manual (PDF)", exact: true })).toBeVisible();
  await expect(page.locator("#service-ai-evidence .cloud-case")).toHaveCount(23);
  await checkLayout(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export AI receipt", exact: true }).click()]);
  const report = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(report.status).toBe("completed");
  expect(report).toEqual(receipt);
  expect(report.pilotScreen.passed).toBe(false);
  expect(report.metrics.correct).toBe(73);
  expect(report.testCases).toHaveLength(96);
  expect(report.userAccuracyTarget.met).toBe(false);
  expect(report.protocol.confirmationUse).toBe("exact-protocol-reproduction-after-budget-interruption");
  expect(report.runtimeChecks.cancellationStopsProcess).toBe(true);
  expect(report.phoneEnergyJoules).toBeNull();
  const [kit] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Device test kit", exact: true }).click()]);
  expect(kit.suggestedFilename()).toBe("pocketroute-device-test-kit-0.1.0.zip");
  expect((await readFile(await kit.path())).subarray(0, 4).toString("hex")).toBe("504b0304");
  await expect(page.getByRole("link", { name: "India showcase (PDF)", exact: true })).toHaveCount(0);
  for (const [label, filename] of [["Device manual (PDF)", "pocketroute-device-integration.pdf"], ["SDK reference (PDF)", "pocketroute-sdk-reference.pdf"]]) {
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: label, exact: true }).click()]);
    expect(pdf.suggestedFilename()).toBe(filename);
    expect((await readFile(await pdf.path())).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("missing service AI receipt never implies model readiness", async ({ page }) => {
  await page.route("**/data/ai-service-results.json", route => route.abort());
  await page.goto("/#service", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#workspace")).toContainText("AI service evidence unavailable");
  await expect(page.locator("#workspace")).not.toContainText("73 / 96");
});

test("successful receipt state is readable and links to the correct project", async ({ page }) => {
  await page.route("**/data/verification.json", route => route.fulfill({ json: { schemaVersion: 1, stage: "prepublication-checks-passed", checkedAt: "2026-10-30T00:00:00Z", sourceSha: "0123456789abcdef", runUrl: "https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/1", unitTests: 15, browserTests: 84, browsers: ["Chromium", "WebKit"] } }));
  await openView(page, "evidence");
  await expect(page.locator("#workspace")).toContainText("Checks passed");
  await expect(page.locator("#workspace")).toContainText("Chromium / WebKit");
  await expect(page.getByRole("link", { name: "Run", exact: true })).toHaveAttribute("href", "https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/1");
  await checkLayout(page);
});

test("motion is finite and can be disabled including pseudo-elements", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openView(page, "lab");
  await page.getByRole("checkbox", { name: "Interface motion", exact: true }).check();
  await page.getByRole("button", { name: "Preview route", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector("#route-output").getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBeGreaterThan(0);
  const infinite = await page.evaluate(() => document.getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
  expect(infinite).toBe(false);
  await page.getByRole("checkbox", { name: "Interface motion", exact: true }).uncheck();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("checkbox", { name: "Interface motion", exact: true }).check();
  await page.getByRole("button", { name: "Preview route", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
});

if (process.env.FINAL_SNAPSHOT === "true") test("final published snapshot matches real receipt and layout", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [view, title] of views) {
    await openView(page, view);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator("#evidence-status")).toContainText("Cloud checks recorded");
    await checkLayout(page);
    if (["desktop", "phone"].includes(testInfo.project.name)) {
      await mkdir("test-results/screenshots", { recursive: true });
      const filename = `test-results/screenshots/${view}-${testInfo.project.name}.png`;
      await page.screenshot({ path: filename, fullPage: true, caret: "initial" });
      await sharp(filename).resize({ width: testInfo.project.name === "desktop" ? 1000 : 390 }).png().toFile(`test-results/screenshots/${view}-${testInfo.project.name}-review.png`);
    }
  }
  await openView(page, "lab");
  await page.getByRole("tab", { name: "Cloud evidence", exact: true }).click();
  await expect(page.locator("#evidence-status")).toContainText("Cloud checks recorded");
  await checkLayout(page);
  if (["desktop", "phone"].includes(testInfo.project.name)) {
    const bytes = await page.screenshot({ fullPage: true, caret: "initial" });
    await sharp(bytes).resize({ width: testInfo.project.name === "desktop" ? 1000 : 390 }).png().toFile(`test-results/screenshots/cloud-model-${testInfo.project.name}-review.png`);
  }
  expect(errors).toEqual([]);
});