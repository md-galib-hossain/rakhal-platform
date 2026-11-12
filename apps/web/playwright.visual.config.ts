import { defineConfig } from "@playwright/test";

/**
 * Visual-regression gate for apps/web (docs/migration/03-shared-ui-dedupe.md "Gate",
 * docs/migration/M3-prep-visual-gate-and-branching-2026-11-12.md).
 *
 * Runs against a PRODUCTION build (`next start`), never `next dev`, so Tailwind output and the bundle match
 * what ships. There is no backend: server and BFF calls go to the dependency-free mock API in
 * `tests/visual/mock-api/` through the single `API_BASE_URL` env var.
 *
 * Baselines are never committed. CI builds the base ref and the PR head on the same runner, runs this suite
 * with `--update-snapshots` against the base to write `tests/visual/.baseline/`, then runs it again against the
 * head and compares (see `.github/workflows/visual.yml`). Windows and Linux render text differently, so a
 * baseline is only comparable with a run on the same OS.
 *
 * Host must be `localhost`: `proxy.ts` only treats `localhost` and the farm host as the app shell.
 */
const PORT = Number(process.env.VISUAL_PORT ?? 3105);
const MOCK_PORT = Number(process.env.VISUAL_MOCK_PORT ?? 4110);
const baseURL = `http://localhost:${PORT}`;
// Local runs on a machine without the Playwright Chromium can set VISUAL_CHANNEL=msedge (or chrome).
const channel = process.env.VISUAL_CHANNEL || undefined;

const sizes = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
} as const;

export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate: "{testDir}/.baseline/{projectName}/{testFileName}/{arg}{ext}",
  outputDir: "./test-results-visual",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-visual" }]],
  expect: {
    // Strict on purpose: a one-class change on a small control (e.g. a button radius) moves only tens of pixels, which a
    // ratio threshold of 0.1% (about 1,000 px at desktop size) would let through. The same-runner base-vs-head design is what makes
    // this affordable: there is no cross-machine rendering noise to absorb.
    toHaveScreenshot: { maxDiffPixels: 10, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL,
    channel,
    locale: "en-US",
    timezoneId: "Asia/Dhaka",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  projects: (["desktop", "mobile"] as const).flatMap((size) =>
    (["light", "dark"] as const).map((scheme) => ({
      name: `${size}-${scheme}`,
      use: { viewport: sizes[size], colorScheme: scheme },
    })),
  ),
  webServer: [
    {
      command: "node tests/visual/mock-api/server.mjs",
      stdout: "pipe",
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      env: { VISUAL_MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next start -p ${PORT}`,
      url: `${baseURL}/login`,
      env: { API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/api/v1` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
