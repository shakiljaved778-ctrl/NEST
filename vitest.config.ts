import { defineConfig } from "vitest/config";

// The root super-app's unit tests live in tests/. The crm/ subproject is a
// self-contained app with its own tsconfig, dependencies, and CI
// (.github/workflows/crm-ci.yml), so the root test run must not reach into it.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "crm/**"],
  },
});
