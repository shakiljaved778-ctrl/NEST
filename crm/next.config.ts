import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Docker image (smaller runtime).
  // Enabled via env so `next start` (local/dev) keeps working normally.
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  // Node-only libraries that must not be bundled (they use Node core modules).
  serverExternalPackages: ["nodemailer", "@aws-sdk/client-s3", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  webpack: (config, { nextRuntime }) => {
    // nodemailer (reached via the job worker) is Node-only. Keep it out of the
    // edge/client bundles so Next doesn't try to resolve Node core modules there.
    if (nextRuntime !== "nodejs") {
      config.resolve = config.resolve ?? {};
      const nodeBuiltins = ["stream", "crypto", "fs", "net", "tls", "dns", "path", "os", "zlib", "http", "https", "http2", "url", "util", "child_process", "dgram", "events", "buffer", "string_decoder", "assert", "querystring"];
      config.resolve.fallback = { ...config.resolve.fallback, ...Object.fromEntries(nodeBuiltins.map((m) => [m, false])) };
    }
    return config;
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
    {
      // The embeddable lead-capture form must be frameable by third-party sites.
      source: "/capture/form/:token",
      headers: [{ key: "X-Frame-Options", value: "ALLOWALL" }],
    },
  ],
};

export default withNextIntl(nextConfig);
