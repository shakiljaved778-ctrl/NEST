import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/fixtures.ts"],
      reporter: ["text-summary"],
      // Section 5: 100% branch coverage target on calculators, enforced.
      thresholds: {
        "src/**/calculate.ts": { branches: 100, lines: 100, functions: 100, statements: 100 },
        "src/**/pack.ts": { branches: 100, lines: 100, functions: 100, statements: 100 },
        "src/shared/*.ts": { branches: 100, lines: 100, functions: 100, statements: 100 },
        "src/template.ts": { branches: 100, lines: 100 },
      },
    },
  },
});
