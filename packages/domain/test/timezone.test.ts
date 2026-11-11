/**
 * Timezone independence, proven for real: the date, golden, money/number and name tests are re-run in child
 * `node --test` processes with TZ unset, UTC, America/Los_Angeles and Pacific/Kiritimati (UTC+14, the extreme
 * east; Los Angeles has DST). Any failing child fails this test. A canary per run proves the TZ actually took effect
 * in the child (otherwise the run would be vacuous), using local-time APIs that are legal in tests (never in src/).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const pkgDir = resolve(import.meta.dirname, "..");
const FILES = [
  "test/date.test.ts",
  "test/golden.test.ts",
  "test/money-number.test.ts",
  "test/digits-locale.test.ts",
  "test/differential-names.test.ts",
].map((f) => join(pkgDir, f));

type Run = { label: string; tz: string | undefined; canaryJan: number | undefined };
// getTimezoneOffset() is minutes WEST of UTC: LA winter 480, Kiritimati -840, UTC 0. Unset = whatever the host uses.
const RUNS: Run[] = [
  { label: "TZ unset", tz: undefined, canaryJan: undefined },
  { label: "TZ=UTC", tz: "UTC", canaryJan: 0 },
  { label: "TZ=America/Los_Angeles", tz: "America/Los_Angeles", canaryJan: 480 },
  { label: "TZ=Pacific/Kiritimati", tz: "Pacific/Kiritimati", canaryJan: -840 },
];

function childEnv(tz: string | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.TZ;
  delete env.NODE_TEST_CONTEXT; // otherwise the nested `node --test` thinks it is a reporter child and prints v8 frames
  if (tz !== undefined) env.TZ = tz;
  return env;
}

for (const run of RUNS) {
  test(`date + golden + money/number + names tests pass with ${run.label}`, () => {
    if (run.canaryJan !== undefined) {
      const probe = spawnSync(process.execPath, ["-e", "process.stdout.write(String(new Date(2026, 0, 15).getTimezoneOffset()))"], {
        env: childEnv(run.tz),
        encoding: "utf8",
      });
      assert.equal(probe.status, 0, probe.stderr);
      assert.equal(Number(probe.stdout), run.canaryJan, `TZ did not take effect in the child for ${run.label}`);
    }
    const res = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...FILES], {
      env: childEnv(run.tz),
      encoding: "utf8",
      cwd: pkgDir,
      timeout: 120_000,
    });
    assert.equal(res.error, undefined, String(res.error));
    assert.equal(res.status, 0, `child failed with ${run.label}:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /# fail 0/, `child output for ${run.label}:\n${res.stdout}`);
    assert.doesNotMatch(res.stdout, /# tests 0\b/, "child ran no tests");
  });
}
