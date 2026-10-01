import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    testTimeout: 30_000,
    // Integration files share one database and some toggle kill switches: run files one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
