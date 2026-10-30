import "./cloud-only.mjs";
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import { documentBlocks } from "./pdf-content.mjs";

const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const books = [
  { id: "device-integration", title: "Device Integration\n& Test Handbook", shortTitle: "Integration handbook", kicker: "Engineering manual / 01", subtitle: "A practical path from runtime contract to a verified device integration.", files: ["ai/DEVICE_INTEGRATION.md"], facts: [["4", "device classes"], ["96", "regression inputs"], ["0", "qualified native ports"]], flow: ["Profile", "Runtime", "Regression", "Evidence"], status: "Experimental reference. Native device support and production quality are not established." },
  { id: "sdk-reference", title: "SDK & Evidence\nReference", shortTitle: "SDK reference", kicker: "Developer reference / 02", subtitle: "The API, pinned model history, failure analysis and deployment boundaries in one reference.", files: ["ai/README.md", "ai/MODEL_CARD.md"], facts: [["73 / 96", "synthetic labels correct"], ["4", "unsafe acceptances"], ["76.0%", "target not met"]], flow: ["Request", "Review policy", "Model", "Human review"], status: "The quality gate failed. A working SDK is not a production or low-power mobile qualification." },
  { id: "india-showcase", title: "India Showcase\nField Guide", shortTitle: "India showcase guide", kicker: "Opportunity briefing / 03", subtitle: "Bengaluru, Hyderabad and practical Indian routes from engineering evidence to technical conversations.", files: ["documents/INDIA_SHOWCASE.md"], facts: [["31 OCT", "Hyderabad proposal date"], ["17-19 NOV", "Bengaluru Tech Summit"], ["0", "bookings or payments"]], flow: ["Evidence", "Proposal", "Selection", "Approval"], status: "Research only. No funded slot, speaker acceptance, employer interest or travel support is promised." },
];

const css = await readFile("documents/print.css", "utf8");
const fonts = await Promise.all([["Manrope", "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2"], ["Space Grotesk", "node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2"]].map(async ([name, path]) => `@font-face{font-family:"${name}";font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${(await readFile(path)).toString("base64")}) format("woff2");}`));
const texture = `data:image/png;base64,${(await readFile("dist/assets/topology.png")).toString("base64")}`;
const scratch = await mkdtemp(join(process.env.RUNNER_TEMP, "pocketroute-pdf-"));
await mkdir("dist/downloads", { recursive: true });
await mkdir("dist/evidence/manuals", { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const book of books) {
    const sources = await Promise.all(book.files.map(async path => ({ path, text: await readFile(path, "utf8") })));
    const content = documentBlocks(sources);
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    const externalRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("request", request => { if (!request.url().startsWith("data:")) externalRequests.push(request.url()); });
    await page.route(/^https?:\/\//, route => route.abort());
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PocketRoute - ${escape(book.shortTitle)}</title><style>${fonts.join("\n")}${css}</style></head><body><main id="book"></main></body></html>`);
    await page.evaluate(async () => {
      await Promise.all([document.fonts.load('400 14px "Manrope"'), document.fonts.load('600 28px "Space Grotesk"')]);
      await document.fonts.ready;
    });
    const layout = await page.evaluate(({ book, content, texture, sourceSha }) => {
      const root = document.querySelector("#book");
      const text = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
      const addSheet = (kind = "body") => {
        const sheet = document.createElement("section");
        sheet.className = `sheet ${kind}`;
        sheet.innerHTML = `<div class="page-mast"><span class="brand">PocketRoute</span><span>${text(book.shortTitle)} / October 2026</span></div><div class="page-content"></div><footer class="page-footer"><span>Experimental engineering reference / ${text(sourceSha.slice(0, 10))}</span><span class="folio"></span></footer>`;
        root.append(sheet);
        return sheet;
      };
      const cover = addSheet("cover");
      cover.querySelector(".page-content").remove();
      cover.insertAdjacentHTML("beforeend", `<div class="cover-content"><div class="cover-kicker">${text(book.kicker)}</div><h1>${book.title.split("\n").map(text).join("<br>")}</h1><p class="cover-subtitle">${text(book.subtitle)}</p><div class="cover-rule"><span></span><span></span><span></span></div><div class="cover-facts">${book.facts.map(([value, label]) => `<div><strong>${text(value)}</strong><span>${text(label)}</span></div>`).join("")}</div><div class="architecture" style="background-image:url('${texture}')"><div class="architecture-label">${book.id === "india-showcase" ? "A route, not a booked outcome" : "Reference workflow / qualification remains separate"}</div><div class="architecture-flow">${book.flow.map(value => `<span>${text(value)}</span>`).join("")}</div></div><p class="cover-status">${text(book.status)}</p></div>`);
      const tocSheets = [];
      for (let offset = 0; offset < content.chapters.length; offset += 24) {
        const sheet = addSheet("contents");
        sheet.querySelector(".page-content").innerHTML = `<h2 class="toc-title">Contents${offset ? " / continued" : ""}</h2><p class="toc-intro">A field reference for implementation, evaluation and review. Chapter links are clickable in the PDF.</p><div class="toc-grid">${content.chapters.slice(offset, offset + 24).map(chapter => `<a class="toc-item" href="#${chapter.id}" data-chapter="${chapter.id}"><small>${String(chapter.number).padStart(2, "0")}</small><span>${text(chapter.title)}</span><span class="toc-page"></span></a>`).join("")}</div><p class="document-note">Dated evidence and explicit limits are part of the manual. A proposed interface, successful build or matching regression result is not proof of physical-device or production readiness.</p>`;
        tocSheets.push(sheet);
      }
      let sheet = addSheet();
      let area = sheet.querySelector(".page-content");
      for (let index = 0; index < content.blocks.length; index += 1) {
        const unit = document.createElement("div");
        unit.className = "print-unit";
        const entries = [{ ...content.blocks[index], index }];
        while (["heading", "subheading"].includes(entries.at(-1).kind) && index + 1 < content.blocks.length) { index += 1; entries.push({ ...content.blocks[index], index }); }
        unit.innerHTML = entries.map(entry => `<div class="doc-block" data-block="${entry.index}">${entry.html}</div>`).join("");
        area.append(unit);
        if (area.scrollHeight > area.clientHeight + 1) {
          unit.remove();
          if (area.children.length) { sheet = addSheet(); area = sheet.querySelector(".page-content"); }
          area.append(unit);
          if (area.scrollHeight > area.clientHeight + 1) unit.classList.add("compact");
          if (area.scrollHeight > area.clientHeight + 1) throw new Error(`Print block exceeds page: ${entries[0].index}`);
        }
      }
      const sheets = [...root.querySelectorAll(".sheet")];
      sheets.forEach((value, index) => { value.dataset.page = String(index + 1); value.querySelector(".folio").textContent = `${String(index + 1).padStart(2, "0")} / ${String(sheets.length).padStart(2, "0")}`; });
      for (const link of root.querySelectorAll("[data-chapter]")) link.querySelector(".toc-page").textContent = document.getElementById(link.dataset.chapter).closest(".sheet").dataset.page;
      const overflow = sheets.flatMap(value => {
        const body = value.querySelector(".page-content, .cover-content");
        return body.scrollHeight > body.clientHeight + 1 ? [Number(value.dataset.page)] : [];
      });
      const clipped = [...root.querySelectorAll("p,h1,h2,h3,td,th,pre,.toc-item")].filter(value => value.scrollWidth > value.clientWidth + 2).map(value => value.textContent.slice(0, 100));
      const ids = [...root.querySelectorAll("[data-block]")].map(value => Number(value.dataset.block));
      return { pages: sheets.length, overflow, clipped, blocks: ids.length, uniqueBlocks: new Set(ids).size, expectedBlocks: content.blocks.length, fontsReady: document.fonts.check('10pt "Manrope"') && document.fonts.check('10pt "Space Grotesk"'), links: root.querySelectorAll("a[href]").length };
    }, { book, content, texture, sourceSha: process.env.GITHUB_SHA });
    if (layout.overflow.length || layout.clipped.length || layout.blocks !== layout.expectedBlocks || layout.uniqueBlocks !== layout.expectedBlocks || !layout.fontsReady || pageErrors.length || externalRequests.length) throw new Error(`PDF layout failed: ${book.id} ${JSON.stringify({ layout, pageErrors, externalRequests })}`);
    const filename = `pocketroute-${book.id}.pdf`;
    const pdfPath = `dist/downloads/${filename}`;
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if (pages !== layout.pages || !/Page size:\s+595(?:\.\d+)? x 841(?:\.\d+)? pts|Page size:\s+595(?:\.\d+)? x 842(?:\.\d+)? pts/.test(info)) throw new Error(`Unexpected PDF geometry: ${filename}`);
    const extracted = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (extracted.length < content.sourceCharacters * 0.55 || !extracted.includes("PocketRoute")) throw new Error(`PDF text extraction failed: ${filename}`);
    const urls = execFileSync("pdfinfo", ["-url", pdfPath], { encoding: "utf8" });
    if (!urls.includes("https://")) throw new Error(`PDF external links missing: ${filename}`);
    const tiles = [];
    for (let number = 1; number <= pages; number += 1) {
      const prefix = join(scratch, `${book.id}-${number}`);
      execFileSync("pdftoppm", ["-f", String(number), "-l", String(number), "-scale-to", "700", "-png", "-singlefile", pdfPath, prefix]);
      const image = `${prefix}.png`;
      const stats = await sharp(image).stats();
      if (!stats.channels.some(channel => channel.stdev > 12)) throw new Error(`Blank PDF page: ${filename}/${number}`);
      const tile = await sharp(image).resize({ width: 220, height: 312, fit: "contain", background: "#ffffff" }).png().toBuffer();
      tiles.push({ input: tile, left: ((number - 1) % 4) * 232, top: Math.floor((number - 1) / 4) * 324 });
      if ([1, 3].includes(number)) await sharp(image).png().toFile(`dist/evidence/manuals/${book.id}-page-${number}.png`);
    }
    await sharp({ create: { width: 928, height: Math.ceil(pages / 4) * 324, channels: 3, background: "#dce5e2" } }).composite(tiles).png().toFile(`dist/evidence/manuals/${book.id}-contact-sheet.png`);
    const bytes = await readFile(pdfPath);
    results.push({ id: book.id, path: `downloads/${filename}`, pages, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), sources: sources.map(source => ({ path: source.path, sha256: createHash("sha256").update(source.text).digest("hex") })), contentBlocks: layout.blocks, overflow: 0, clippedText: 0, fontsReady: true, textExtracted: true, hyperlinksVerified: true, allActualPdfPagesRasterChecked: true, pageErrors: 0, externalRequests: 0 });
    await context.close();
  }
  await writeFile("dist/data/document-verification.json", JSON.stringify({ schemaVersion: 1, status: "passed", sourceSha: process.env.GITHUB_SHA, runUrl: `https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/${process.env.GITHUB_RUN_ID}`, generatedAt: new Date().toISOString(), rendering: "GitHub-hosted Chromium PDF plus Poppler raster/text inspection", documents: results, privatePaperPlanIncluded: false, localRendering: false }, null, 2));
} finally { await browser.close(); await rm(scratch, { recursive: true, force: true }); }
console.log(JSON.stringify({ pdfDocuments: results.map(({ id, pages }) => ({ id, pages })), localRendering: false }));