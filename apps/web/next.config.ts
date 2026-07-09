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
};

export default withNextIntl(nextConfig);
