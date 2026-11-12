import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
