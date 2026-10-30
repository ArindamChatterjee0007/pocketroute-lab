import "./cloud-only.mjs";
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const retiredPublicPaths = Object.freeze([
  "downloads/pocketroute-india-showcase.pdf",
  "documents/INDIA_SHOWCASE.md",
]);

const privatePlanning = /\b(?:revenue|moneti[sz]ation|one business|three business units|business units?|commercial scenario|selling decision|funded pilot|pilot price|feasibility price|integration price|support price|support reserve|contribution margin|buyer interviews|willingness to pay|INR)\b|\u20b9/i;
const privatePath = /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.local|records|PUBLICATION_PLAN\.md|RND_PLAN\.md|AI_OFFICE\.md)(?:\/|$)/i;

export function assertPublicPath(path) {
  if (typeof path !== "string" || path.startsWith("/") || path.split("/").includes("..") || privatePath.test(path) || retiredPublicPaths.includes(path) || /(?:^|\/)india-showcase[^/]*\.(?:png|pdf|md)$/i.test(path)) throw new Error("Private or retired publication path rejected.");
}

export function assertPublicContent(text, label = "Public content") {
  if (typeof text !== "string" || privatePlanning.test(text)) throw new Error(`Public content boundary failed: ${label}`);
}

export async function auditPublicDirectory(directory) {
  const counts = { textFiles: 0, pdfFiles: 0, archives: 0, archiveEntries: 0 };
  const inspect = (path, bytes, nested = false) => {
    assertPublicPath(path);
    if (/\.zip$/i.test(path)) {
      if (nested) throw new Error("Nested publication archive rejected.");
      const archive = join(directory, path);
      execFileSync("unzip", ["-tq", archive], { stdio: "pipe" });
      const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).trim().split(/\r?\n/);
      for (const entry of entries) {
        assertPublicPath(entry);
        if (entry.endsWith("/")) continue;
        const content = execFileSync("unzip", ["-p", archive, entry], { maxBuffer: 16 * 1024 * 1024 });
        inspect(entry, content, true);
        counts.archiveEntries += 1;
      }
      counts.archives += 1;
    } else if (/\.pdf$/i.test(path)) {
      const text = execFileSync("pdftotext", ["-layout", "-", "-"], { input: bytes, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
      assertPublicContent(text, path);
      counts.pdfFiles += 1;
    } else if (/\.(?:html|css|m?js|json|md|txt)$|(?:^|\/)(?:LICENSE|NOTICE)$/i.test(path)) {
      assertPublicContent(bytes.toString("utf8"), path);
      counts.textFiles += 1;
    }
  };
  const walk = async (relative = "") => {
    for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      assertPublicPath(path);
      if (entry.isDirectory()) await walk(path);
      else inspect(path, await readFile(join(directory, path)));
    }
  };
  await walk();
  return { schemaVersion: 1, status: "passed", scope: "technical-work-only", sourceSha: process.env.GITHUB_SHA, ...counts, retiredAssetsAbsent: true };
}