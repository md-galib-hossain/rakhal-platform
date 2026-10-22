import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source (no dist step, so no stale-build trap).
  transpilePackages: ["@rakhal/ui", "@rakhal/admin-api-client"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default config;
