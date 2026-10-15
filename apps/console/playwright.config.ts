import { defineConfig, devices } from "@playwright/test";

/**
 * Console end-to-end tests drive the real stack: AMIL API (:4000), the bank console (:3001) and
 * Doha Demo Bank (:3000), where the acceptance checks look at what the customer sees. Run
 * `pnpm db:seed`, then build both apps (`pnpm --filter @amil/console --filter @amil/demo-bank
 * build`), then `pnpm --filter @amil/console e2e`. The tests restore what they change.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
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
      command: "pnpm --filter @amil/demo-bank start",
      url: "http://localhost:3000/personas",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: "../..",
    },
    {
      command: "pnpm start",
      url: "http://localhost:3001/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Okta sign-in (D-077): a test-only OpenID provider, and a second console configured for it.
    {
      command: "node e2e/mock-oidc.mjs",
      url: "http://localhost:4100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "dotenv -e ../../.env -- next start -p 3002",
      url: "http://localhost:3002/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        OKTA_ISSUER: "http://localhost:4100",
        OKTA_CLIENT_ID: "amil-console-test",
        OKTA_CLIENT_SECRET: "amil-console-test-secret",
        CONSOLE_PUBLIC_URL: "http://localhost:3002",
      },
    },
  ],
});
