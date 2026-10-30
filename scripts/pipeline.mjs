import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const githubToken = process.env.GH_TOKEN;
delete process.env.GH_TOKEN;
delete process.env.GITHUB_TOKEN;
delete process.env.ACTIONS_RUNTIME_TOKEN;
delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

function command(program, argumentsList, { cwd = process.cwd(), timeout = 480000, allowFailure = false, authenticated = false, capture = true } = {}) {
  console.log(`> ${program} ${argumentsList.join(" ")}`);
  const result = spawnSync(program, argumentsList, { cwd, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", env: authenticated ? { ...process.env, GH_TOKEN: githubToken } : process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error(`Cloud stage failed: ${program}; exit ${result.status ?? "timeout"}`);
  return result;
}

async function main() {
  const packageData = JSON.parse(readFileSync("package.json", "utf8"));
  const lockedRoot = existsSync("package-lock.json") ? JSON.parse(readFileSync("package-lock.json", "utf8")).packages?.[""] : null;
  if (!lockedRoot || lockedRoot.version !== packageData.version || !isDeepStrictEqual(lockedRoot.dependencies, packageData.dependencies) || !isDeepStrictEqual(lockedRoot.devDependencies, packageData.devDependencies)) command("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
  command("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  command("npm", ["audit", "--audit-level=high"]);
  const unit = command("npm", ["test"]);
  if (process.env.PIPELINE_MODE === "unit") return;
  if (process.env.PIPELINE_MODE === "ai") {
    command(process.execPath, ["scripts/evaluate-service.mjs"], { timeout: 1320000, capture: false });
    const report = JSON.parse(readFileSync("data/ai-service-results.json", "utf8"));
    command("gh", ["auth", "setup-git"], { authenticated: true });
    command("git", ["config", "user.name", "github-actions[bot]"]);
    command("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
    command("git", ["add", "--", "data/ai-service-results.json", `data/ai-runs/${process.env.GITHUB_RUN_ID}.json`]);
    command("git", ["commit", "-m", "Record frozen AI service evaluation, including failed gates [skip ci]"]);
    command("git", ["push", "origin", "HEAD:main"], { authenticated: true });
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## AI service evaluation\n\n\`\`\`json\n${JSON.stringify({ status: report.status, selected: report.selected, metrics: report.metrics, pilotScreen: report.pilotScreen, commercialReadiness: report.commercialReadiness }, null, 2)}\n\`\`\`\n`);
    if (report.status !== "completed") throw new Error("AI evaluation was incomplete; the diagnostic receipt was preserved.");
    return;
  }
  if (process.env.PIPELINE_MODE === "live") {
    command("npx", ["--no-install", "playwright", "install", "--with-deps", "chromium", "webkit"], { capture: false });
    command(process.execPath, ["scripts/live-check.mjs"]);
    command("gh", ["auth", "setup-git"], { authenticated: true });
    command("git", ["config", "user.name", "github-actions[bot]"]);
    command("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
    command("git", ["add", "--", "data/live-verification.json"]);
    if (command("git", ["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1) {
      command("git", ["commit", "-m", "Record live GitHub Pages acceptance [skip ci]"]);
      command("git", ["push", "origin", "HEAD:main"], { authenticated: true });
    }
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live GitHub Pages acceptance\n\n\`\`\`json\n${readFileSync("data/live-verification.json", "utf8")}\n\`\`\`\n`);
    return;
  }
  if (process.env.RUN_SLM_EXPERIMENT === "true") command(process.execPath, ["scripts/experiment.mjs"], { timeout: 420000 });
  const licenseResponse = await fetch("https://www.apache.org/licenses/LICENSE-2.0.txt");
  if (!licenseResponse.ok) throw new Error("Unable to retrieve the Apache-2.0 license text.");
  const license = await licenseResponse.text();
  if (!license.includes("Version 2.0, January 2004") || !license.includes("Grant of Copyright License")) throw new Error("Unexpected license response.");
  writeFileSync("LICENSE", license);
  command("gh", ["auth", "setup-git"], { authenticated: true });
  command("git", ["config", "user.name", "github-actions[bot]"]);
  command("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  command("git", ["add", "--", "package-lock.json", "data/slm-results.json", "LICENSE"]);
  if (command("git", ["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1) {
    command("git", ["commit", "-m", "Record cloud-generated lock, model evidence and license [skip ci]"]);
    command("git", ["push", "origin", "HEAD:main"], { authenticated: true });
  }
  const generatedInputsSha = command("git", ["rev-parse", "HEAD"]).stdout.trim();
  command("npm", ["run", "build"]);
  command("npx", ["--no-install", "playwright", "install", "--with-deps", "chromium", "webkit"], { capture: false });
  command("npm", ["run", "test:browser"], { capture: false });
  const browserReport = JSON.parse(readFileSync("test-results/results.json", "utf8"));
  if (browserReport.stats.unexpected || browserReport.stats.flaky || browserReport.stats.skipped) throw new Error("Browser report contains failed, flaky or skipped tests.");
  const { default: browserConfig } = await import("../playwright.config.mjs");
  const completedProjects = new Set();
  const completedSpecs = new Set();
  function collectResults(suite) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      if (test.results?.some(result => result.status === "passed")) {
        completedProjects.add(test.projectName);
        completedSpecs.add(spec.title);
      }
    }
    for (const nested of suite.suites || []) collectResults(nested);
  }
  for (const suite of browserReport.suites) collectResults(suite);
  const testedProjects = browserConfig.projects.filter(project => completedProjects.has(project.name));
  if (testedProjects.length !== browserConfig.projects.length) throw new Error("Configured browser matrix was not fully executed.");
  const runUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  mkdirSync("dist/evidence", { recursive: true });
  for (const name of readdirSync("test-results/screenshots")) if (name.endsWith(".png")) cpSync(join("test-results/screenshots", name), join("dist/evidence", name));
  const verification = {
    schemaVersion: 1,
    stage: "prepublication-checks-passed",
    checkedAt: new Date().toISOString(),
    sourceSha: process.env.GITHUB_SHA,
    generatedInputsSha,
    runUrl,
    unitTests: Number(/# tests (\d+)/.exec(unit.stdout)?.[1] ?? 0),
    browserTests: browserReport.stats.expected,
    browserSpecs: completedSpecs.size,
    browserConfigurations: testedProjects.map(project => ({ name: project.name, browser: project.use.browserName, viewport: project.use.viewport })),
    browserFailures: browserReport.stats.unexpected,
    localBuildsOrTests: 0,
    phoneBenchmarks: 0,
    energyJoules: null,
    viewports: [...new Set(testedProjects.map(project => project.use.viewport.width))],
    browsers: [...new Set(testedProjects.map(project => ({ chromium: "Chromium", webkit: "WebKit" })[project.use.browserName]))],
    model: JSON.parse(readFileSync("data/slm-results.json", "utf8")).status,
    screenshots: readdirSync("dist/evidence").filter(name => name.endsWith(".png")),
    screenshotState: "Final prepublication receipt; no synthetic verification fixture",
  };
  if (!verification.unitTests || !verification.browserTests) throw new Error("Missing test receipt counts.");
  writeFileSync("dist/data/verification.json", JSON.stringify(verification, null, 2));
  process.env.FINAL_SNAPSHOT = "true";
  const finalSnapshots = command("npx", ["--no-install", "playwright", "test", "--grep", "final published snapshot", "--reporter=list"]);
  delete process.env.FINAL_SNAPSHOT;
  verification.finalSnapshotChecks = Number(/(\d+) passed/.exec(finalSnapshots.stdout)?.[1] ?? 0);
  if (verification.finalSnapshotChecks !== testedProjects.length * 2) throw new Error("Dashboard and Notes final snapshot matrices did not finish.");
  for (const name of readdirSync("test-results/screenshots")) if (name.endsWith(".png")) cpSync(join("test-results/screenshots", name), join("dist/evidence", name));
  verification.screenshots = readdirSync("dist/evidence").filter(name => name.endsWith(".png"));
  verification.product = { name: "PocketRoute Notes", version: "0.2.0-alpha", engine: "rules-and-extractive", localOnly: true, modelExecuted: false, screenshotData: "Synthetic reviewed record; not customer data", sdk: "downloads/pocketroute-core.mjs", bundle: "downloads/pocketroute-notes-0.2.0.zip" };
  writeFileSync("dist/data/verification.json", JSON.stringify(verification, null, 2));
  cpSync("LICENSE", "dist/LICENSE.txt");
  const inventory = [];
  function inventoryFiles(directory, relative = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const location = join(directory, entry.name);
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) inventoryFiles(location, name);
      else {
        const bytes = readFileSync(location);
        inventory.push({ path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
  }
  inventoryFiles("dist");
  writeFileSync("dist/publication.json", JSON.stringify({ ...verification, inventory }, null, 2));
  const remote = `https://github.com/${repository}.git`;
  const destination = mkdtempSync(join(process.env.RUNNER_TEMP, "pocketroute-site-"));
  const branch = command("git", ["ls-remote", "--heads", remote, "gh-pages"]).stdout.trim();
  if (branch) command("git", ["clone", "--depth", "1", "--single-branch", "--branch", "gh-pages", remote, destination]);
  else {
    command("git", ["init", "-b", "gh-pages", destination]);
    command("git", ["remote", "add", "origin", remote], { cwd: destination });
  }
  for (const name of readdirSync(destination)) if (name !== ".git") rmSync(join(destination, name), { recursive: true, force: true });
  cpSync("dist", destination, { recursive: true });
  command("git", ["config", "user.name", "github-actions[bot]"], { cwd: destination });
  command("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: destination });
  command("git", ["add", "--all"], { cwd: destination });
  if (command("git", ["diff", "--cached", "--quiet"], { cwd: destination, allowFailure: true }).status === 1) {
    command("git", ["commit", "-m", `Publish verified research dashboard ${process.env.GITHUB_RUN_ID}`], { cwd: destination });
    command("git", ["push", "origin", "HEAD:gh-pages"], { cwd: destination, authenticated: true });
  }
  const pages = command("gh", ["api", "--method", "POST", `repos/${repository}/pages/builds`], { allowFailure: true, timeout: 30000, authenticated: true });
  const summary = { ...verification, pagesBuildRequested: pages.status === 0, publicationBranch: "gh-pages", artifactStorageUsed: false, cachesConfigured: false };
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## PocketRoute cloud verification\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`);
  console.log(JSON.stringify(summary, null, 2));
}

await main();