import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Land the bare URL on the Qatar Market Dashboard. The NEST Solutions
      // app remains reachable at /customer, /provider and /admin.
      { source: "/", destination: "/markets", permanent: false },
    ];
  },
};

export default nextConfig;
