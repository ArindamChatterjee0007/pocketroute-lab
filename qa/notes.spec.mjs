import "../scripts/cloud-only.mjs";
import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRecord, createBackup } from "../app/note-core.mjs";
import Papa from "papaparse";
import sharp from "sharp";

const sampleSource = "Site: North-17\nDate: 2026-10-29\nTicket: JOB-0042\nTwo filters need replacement.\nThe unit remains isolated.";

async function openNotes(page) {
  await page.goto("/notes/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Field-note workbench" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-storage", "ready");
  await page.evaluate(() => document.fonts.ready);
}
async function prepare(page, source = sampleSource, title = "Synthetic North visit") {
  await page.locator("#source-note").fill(source);
  await page.getByRole("button", { name: "Prepare record", exact: true }).click();
  await expect(page.locator("#record-title")).toBeEnabled();
  await page.locator("#record-title").fill(title);
}
async function save(page) {
  await page.locator("#review-confirmed").check();
  await page.getByRole("button", { name: "Save reviewed record", exact: true }).click();
  await expect(page.locator("#work-status")).toContainText("Saved locally:");
  await expect(page.locator("#draft-state")).toHaveText("Saved locally");
}
async function backup(page) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Backup JSON", exact: true }).click()]);
  return JSON.parse(await readFile(await download.path(), "utf8"));
}
async function checkLayout(page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    page: document.documentElement.scrollWidth,
    clipped: [...document.querySelectorAll("h1,h2,h3,p,label,button")].filter(item => item.getClientRects().length && getComputedStyle(item).visibility !== "hidden" && !item.closest("[hidden]") && item.clientWidth > 0 && item.scrollWidth > item.clientWidth + 2 && !item.classList.contains("sr-only")).map(item => ({ text: item.textContent.trim().slice(0, 70), width: item.clientWidth, scroll: item.scrollWidth })),
    missing: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
  }));
  expect(result.page, JSON.stringify(result)).toBeLessThanOrEqual(result.width + 1);
  expect(result.clipped, JSON.stringify(result)).toEqual([]);
  expect(result.missing).toEqual([]);
}
function fixture(id = "import-0001", overrides = {}) {
  return createRecord({ source: sampleSource, title: "Imported synthetic visit", site: "North-17", date: "2026-10-29", reference: "00042", category: "Maintenance", summary: "Two filters need replacement.\nThe unit remains isolated.", reviewed: true, ...overrides }, { id, version: 1, createdAt: "2026-10-29T10:00:00.000Z", updatedAt: "2026-10-29T10:00:00.000Z" });
}
async function importBackup(page, content) {
  await expect(page.getByRole("button", { name: "Import backup", exact: true })).toBeEnabled();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Import backup", exact: true }).click()]);
  await chooser.setFiles({ name: "synthetic-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(content)) });
  await expect(page.getByRole("dialog")).toContainText("Import reviewed records?");
  await page.getByRole("button", { name: "Import records", exact: true }).click();
}

test("Notes is a responsive usable workspace with no automatic external requests", async ({ page }, testInfo) => {
  const errors = [];
  const outside = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:4173/") && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outside.push(request.url()); });
  await openNotes(page);
  expect(await page.evaluate(() => innerWidth)).toBe(testInfo.project.use.viewport.width);
  await checkLayout(page);
  await prepare(page);
  await expect(page.locator("#record-site")).toHaveValue("North-17");
  await expect(page.locator("#record-date")).toHaveValue("2026-10-29");
  await expect(page.locator("#record-reference")).toHaveValue("JOB-0042");
  await save(page);
  await checkLayout(page);
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});

test("Notes publication links survive self-hosted packaging", async ({ page }) => {
  await openNotes(page);
  const bundlePath = "downloads/pocketroute-notes-0.2.0.zip";
  const bundleUrl = `https://arindamchatterjee0007.github.io/pocketroute-lab/${bundlePath}`;
  const link = page.getByRole("link", { name: "Product bundle", exact: true });
  await expect(link).toHaveAttribute("href", bundleUrl);
  await expect(link).toHaveAttribute("download", "");
  await expect(page.getByRole("link", { name: "Source", exact: true })).toHaveAttribute("href", "https://github.com/ArindamChatterjee0007/pocketroute-lab");
  const response = await page.request.get(`/${bundlePath}`);
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(bytes).toEqual(await readFile(`dist/${bundlePath}`));
  const bundledIndex = execFileSync("unzip", ["-p", `dist/${bundlePath}`, "notes/index.html"], { encoding: "utf8" });
  expect(bundledIndex).toBe(await readFile("dist/notes/index.html", "utf8"));
  expect(bundledIndex).toContain(`href="${bundleUrl}"`);
});

test("review-gated create reload edit search and delete complete a real lifecycle", async ({ page }) => {
  await openNotes(page);
  await prepare(page);
  await expect(page.getByRole("button", { name: "Save reviewed record", exact: true })).toBeDisabled();
  await save(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#record-count")).toHaveText("1");
  await page.locator(".saved-record").click();
  await expect(page.locator("#source-note")).toHaveValue(sampleSource);
  await page.locator("#record-summary").fill("Reviewed custom handover.");
  await expect(page.locator("#review-confirmed")).not.toBeChecked();
  await save(page);
  await expect(page.locator("#version-state")).toHaveText("Version 2");
  const data = await backup(page);
  expect(data.records[0].summaryOrigin).toBe("user-edited");
  expect(data.records[0].summary).toBe("Reviewed custom handover.");
  await page.getByRole("searchbox", { name: "Search saved records" }).fill("not present");
  await expect(page.locator(".saved-record")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search saved records" }).fill("North");
  await expect(page.locator(".saved-record")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete saved record", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#record-count")).toHaveText("1");
  await page.getByRole("button", { name: "Delete saved record", exact: true }).click();
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await expect(page.locator("#record-count")).toHaveText("0");
});

test("offline reload keeps reviewed records and scopes cache away from the office", async ({ page, context }) => {
  await openNotes(page);
  await expect(page.locator("body")).toHaveAttribute("data-offline-ready", "true");
  await prepare(page);
  await save(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#record-count")).toHaveText("1");
  await page.locator(".saved-record").click();
  await expect(page.locator("#record-site")).toHaveValue("North-17");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
  expect(scope).toBe("http://127.0.0.1:4173/notes/");
  const privateCache = await page.evaluate(async () => {
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) if (/backup|record|North-17|JOB-0042/.test(request.url)) return true;
    return false;
  });
  expect(privateCache).toBe(false);
  await context.setOffline(false);
  await page.goto("/#overview", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
});

test("backup import is add-only, reports conflicts and rejects malformed files", async ({ page }) => {
  await openNotes(page);
  const record = fixture();
  const original = createBackup([record]);
  await importBackup(page, original);
  await expect(page.locator("#work-status")).toContainText("1 imported, 0 unchanged, 0 conflict");
  await importBackup(page, original);
  await expect(page.locator("#work-status")).toContainText("0 imported, 1 unchanged, 0 conflict");
  await importBackup(page, createBackup([{ ...record, title: "Conflicting same-ID title", version: 2 }]));
  await expect(page.getByRole("dialog")).toContainText("Import conflicts retained");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect((await backup(page)).records[0].title).toBe(record.title);
  await page.locator("#backup-file").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"kind":"wrong"}') });
  await expect(page.locator("#work-status")).toContainText("not a supported PocketRoute Notes backup");
  await expect(page.locator("#record-count")).toHaveText("1");
});

test("CSV and JSON downloads keep malicious-looking note text inert", async ({ page }) => {
  await openNotes(page);
  const source = 'Site: North-17\n<img src=x onerror="window.noteExecuted=true">\n=SUM(1,2)';
  await prepare(page, source, '=HYPERLINK("https://example.invalid")');
  await save(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV", exact: true }).click()]);
  const csv = Papa.parse(await readFile(await download.path(), "utf8"), { header: true });
  expect(csv.errors).toEqual([]);
  expect(csv.data[0].Title).toBe('\'=HYPERLINK("https://example.invalid")');
  expect(csv.data[0]["Original note"]).toBe(source);
  expect((await backup(page)).records[0].title).toBe('=HYPERLINK("https://example.invalid")');
  expect(await page.evaluate(() => window.noteExecuted)).toBeUndefined();
  await expect(page.locator(".saved-record img")).toHaveCount(0);
});

test("stale tabs cannot overwrite a newer saved record", async ({ page, context }) => {
  await openNotes(page);
  await prepare(page);
  await save(page);
  const second = await context.newPage();
  await openNotes(second);
  await second.locator(".saved-record").click();
  await page.locator("#record-title").fill("Newer title from first tab");
  await save(page);
  await second.locator("#record-title").fill("Stale second-tab edit");
  await second.locator("#review-confirmed").check();
  await second.getByRole("button", { name: "Save reviewed record", exact: true }).click();
  await expect(second.locator("#work-status")).toContainText("changed in another tab");
  expect((await backup(page)).records[0].title).toBe("Newer title from first tab");
  await expect(second.locator("#record-title")).toHaveValue("Stale second-tab edit");
  second.on("dialog", dialog => dialog.accept());
  await second.close({ runBeforeUnload: false });
});

test("future timestamps remain editable and unreadable rows retain a raw recovery path", async ({ page }) => {
  await openNotes(page);
  const record = { ...fixture(), createdAt: "2031-01-01T00:00:00.000Z", updatedAt: "2031-01-01T00:00:00.000Z" };
  await importBackup(page, createBackup([record]));
  await page.locator(".saved-record").click();
  await page.locator("#record-title").fill("Reviewed after clock regression");
  await save(page);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("pocketroute-notes-v1", 1);
    request.onerror = () => reject(new Error("fixture storage unavailable"));
    request.onsuccess = () => {
      const tx = request.result.transaction("records", "readwrite");
      tx.objectStore("records").put({ id: "unsupported-0001", schemaVersion: 999, title: "Synthetic future row" });
      tx.oncomplete = () => { request.result.close(); resolve(true); };
      tx.onabort = () => reject(new Error("fixture write failed"));
    };
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#record-count")).toHaveText("1");
  await expect(page.locator("#recovery-banner")).toContainText("1 unsupported local record");
  expect((await backup(page)).records).toHaveLength(1);
  await page.getByRole("button", { name: "Storage and privacy", exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export raw recovery file", exact: true }).click()]);
  const recovery = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(recovery.records).toHaveLength(2);
  expect(recovery.records.some(item => item.schemaVersion === 999)).toBe(true);
});

test("clear-all confirmation works and does not erase unrelated browser data", async ({ page }) => {
  await openNotes(page);
  await prepare(page);
  await save(page);
  await page.evaluate(() => localStorage.setItem("unrelated-product-marker", "preserve"));
  await page.getByRole("button", { name: "Storage and privacy", exact: true }).click();
  await page.getByRole("button", { name: "Clear all local records", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Clear all local records?");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#record-count")).toHaveText("1");
  await page.getByRole("button", { name: "Storage and privacy", exact: true }).click();
  await page.getByRole("button", { name: "Clear all local records", exact: true }).click();
  await page.getByRole("button", { name: "Clear records", exact: true }).click();
  await expect(page.locator("#record-count")).toHaveText("0");
  expect(await page.evaluate(() => localStorage.getItem("unrelated-product-marker"))).toBe("preserve");
});

test("delete and restore cannot bypass the stale-record guard with the same version", async ({ page, context }) => {
  await openNotes(page);
  await prepare(page);
  await save(page);
  const snapshot = await backup(page);
  const other = await context.newPage();
  await openNotes(other);
  await other.locator(".saved-record").click();
  await other.getByRole("button", { name: "Delete saved record", exact: true }).click();
  await other.getByRole("button", { name: "Delete record", exact: true }).click();
  await expect(other.locator("#work-status")).toHaveText("Saved record deleted from this browser.");
  const restored = { ...snapshot.records[0], title: "Different restored content, same ID and version" };
  await importBackup(other, createBackup([restored]));
  await page.locator("#record-title").fill("Stale edit after restore");
  await page.locator("#review-confirmed").check();
  await page.getByRole("button", { name: "Save reviewed record", exact: true }).click();
  await expect(page.locator("#work-status")).toContainText("changed in another tab");
  await page.getByRole("button", { name: "Delete saved record", exact: true }).click();
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await expect(page.locator("#work-status")).toContainText("changed in another tab");
  expect((await backup(other)).records[0].title).toBe(restored.title);
});

if (process.env.FINAL_SNAPSHOT === "true") test("final published snapshot Notes product with a synthetic reviewed record", async ({ page }, testInfo) => {
  await openNotes(page);
  await prepare(page);
  await save(page);
  await expect(page.locator("body")).toHaveAttribute("data-offline-ready", "true");
  await expect(page.locator(".skip-link")).not.toBeFocused();
  await expect(page.locator(".skip-link")).toHaveCSS("clip-path", "inset(100%)");
  await checkLayout(page);
  if (["desktop", "phone"].includes(testInfo.project.name)) {
    await mkdir("test-results/screenshots", { recursive: true });
    const bytes = await page.screenshot({ fullPage: true, caret: "initial" });
    const stats = await sharp(bytes).stats();
    expect(stats.channels.some(channel => channel.stdev > 15)).toBe(true);
    await sharp(bytes).resize({ width: testInfo.project.name === "desktop" ? 1100 : 390 }).png().toFile(`test-results/screenshots/notes-${testInfo.project.name}-review.png`);
  }
});