import path from "node:path";
import { securityHeaders } from "@amil/ui/security";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // Monorepo root, so standalone output traces workspace packages (next runs from the app dir).
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  // Security headers on every response; the CSP (with a per-request nonce) is set in middleware.
  headers: () =>
    Promise.resolve([
      { source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") },
    ]),
  // Internal workspace packages are shipped as TypeScript source.
  transpilePackages: ["@amil/ui", "@amil/sdk"],
  // Linting runs through the monorepo's ESLint config (`pnpm lint`), not during `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
