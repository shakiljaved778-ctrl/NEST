import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // amil/ is a separate pnpm/Turborepo workspace with its own tests and CI.
    exclude: [...configDefaults.exclude, "amil/**"],
  },
});
