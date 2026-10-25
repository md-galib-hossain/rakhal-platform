import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo — an unrelated pnpm-lock.yaml sits at the
  // D:\Projects\Rakhal ancestor level (a different, unaffiliated workspace) and would
  // otherwise be auto-detected as the root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "local-rakhal-frontend.rakhal.app",
    "local-rakhal-backend.rakhal.app",
    "localhost:3005",
  ],
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            },
            {
              key: "CDN-Cache-Control",
              value: "no-store",
            },
            {
              key: "Cloudflare-CDN-Cache-Control",
              value: "no-store",
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default withNextIntl(nextConfig);
