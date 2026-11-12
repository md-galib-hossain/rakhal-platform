import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // node_modules.broken: a permission-corrupted leftover from this machine's pnpm store
    // (see CURRENT_STATE.md "Known environment issue") — undeletable by this account, must stay excluded.
    exclude: ["node_modules/**", "node_modules.broken/**", "tests/e2e/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
