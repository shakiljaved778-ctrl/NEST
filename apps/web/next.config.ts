import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume workspace packages directly from their TypeScript sources.
  transpilePackages: [
    "@voyara/contracts",
    "@voyara/agent-core",
    "@voyara/inventory-mesh",
    "@voyara/forecast",
    "@voyara/ledger",
  ],
  // Workspace sources use ESM-correct ".js" specifiers that point at ".ts"
  // files. Teach webpack to resolve them to the TypeScript sources.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
