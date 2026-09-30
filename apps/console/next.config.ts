import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // Monorepo root, so standalone output traces workspace packages (next runs from the app dir).
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  // Internal workspace packages are shipped as TypeScript source.
  transpilePackages: ["@amil/i18n"],
  // Linting runs through the monorepo's ESLint config (`pnpm lint`), not during `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
