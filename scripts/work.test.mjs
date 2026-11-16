// node --test scripts/work.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  applyClaim,
  checkWork,
  expandBraces,
  globsOverlap,
  loadClaim,
  matchGlob,
  parseFrontmatter,
  setFields,
} from "./work.mjs";

const NOW = new Date("2026-11-16T12:00:00Z");

function text(f = {}) {
  const d = {
    id: "T9",
    title: "Demo task",
    status: "active",
    agent: "agent-a",
    harness: "claude-code",
    branch: "feat/demo",
    paths: ["apps/demo/**"],
    started: "2026-11-10",
    updated: "2026-11-15",
    ...f,
  };
  const lines = ["---"];
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) lines.push(`${k}:`, ...v.map((x) => `  - ${x}`));
    else lines.push(`${k}: ${v === null ? "null" : v}`);
  }
  lines.push("---", "", "body");
  return lines.join("\n");
}
const claim = (f = {}) => loadClaim(`${f.id ?? "T9"}.md`, text(f));
const run = (claims, extra = {}) => checkWork({ claims, now: NOW, ...extra });

// ---------------------------------------------------------------- parser

test("parser: scalars, block list, inline list, quotes, comments, null", () => {
  const { data, body, errors } = parseFrontmatter(
    [
      "---",
      "# comment",
      "id: T1",
      'title: "Has: colon # and hash"',
      "agent: ~",
      "paths:",
      "  - a/**",
      "  - 'b/{x,y}/*.ts'",
      "depends_on: [T2, T3]",
      "blocked_by: []",
      "---",
      "hello",
    ].join("\r\n"),
  );
  assert.deepEqual(errors, []);
  assert.equal(data.id, "T1");
  assert.equal(data.title, "Has: colon # and hash");
  assert.equal(data.agent, null);
  assert.deepEqual(data.paths, ["a/**", "b/{x,y}/*.ts"]);
  assert.deepEqual(data.depends_on, ["T2", "T3"]);
  assert.deepEqual(data.blocked_by, []);
  assert.equal(body.trim(), "hello");
});

test("parser: inline list keeps braces together", () => {
  const { data } = parseFrontmatter("---\npaths: [a/{b,c}/**, d/*.ts]\n---\n");
  assert.deepEqual(data.paths, ["a/{b,c}/**", "d/*.ts"]);
});

test("parser: errors", () => {
  assert.match(parseFrontmatter("no front").errors[0], /no frontmatter/);
  assert.match(parseFrontmatter("---\nid: x\n").errors[0], /not closed/);
  const e = parseFrontmatter("---\nid: x\nid: y\nwhat is this\npaths: [a\n---\n").errors;
  assert.ok(e.some((m) => /duplicate key "id"/.test(m)));
  assert.ok(e.some((m) => /cannot parse "what is this"/.test(m)));
  assert.ok(e.some((m) => /not closed with \]/.test(m)));
});

// ---------------------------------------------------------------- validation (rule a)

test("a: a good claim has no errors", () => assert.deepEqual(claim().errors, []));

test("a: bad fields are reported with the file name", () => {
  const c = loadClaim(
    "T9.md",
    text({ status: "doing", updated: "2026-13-40", paths: [], extra: "x" }),
  );
  const all = c.errors.join("\n");
  assert.match(all, /T9\.md: "status" must be one of/);
  assert.match(all, /"updated" must be an ISO date/);
  assert.match(all, /"paths" is required/);
  assert.match(all, /unknown field "extra"/);
});

test("a: id must equal the file name; held status needs agent, harness, branch, started", () => {
  assert.match(loadClaim("T8.md", text()).errors.join(), /file must be named T9\.md/);
  const c = loadClaim("T9.md", text({ agent: null, harness: null, branch: null, started: null }));
  const all = c.errors.join("\n");
  for (const f of ["agent", "harness", "branch", "started"])
    assert.match(all, new RegExp(`needs "${f}"`));
});

test("a: open claim needs no agent; absolute, .. and whole-repo globs are rejected", () => {
  assert.deepEqual(
    loadClaim(
      "T9.md",
      text({ status: "open", agent: null, harness: null, branch: null, started: null }),
    ).errors,
    [],
  );
  assert.match(claim({ paths: ["/abs/**"] }).errors.join(), /relative to the repo root/);
  assert.match(claim({ paths: ["../x/**"] }).errors.join(), /relative to the repo root/);
  assert.match(claim({ paths: ["**"] }).errors.join(), /covers the whole repo/);
});

test("a: duplicate ids and depends_on", () => {
  const a = claim();
  const dup = loadClaim("T9-copy.md", text());
  const r = run([a, dup]);
  assert.ok(r.errors.some((m) => /duplicate claim id "T9": T9\.md and T9-copy\.md/.test(m)));

  const missing = claim({ id: "T4", depends_on: ["T1"] });
  assert.ok(
    run([missing]).errors.some((m) => /depends_on "T1", but no claim with that id exists/.test(m)),
  );

  const t1 = claim({ id: "T1", status: "abandoned", branch: "feat/old", agent: "ghost" });
  const t4 = claim({ id: "T4", depends_on: ["T1"], branch: "feat/t4", paths: ["apps/t4/**"] });
  assert.ok(
    run([t1, t4]).errors.some((m) =>
      /depends_on "T1", which is abandoned \(agent ghost, branch feat\/old\)/.test(m),
    ),
  );
});

// ---------------------------------------------------------------- globs

test("glob matching", () => {
  assert.ok(matchGlob("apps/mobile/**", "apps/mobile/src/a/b.ts"));
  assert.ok(matchGlob("apps/mobile/**/x.ts", "apps/mobile/x.ts"));
  assert.ok(matchGlob("apps/mobile/**/x.ts", "apps/mobile/a/b/x.ts"));
  assert.ok(!matchGlob("apps/mobile/*.ts", "apps/mobile/a/b.ts"));
  assert.ok(matchGlob("apps/mobile/app/(tabs)/milk.tsx", "apps/mobile/app/(tabs)/milk.tsx"));
  assert.ok(
    matchGlob("docs/mobile/M4-mobile-plan-*.md", "docs/mobile/M4-mobile-plan-2026-11-15.md"),
  );
  assert.ok(matchGlob("src/{a,b}/*.ts", "src/b/z.ts"));
  assert.ok(!matchGlob("src/{a,b}/*.ts", "src/c/z.ts"));
  assert.ok(matchGlob("f?.ts", "fa.ts"));
  assert.ok(!matchGlob("f?.ts", "f/.ts"));
  assert.ok(matchGlob("src/[ab].ts", "src/a.ts"));
  assert.deepEqual(expandBraces("a/{b,c{d,e}}/f"), ["a/b/f", "a/cd/f", "a/ce/f"]);
});

test("glob overlap: true cases", () => {
  const yes = [
    ["apps/mobile/**", "apps/mobile/src/milk/**"],
    ["apps/mobile/src/**", "apps/mobile/**/milk/*.ts"],
    ["apps/mobile/src/*.ts", "apps/mobile/src/m*"], // no shared file exists yet, still overlap
    ["a/*b", "a/c*"], // "cb"
    ["src/{a,b}/**", "src/b/x.ts"],
    ["apps/**/x.ts", "apps/mobile/**"],
    ["docs/**", "docs"], // d/** vs bare d: conservative
    ["f?.ts", "fa.*"],
    ["src/[ab]/x", "src/a/x"], // [..] read as ?
    ["**/milk.tsx", "apps/mobile/app/(tabs)/*.tsx"],
  ];
  for (const [a, b] of yes) {
    assert.ok(globsOverlap(a, b), `${a} vs ${b}`);
    assert.ok(globsOverlap(b, a), `${b} vs ${a}`);
  }
});

test("glob overlap: false cases", () => {
  const no = [
    ["apps/mobile/**", "apps/api/**"],
    ["apps/mobile/src/*.ts", "apps/mobile/src/milk/**"], // different depth
    ["a/*.ts", "a/*.tsx"],
    ["a/b*", "a/c*"],
    ["src/{a,b}/**", "src/c/**"],
    ["apps/mobile/app/(tabs)/milk.tsx", "apps/mobile/app/(tabs)/tasks.tsx"],
    [".github/workflows/mobile.yml", ".github/workflows/web.yml"],
    ["f?.ts", "f.ts"],
  ];
  for (const [a, b] of no) {
    assert.ok(!globsOverlap(a, b), `${a} vs ${b}`);
    assert.ok(!globsOverlap(b, a), `${b} vs ${a}`);
  }
});

// ---------------------------------------------------------------- rules b to e

const BRANCH = "feat/demo";

test("b: no claim for the branch", () => {
  const r = run([claim({ branch: "feat/other" })], { branch: BRANCH, changed: ["apps/demo/a.ts"] });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /branch "feat\/demo" matches no claim in status active\/review/);
  assert.match(r.errors[0], /node scripts\/work\.mjs claim <id>/);
});

test("b: branch names an open claim -> message names it", () => {
  const r = run([claim({ status: "open", branch: BRANCH })], {
    branch: BRANCH,
    changed: ["apps/demo/a.ts"],
  });
  assert.match(r.errors[0], /Claim T9 names this branch but is "open"/);
});

test("b: two claims on one branch", () => {
  const r = run([claim(), claim({ id: "T8", paths: ["apps/other/**"] })], {
    branch: BRANCH,
    changed: ["apps/demo/a.ts"],
  });
  assert.match(r.errors[0], /matches 2 claims \(T9 .*; T8 .*\)\. One branch = one claim/);
});

test("b: exemptions (hotfix/, no-claim label, docs/work only)", () => {
  assert.deepEqual(run([], { branch: "hotfix/x", changed: ["apps/api/a.ts"] }).errors, []);
  assert.deepEqual(
    run([], { branch: BRANCH, labels: ["no-claim"], changed: ["apps/api/a.ts"] }).errors,
    [],
  );
  assert.deepEqual(
    run([], { branch: BRANCH, changed: ["docs/work/claims/T1.md", "docs/work/LESSONS.md"] }).errors,
    [],
  );
  assert.ok(
    run([], { branch: BRANCH, changed: ["docs/work/x.md", "apps/api/a.ts"] }).errors.length > 0,
  );
  assert.deepEqual(run([], { branch: "main", changed: ["x"] }).errors, []);
});

test("b: a done claim still matches the PR that finishes it; review matches", () => {
  assert.deepEqual(
    run([claim({ status: "done" })], { branch: BRANCH, changed: ["apps/demo/a.ts"] }).errors,
    [],
  );
  assert.deepEqual(
    run([claim({ status: "review" })], { branch: BRANCH, changed: ["apps/demo/a.ts"] }).errors,
    [],
  );
});

test("c: file outside paths; names the claim that covers it", () => {
  const other = claim({ id: "T2", branch: "feat/t2", agent: "agent-b", paths: ["apps/api/**"] });
  const r = run([claim(), other], {
    branch: BRANCH,
    changed: ["apps/demo/a.ts", "apps/api/src/x.ts", "README.md"],
  });
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /file "apps\/api\/src\/x\.ts" is outside the paths of claim T9/);
  assert.match(r.errors[0], /covered by claim T2 \(agent agent-b, branch feat\/t2\)/);
  assert.match(r.errors[1], /file "README\.md" is outside the paths of claim T9/);
  assert.match(r.errors[1], /add a glob to paths in docs\/work\/claims\/T9\.md/);
});

test("c: docs/work, HANDOVER, the plan and shared globs are allowed", () => {
  const c = claim({ shared: ["apps/demo-i18n/messages.ts"] });
  const changed = [
    "docs/work/claims/T9.md",
    "docs/mobile/HANDOVER.md",
    "docs/mobile/M4-mobile-plan-2026-11-15.md",
    "apps/demo-i18n/messages.ts",
    "apps/demo/z.ts",
  ];
  assert.deepEqual(run([c], { branch: BRANCH, changed }).errors, []);
});

test("d: overlap with another claim on main", () => {
  const other = claim({
    id: "T2",
    branch: "feat/t2",
    agent: "agent-b",
    paths: ["apps/demo/sub/**"],
  });
  const r = run([claim(), other], { branch: BRANCH, changed: ["apps/demo/a.ts"] });
  assert.equal(r.errors.length, 1);
  assert.match(
    r.errors[0],
    /claim T9 \(paths "apps\/demo\/\*\*"\) overlaps claim T2 \(agent agent-b, branch feat\/t2, on main, paths "apps\/demo\/sub\/\*\*"\)/,
  );
});

test("d: overlap with a claim only in another open PR; same task claimed twice", () => {
  const prClaim = loadClaim(
    "T2.md",
    text({ id: "T2", branch: "feat/t2", agent: "agent-c", paths: ["apps/demo/**"] }),
  );
  const r = run([claim()], {
    branch: BRANCH,
    changed: ["apps/demo/a.ts"],
    others: [{ source: "PR #77 (feat/t2)", claim: prClaim }],
  });
  assert.match(
    r.errors[0],
    /overlaps claim T2 \(agent agent-c, branch feat\/t2, in open PR #77 \(feat\/t2\), paths "apps\/demo\/\*\*"\)/,
  );

  const same = loadClaim("T9.md", text({ branch: "feat/other-agent", agent: "agent-z" }));
  const r2 = run([claim()], {
    branch: BRANCH,
    changed: ["apps/demo/a.ts"],
    others: [{ source: "PR #78", claim: same }],
  });
  assert.match(
    r2.errors[0],
    /claim T9 is also active in open PR #78 \(feat\/other-agent\)? ?by agent agent-z|claim T9 is also active in open PR #78 by agent agent-z, branch feat\/other-agent/,
  );
});

test("d: open/done/abandoned claims and shared globs do not collide; own PR is skipped", () => {
  const open = claim({
    id: "T2",
    status: "open",
    agent: null,
    harness: null,
    branch: null,
    started: null,
    paths: ["apps/demo/**"],
  });
  const done = claim({ id: "T3", status: "done", branch: "feat/t3", paths: ["apps/demo/**"] });
  const aband = claim({
    id: "T5",
    status: "abandoned",
    branch: "feat/t5",
    paths: ["apps/demo/**"],
  });
  assert.deepEqual(
    run([claim(), open, done, aband], { branch: BRANCH, changed: ["apps/demo/a.ts"] }).errors,
    [],
  );

  const a = claim({
    paths: ["apps/demo/**", "apps/i18n/messages.ts"],
    shared: ["apps/i18n/other.ts"],
  });
  const b = claim({ id: "T2", branch: "feat/t2", paths: ["apps/i18n/messages.ts"] });
  assert.ok(
    run([a, b], { branch: BRANCH, changed: ["apps/demo/a.ts"] }).errors.length > 0,
    "paths vs paths collides",
  );
  const b2 = claim({
    id: "T2",
    branch: "feat/t2",
    paths: ["apps/t2/**"],
    shared: ["apps/i18n/messages.ts"],
  });
  assert.deepEqual(
    run([a, b2], { branch: BRANCH, changed: ["apps/demo/a.ts", "apps/i18n/messages.ts"] }).errors,
    [],
  );
});

test("e: stale active claim and unresolved blocked_by warn but do not fail", () => {
  const stale = claim({ updated: "2026-10-01", blocked_by: ["D4", "D8"], resolved: ["D8"] });
  const r = run([stale], { branch: BRANCH, changed: ["apps/demo/a.ts"] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 2);
  assert.match(
    r.warnings[0],
    /claim T9 is active but was last updated 46 days ago \(agent agent-a, branch feat\/demo\)/,
  );
  assert.match(r.warnings[1], /blocked_by D4 is not noted as resolved/);
  const fresh = run([claim({ updated: "2026-11-10" })], {});
  assert.deepEqual(fresh.warnings, []);
  assert.deepEqual(
    run([
      claim({
        status: "open",
        agent: null,
        harness: null,
        branch: null,
        started: null,
        blocked_by: ["D4"],
        updated: "2026-01-01",
      }),
    ]).warnings,
    [],
  );
});

test("errors from rule a are returned even without a branch", () => {
  assert.ok(run([loadClaim("T9.md", text({ status: "nope" }))]).errors.length > 0);
});

// ---------------------------------------------------------------- claim command

test("setFields edits in place, adds missing keys, keeps the body", () => {
  const src = text({ status: "open", agent: null, harness: null, branch: null, started: null });
  const out = setFields(src, { status: "active", agent: "me", branch: "feat/x y: z", extra: "1" });
  const p = parseFrontmatter(out);
  assert.equal(p.data.status, "active");
  assert.equal(p.data.agent, "me");
  assert.equal(p.data.branch, "feat/x y: z");
  assert.equal(p.data.extra, "1");
  assert.equal(p.body.trim(), "body");
});

test("applyClaim: sets status, dates, agent; refuses a held or done claim", () => {
  const open = claim({
    status: "open",
    agent: null,
    harness: null,
    branch: null,
    started: null,
    updated: "2026-11-01",
  });
  const out = applyClaim(open, { agent: "me", harness: "antigravity", branch: "feat/z" }, NOW);
  const d = loadClaim("T9.md", out);
  assert.deepEqual(d.errors, []);
  assert.equal(d.data.status, "active");
  assert.equal(d.data.started, "2026-11-16");
  assert.equal(d.data.updated, "2026-11-16");
  assert.equal(d.data.harness, "antigravity");

  assert.throws(
    () => applyClaim(claim(), { agent: "me", harness: "human", branch: "b" }, NOW),
    /claim T9 is already active \(agent agent-a, branch feat\/demo, updated 2026-11-15\)/,
  );
  assert.throws(
    () =>
      applyClaim(claim({ status: "done" }), { agent: "me", harness: "human", branch: "b" }, NOW),
    /is done/,
  );
  assert.throws(() => applyClaim(open, { agent: "me" }, NOW), /missing --harness, --branch/);
  const aband = claim({ status: "abandoned" });
  assert.equal(
    loadClaim("T9.md", applyClaim(aband, { agent: "new", harness: "human", branch: "feat/n" }, NOW))
      .data.agent,
    "new",
  );
});

test("CLI: claim then check on a temp dir", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "work-"));
  try {
    writeFileSync(
      join(dir, "T9.md"),
      text({ status: "open", agent: null, harness: null, branch: null, started: null }),
    );
    const script = new URL("./work.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const run1 = (...a) =>
      execFileSync(process.execPath, [script, ...a, "--claims-dir", dir], { encoding: "utf8" });
    run1("claim", "T9", "--agent", "tester", "--harness", "human", "--branch", "feat/cli");
    assert.match(readFileSync(join(dir, "T9.md"), "utf8"), /status: active/);
    assert.match(run1("list"), /T9\s+active\s+tester\s+human\s+feat\/cli/);
    const out = run1("check", "--no-network", "--branch", "feat/cli", "--files", "apps/demo/x.ts");
    assert.match(out, /0 errors/);
    assert.throws(
      () => run1("check", "--no-network", "--branch", "feat/cli", "--files", "elsewhere/x.ts"),
      (e) => /outside the paths of claim T9/.test(e.stdout),
    );
    assert.match(run1("prune"), /no done claims older than 30 days/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
