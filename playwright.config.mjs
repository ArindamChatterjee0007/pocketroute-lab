import "./scripts/cloud-only.mjs";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./qa",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 35000,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { baseURL: "http://127.0.0.1:4173", reducedMotion: "reduce", trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "wide", use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } } },
    { name: "phone", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "small-phone", use: { browserName: "chromium", viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1440, height: 1000 } } },
    { name: "webkit-phone", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: "node scripts/serve.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: false, timeout: 15000 },
});