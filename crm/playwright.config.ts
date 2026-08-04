import { defineConfig, devices } from "@playwright/test";

// E2E for the critical flows: login, lead create→convert→win, capture endpoint.
// Assumes Postgres is up and the DB has been seeded (npm run db:seed).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000/login",
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
