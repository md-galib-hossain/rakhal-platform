#!/usr/bin/env node
// Visual-regression gate orchestration (docs/migration/03-shared-ui-dedupe.md "Gate").
//
//   node scripts/visual-gate.mjs --base <git ref or sha>
//
// Builds the BASE ref and the current checkout (HEAD) of apps/web on THIS machine, screenshots a fixed set of routes
// from each, and fails if HEAD differs from BASE. No screenshot is ever committed: Windows and Linux render text
// differently, so a baseline is only valid on the machine that produced it. Doing both builds in one run removes that
// problem (and any dependence on the date, the network or the backend: the app talks to a mock API).
//
//   1. `git worktree add` BASE next to the checkout, and install its dependencies from its own lockfile.
//   2. Copy the gate definition (`apps/web/tests/visual`, `apps/web/playwright.visual.config.ts`) from HEAD into the
//      BASE worktree. The gate always comes from HEAD, so a PR that adds or changes it still has a BASE to compare
//      against even though BASE predates the gate. Only app code differs between the two builds.
//   3. Build BASE, run the specs there with `--update-snapshots` (writes `tests/visual/.baseline/`).
//   4. Build HEAD, copy the baseline across, run the specs without `--update-snapshots` (compares).
//
// Exit code: 0 identical, non-zero on any difference or setup failure. Playwright's HTML report and diff images are
// left in `apps/web/playwright-report-visual` and `apps/web/test-results-visual` for CI to upload.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const baseRef = args[args.indexOf("--base") + 1];
if (args.indexOf("--base") === -1 || !baseRef) {
  console.error("usage: visual-gate.mjs --base <git ref or sha>");
  process.exit(2);
}

const head = resolve(process.cwd());
const shell = process.platform === "win32";
const env = { ...process.env, NODE_ENV: "production", CI: process.env.CI ?? "1" };

function run(label, command, cmdArgs, cwd) {
  console.log(`\n::group::${label}`);
  const result = spawnSync(command, cmdArgs, {
    cwd,
    env,
    stdio: "inherit",
    shell: command === "git" ? false : shell,
  });
  console.log("::endgroup::");
  if (result.status !== 0) {
    console.error(`\nvisual gate: step failed: ${label} (exit ${result.status})`);
    return result.status ?? 1;
  }
  return 0;
}

const base = join(mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), "rakhal-visual-")), "base");
let code = 0;
let skipped = false;
try {
  const resolved = spawnSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], {
    cwd: head,
    encoding: "utf8",
  });
  if (resolved.status !== 0) throw new Error(`unknown base ref: ${baseRef}`);
  console.log(`visual gate: base ${resolved.stdout.trim()} vs head ${head}`);

  if (
    (code = run(
      "add base worktree",
      "git",
      ["worktree", "add", "--detach", base, baseRef],
      head,
    )) !== 0
  )
    throw new Error("add base worktree");
  if (!existsSync(join(base, "apps", "web", "package.json"))) {
    // The app is new in this change (for example the import PR itself): nothing exists to compare against.
    console.log(
      "\nvisual gate: SKIPPED (the base ref has no apps/web, so there is nothing to compare against)",
    );
    code = 0;
    skipped = true;
    throw new Error("skip");
  }
  if (
    (code = run(
      "install base",
      "pnpm",
      ["install", "--frozen-lockfile", "--prefer-offline"],
      base,
    )) !== 0
  )
    throw new Error("install base");
  // The gate definition always comes from HEAD.
  const webBase = join(base, "apps", "web");
  rmSync(join(webBase, "tests", "visual"), { recursive: true, force: true });
  cpSync(join(head, "apps", "web", "tests", "visual"), join(webBase, "tests", "visual"), {
    recursive: true,
    filter: (src) => !src.includes(join("tests", "visual", ".baseline")),
  });
  cpSync(
    join(head, "apps", "web", "playwright.visual.config.ts"),
    join(webBase, "playwright.visual.config.ts"),
  );

  const more = [
    ["build base", "pnpm", ["--dir", "apps/web", "exec", "next", "build"], base],
    [
      "screenshot base (write baseline)",
      "pnpm",
      [
        "--dir",
        "apps/web",
        "exec",
        "playwright",
        "test",
        "-c",
        "playwright.visual.config.ts",
        "--update-snapshots",
      ],
      base,
    ],
    ["build head", "pnpm", ["--dir", "apps/web", "exec", "next", "build"], head],
  ];
  for (const [label, cmd, a, cwd] of more)
    if ((code = run(label, cmd, a, cwd)) !== 0) throw new Error(label);

  const baseline = join(webBase, "tests", "visual", ".baseline");
  if (!existsSync(baseline)) throw new Error("the base run wrote no screenshots");
  const target = join(head, "apps", "web", "tests", "visual", ".baseline");
  rmSync(target, { recursive: true, force: true });
  cpSync(baseline, target, { recursive: true });

  code = run(
    "compare head against base",
    "pnpm",
    ["--dir", "apps/web", "exec", "playwright", "test", "-c", "playwright.visual.config.ts"],
    head,
  );
  console.log(
    code === 0
      ? "\nvisual gate: PASS (head renders identically to base)"
      : "\nvisual gate: FAIL (head differs from base; see the Playwright report)",
  );
} catch (error) {
  if (!skipped) {
    if (code === 0) code = 1;
    console.error(`visual gate: ${error instanceof Error ? error.message : error}`);
  }
} finally {
  spawnSync("git", ["worktree", "remove", "--force", base], { cwd: head, stdio: "ignore" });
  rmSync(base, { recursive: true, force: true });
}
process.exit(code);
