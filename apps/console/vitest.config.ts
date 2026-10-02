import { defineConfig } from "vitest/config";

export default defineConfig({
  // Playwright owns e2e/*.spec.ts; unit tests (if any) live in src/.
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"], passWithNoTests: true },
});
