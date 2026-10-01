import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive the real stack: AMIL API (:4000) + Doha Demo Bank (:3000) on a seeded
 * database. Run `pnpm db:seed` and `pnpm --filter @amil/demo-bank build` first; then
 * `pnpm --filter @amil/demo-bank e2e`.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Pixel 7"],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: [
    {
      command: "pnpm --filter @amil/api dev",
      url: "http://localhost:4000/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: "../..",
    },
    {
      command: "pnpm start",
      url: "http://localhost:3000/personas",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
