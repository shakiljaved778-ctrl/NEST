import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/worker.ts", "src/scripts/proactive-run.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Workspace packages are TypeScript source: bundle them. Prisma stays external (native engine).
  noExternal: [/^@amil\//],
  external: ["@prisma/client", ".prisma/client"],
});
