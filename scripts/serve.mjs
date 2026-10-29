import "./cloud-only.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".zip": "application/zip", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const target = resolve(root, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (!target.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    const bytes = await readFile(target);
    response.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404); response.end("Not found"); }
});
server.listen(4173, "127.0.0.1", () => console.log("GitHub-only preview listening on 127.0.0.1:4173"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));