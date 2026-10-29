import "../scripts/cloud-only.mjs";
import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const views = [
  ["overview", "Research overview"],
  ["execution", "Execution board"],
  ["lab", "Model lab"],
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
  await expect(page.locator(".task-card")).toHaveCount(3);
  await page.locator('[data-task="B03-001"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const note = 'Synthetic personal note <img src=x onerror="window.noteExecuted=true">';
  await page.locator("#personal-note").fill(note);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#evidence-status")).toContainText("Published snapshot");
  await page.locator('[data-task="B03-001"]').click();
  await expect(page.locator("#personal-note")).toHaveValue(note);
  expect(await page.evaluate(() => window.noteExecuted)).toBeUndefined();
  await page.getByRole("button", { name: "Clear note", exact: true }).click();
  await expect(page.locator("#personal-note")).toHaveValue("");
  await page.keyboard.press("Escape");
  await page.getByLabel("Filter tasks by unit").selectOption("b01");
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

test("workspace search, source filters and economic scenarios work", async ({ page }) => {
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
  await page.locator("#economic-price").fill("60000");
  await expect(page.locator("#economic-contribution")).toContainText("30,000");
  await expect(page.locator("#economic-margin")).toContainText("50%");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#economic-contribution")).toContainText("20,000");
});

test("export is a real public JSON download without personal notes", async ({ page }) => {
  await openView(page, "overview");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export snapshot", exact: true }).click()]);
  const file = await download.path();
  const data = JSON.parse(await readFile(file, "utf8"));
  expect(data.privateCustomerDataIncluded).toBe(false);
  expect(data.tasks).toHaveLength(12);
  expect(data.units).toHaveLength(3);
  expect(data.personalNotes).toBeUndefined();
});

test("missing evidence remains visibly unavailable, never a fake pass", async ({ page }) => {
  await page.route("**/data/*.json", route => route.abort());
  await page.goto("/#evidence", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#evidence-status")).toContainText("Evidence unavailable");
  await expect(page.locator("#workspace")).toContainText("No receipt");
  await expect(page.locator("#workspace")).not.toContainText("Checks passed");
  await expect(page.locator(".source-row")).toHaveCount(19);
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