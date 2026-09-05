import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:4321",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(externalBaseURL ? {} : {
    webServer: {
      command: "npm run preview:test",
      url: "http://127.0.0.1:4321",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "small-mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "mobile-landscape",
      use: { ...devices["Pixel 5"], viewport: { width: 844, height: 390 } },
    },
  ],
});
