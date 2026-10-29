import "./cloud-only.mjs";
import { repository } from "./cloud-only.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const githubToken = process.env.GH_TOKEN;
delete process.env.GH_TOKEN;
delete process.env.GITHUB_TOKEN;
delete process.env.ACTIONS_RUNTIME_TOKEN;
delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

function command(program, argumentsList, { cwd = process.cwd(), timeout = 480000, allowFailure = false, authenticated = false } = {}) {
  console.log(`> ${program} ${argumentsList.join(" ")}`);
  const result = spawnSync(program, argumentsList, { cwd, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024, env: authenticated ? { ...process.env, GH_TOKEN: githubToken } : process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error(`Cloud stage failed: ${program}; exit ${result.status ?? "timeout"}`);
  return result;
}

async function main() {
  if (!existsSync("package-lock.json")) command("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"]);
  command("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
  command("npm", ["audit", "--audit-level=high"]);
  const unit = command("npm", ["test"]);
  if (process.env.PIPELINE_MODE === "unit") return;
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
  command("npx", ["--no-install", "playwright", "install", "--with-deps", "chromium", "webkit"]);
  command("npm", ["run", "test:browser"]);
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
  if (verification.finalSnapshotChecks !== testedProjects.length) throw new Error("Final snapshot matrix did not finish.");
  for (const name of readdirSync("test-results/screenshots")) if (name.endsWith(".png")) cpSync(join("test-results/screenshots", name), join("dist/evidence", name));
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