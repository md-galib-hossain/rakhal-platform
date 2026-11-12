import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // `next dev` (Turbopack) compiles each route on first hit — fullyParallel workers slamming
  // several distinct uncompiled routes at once reliably blew the default 30s test timeout
  // (verified: 9/10 timed out at fullyParallel:true, 0/10 with this config). Not a real bug.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    // RAKHAL-361 fix — `pnpm dev` binds `next dev -p 3005` (`package.json`'s own `dev` script), not
    // 3001; this config previously pointed here anyway, same class of stale-port bug RAKHAL-355
    // already fixed in `.claude/launch.json`. With this pointed at 3001, `reuseExistingServer`
    // silently attached to an unrelated app already listening on 3001 (a completely different
    // "Admin Portal" login page, confirmed live) instead of ever starting this repo's own dev
    // server — every Playwright spec in this suite (including the pre-existing `auth.spec.ts`) was
    // therefore failing/timing out in this environment before this fix, not just this ticket's new
    // `sales.spec.ts`.
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3005",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3005",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
