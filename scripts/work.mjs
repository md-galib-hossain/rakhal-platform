#!/usr/bin/env node
// Work-claim tracker (docs/work/README.md). Zero dependencies, Node 24.
//
//   node scripts/work.mjs list [--status s] [--wide]
//   node scripts/work.mjs check [--no-network] [--branch b] [--base ref] [--files a,b] [--labels x,y]
//   node scripts/work.mjs claim <id> --agent NAME --harness H --branch B
//   node scripts/work.mjs status <id> <open|active|review|done|abandoned>
//   node scripts/work.mjs prune [--days 30]
//
// One file per task in docs/work/claims/<id>.md. `check` is what CI runs on every pull request. The pure logic is
// exported (parseFrontmatter, validateClaim, globsOverlap, checkWork, ...) and covered by scripts/work.test.mjs.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const STATUSES = ["open", "active", "review", "done", "abandoned"];
export const KNOWN_HARNESSES = ["claude-code", "antigravity", "human"];
const LIST_FIELDS = ["paths", "shared", "depends_on", "blocked_by", "resolved"];
const SCALAR_FIELDS = ["id", "title", "status", "agent", "harness", "branch", "started", "updated"];
const ALL_FIELDS = [...SCALAR_FIELDS, ...LIST_FIELDS];
// Files every task legitimately touches when it finishes (plan row, handover). Not charged to a claim's paths.
export const ALWAYS_ALLOWED = [
  "docs/work/**",
  "docs/mobile/HANDOVER.md",
  "docs/mobile/M4-mobile-plan-*.md",
];
export const STALE_DAYS = 14;
export const PRUNE_DAYS = 30;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- frontmatter

function parseScalar(raw) {
  const v = raw.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// Split on commas that are not inside quotes, braces or brackets (so `src/{a,b}/**` stays one item).
function splitTopLevel(str) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of str) {
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === "{" || ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === "}" || ch === "]") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

/** Parses the `---` block at the top of a claim file. Returns { data, body, errors }. */
export function parseFrontmatter(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const errors = [];
  const data = {};
  if (lines[0]?.trim() !== "---")
    return {
      data: null,
      body: String(text),
      errors: ["no frontmatter (file must start with ---)"],
    };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1)
    return { data: null, body: "", errors: ["frontmatter is not closed (missing second ---)"] };
  const body = lines.slice(end + 1).join("\n");
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (!m) {
      errors.push(
        `frontmatter line ${i + 1}: cannot parse "${line.trim()}" (expected "key: value")`,
      );
      continue;
    }
    const [, key, rawVal] = m;
    if (key in data) {
      errors.push(`frontmatter line ${i + 1}: duplicate key "${key}"`);
      continue;
    }
    const val = rawVal.trim();
    if (val.startsWith("[")) {
      if (!val.endsWith("]")) {
        errors.push(`frontmatter line ${i + 1}: "${key}" list is not closed with ]`);
        continue;
      }
      data[key] = splitTopLevel(val.slice(1, -1)).map(parseScalar);
    } else if (val === "") {
      const items = [];
      let j = i + 1;
      while (j < end) {
        const im = /^[ \t]+-[ \t]+(.*)$/.exec(lines[j]);
        if (!im) break;
        items.push(parseScalar(im[1]));
        j++;
      }
      if (items.length > 0) {
        data[key] = items;
        i = j - 1;
      } else data[key] = null;
    } else data[key] = parseScalar(val);
  }
  return { data, body, errors };
}

// ---------------------------------------------------------------- validation

function validDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Field-level validation of one parsed claim. `file` is the basename (id must equal it without `.md`). */
export function validateClaim(data, file) {
  const errs = [];
  const e = (msg) => errs.push(`${file}: ${msg}`);
  if (!data) return errs;
  for (const k of Object.keys(data))
    if (!ALL_FIELDS.includes(k)) e(`unknown field "${k}" (allowed: ${ALL_FIELDS.join(", ")})`);
  if (typeof data.id !== "string" || !ID_RE.test(data.id))
    e(`"id" is required and must match ${ID_RE}`);
  else if (`${data.id}.md` !== file)
    e(`"id" is "${data.id}" but the file must be named ${data.id}.md`);
  if (typeof data.title !== "string" || data.title.trim() === "") e(`"title" is required`);
  if (!STATUSES.includes(data.status))
    e(`"status" must be one of ${STATUSES.join(", ")} (got ${JSON.stringify(data.status)})`);
  for (const k of LIST_FIELDS) {
    if (data[k] == null) continue;
    if (!Array.isArray(data[k])) e(`"${k}" must be a list`);
    else if (data[k].some((x) => typeof x !== "string" || x === ""))
      e(`"${k}" must contain non-empty strings`);
  }
  if (!Array.isArray(data.paths) || data.paths.length === 0)
    e(`"paths" is required and must list at least one glob`);
  else {
    for (const p of [...data.paths, ...(Array.isArray(data.shared) ? data.shared : [])]) {
      if (typeof p !== "string") continue;
      if (
        p.startsWith("/") ||
        /^[A-Za-z]:/.test(p) ||
        p.includes("\\") ||
        p.split("/").includes("..")
      ) {
        e(`path glob "${p}" must be relative to the repo root, use "/", and contain no ".."`);
      } else if (/^(\*\*?|\*\*\/\*+)$/.test(p))
        e(`path glob "${p}" covers the whole repo; list the directories you will edit`);
    }
  }
  const held = ["active", "review", "done"].includes(data.status);
  if (held) {
    if (!data.agent) e(`status "${data.status}" needs "agent"`);
    if (!data.harness)
      e(`status "${data.status}" needs "harness" (${KNOWN_HARNESSES.join(" | ")} | other)`);
    if (!data.branch) e(`status "${data.status}" needs "branch"`);
    if (!data.started) e(`status "${data.status}" needs "started"`);
  }
  if (
    data.harness != null &&
    (typeof data.harness !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(data.harness))
  ) {
    e(`"harness" must be a lowercase slug such as ${KNOWN_HARNESSES.join(", ")}`);
  }
  for (const k of ["started", "updated"])
    if (data[k] != null && !validDate(data[k]))
      e(`"${k}" must be an ISO date YYYY-MM-DD (got ${JSON.stringify(data[k])})`);
  if (data.updated == null) e(`"updated" is required (YYYY-MM-DD)`);
  return errs;
}

// ---------------------------------------------------------------- globs

/** Expands {a,b} alternatives (nesting allowed). */
export function expandBraces(glob) {
  const open = glob.indexOf("{");
  if (open === -1) return [glob];
  let depth = 0;
  let close = -1;
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === "{") depth++;
    else if (glob[i] === "}" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close === -1) return [glob];
  const pre = glob.slice(0, open);
  const post = glob.slice(close + 1);
  return splitTopLevel(glob.slice(open + 1, close)).flatMap((alt) =>
    expandBraces(pre + alt + post),
  );
}

const reCache = new Map();
function altToRegexSource(g) {
  let out = "";
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    if (ch === "*") {
      if (g[i + 1] === "*") {
        const atStart = i === 0 || g[i - 1] === "/";
        if (atStart && g[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else out += "[^/]*";
    } else if (ch === "?") out += "[^/]";
    else if (ch === "[") {
      const close = g.indexOf("]", i + 2);
      if (close === -1) out += "\\[";
      else {
        let cls = g.slice(i + 1, close);
        if (cls[0] === "!") cls = `^${cls.slice(1)}`;
        out += `[${cls.replace(/\\/g, "\\\\")}]`;
        i = close;
      }
    } else out += ch.replace(/[.+^${}()|\\/]/g, "\\$&");
  }
  return out;
}

/** True if repo-relative `file` matches `glob` (`*` within a segment, `**` any depth, `?`, `[..]`, `{a,b}`). */
export function matchGlob(glob, file) {
  let re = reCache.get(glob);
  if (!re) {
    re = new RegExp(
      `^(?:${expandBraces(glob.replace(/^\.\//, "")).map(altToRegexSource).join("|")})$`,
    );
    reCache.set(glob, re);
  }
  return re.test(file.replace(/^\.\//, ""));
}
export const matchesAny = (globs, file) => globs.some((g) => matchGlob(g, file));

// Do two single path segments (no "/") share a string? Handles `*` and `?` exactly; `[..]` was turned into `?`
// beforehand (a superset, so conservative).
function segOverlap(p, q) {
  p = p.replace(/\*+/g, "*");
  q = q.replace(/\*+/g, "*");
  const memo = new Map();
  const f = (i, j) => {
    const key = i * 4096 + j;
    if (memo.has(key)) return memo.get(key);
    let r = false;
    if (i === p.length && j === q.length) r = true;
    else {
      if (p[i] === "*") r = f(i + 1, j) || (j < q.length && f(i, j + 1));
      if (!r && q[j] === "*") r = f(i, j + 1) || (i < p.length && f(i + 1, j));
      if (!r && i < p.length && j < q.length && p[i] !== "*" && q[j] !== "*") {
        r = (p[i] === q[j] || p[i] === "?" || q[j] === "?") && f(i + 1, j + 1);
      }
    }
    memo.set(key, r);
    return r;
  };
  return f(0, 0);
}

function segsOverlap(a, b) {
  const memo = new Map();
  const f = (i, j) => {
    const key = i * 4096 + j;
    if (memo.has(key)) return memo.get(key);
    let r = false;
    const A = a[i];
    const B = b[j];
    if (i === a.length && j === b.length) r = true;
    else if (A === "**" && f(i + 1, j))
      r = true; // ** matches zero segments
    else if (B === "**" && f(i, j + 1)) r = true;
    else if (A === "**" && j < b.length && f(i, j + 1))
      r = true; // ** swallows b[j]
    else if (B === "**" && i < a.length && f(i + 1, j)) r = true;
    else if (i < a.length && j < b.length && A !== "**" && B !== "**")
      r = segOverlap(A, B) && f(i + 1, j + 1);
    memo.set(key, r);
    return r;
  };
  return f(0, 0);
}

/**
 * Could some path match both globs? Conservative: when unsure it answers true.
 * Segment by segment: `**` may swallow any number of segments (including none), `*` and `?` inside a segment are
 * intersected exactly, `[..]` is read as `?`, `{a,b}` is expanded. Two globs overlap even when no file exists yet
 * (`app/*.ts` vs `app/m*`), and a glob `d/**` is considered to overlap the bare path `d`. A bare directory name
 * without a glob is NOT expanded to its contents: write `dir/**`.
 */
export function globsOverlap(a, b) {
  const norm = (g) => expandBraces(g.replace(/^\.\//, "").replace(/\[[^\]]*\]/g, "?"));
  for (const x of norm(a))
    for (const y of norm(b)) if (segsOverlap(x.split("/"), y.split("/"))) return true;
  return false;
}

/** First pair [globA, globB] from the two lists that overlap, or null. */
export function findOverlap(listA, listB) {
  for (const a of listA) for (const b of listB) if (globsOverlap(a, b)) return [a, b];
  return null;
}

// ---------------------------------------------------------------- claims on disk

export function loadClaim(file, text) {
  const { data, body, errors } = parseFrontmatter(text);
  const errs = errors.map((m) => `${file}: ${m}`);
  if (data) errs.push(...validateClaim(data, file));
  return { file, data, body, errors: errs, text };
}

export function readClaims(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort()
    .map((f) => loadClaim(f, readFileSync(join(dir, f), "utf8")));
}

const daysBetween = (isoDate, now) =>
  Math.floor((now.getTime() - new Date(`${isoDate}T00:00:00Z`).getTime()) / 86400000);
const who = (d) => `agent ${d.agent ?? "?"}, branch ${d.branch ?? "?"}`;
const holding = (d) => d.status === "active" || d.status === "review";

// ---------------------------------------------------------------- the check

/**
 * Pure rule engine.
 *   claims  claims found on disk (effective state after merge in CI)
 *   branch  PR head branch, or null (then rules b-d are skipped)
 *   labels  PR labels
 *   changed changed files of the PR (repo-relative, "/"), or null if unknown
 *   others  claims of other OPEN pull requests: [{ source: "PR #12", claim }]
 * Returns { errors, warnings }.
 */
export function checkWork({
  claims,
  branch = null,
  labels = [],
  changed = null,
  others = [],
  now = new Date(),
}) {
  const errors = [];
  const warnings = [];

  // rule a: parse, fields, unique ids, depends_on
  for (const c of claims) errors.push(...c.errors);
  const byId = new Map();
  for (const c of claims) {
    const id = c.data?.id;
    if (typeof id !== "string") continue;
    if (byId.has(id)) errors.push(`duplicate claim id "${id}": ${byId.get(id).file} and ${c.file}`);
    else byId.set(id, c);
  }
  for (const c of claims) {
    if (!c.data || !Array.isArray(c.data.depends_on)) continue;
    for (const dep of c.data.depends_on) {
      const t = byId.get(dep);
      if (!t) errors.push(`${c.file}: depends_on "${dep}", but no claim with that id exists`);
      else if (t.data.status === "abandoned") {
        errors.push(
          `${c.file}: depends_on "${dep}", which is abandoned (${who(t.data)}). Re-claim ${dep} or drop the dependency.`,
        );
      }
    }
  }
  const valid = claims.filter((c) => c.errors.length === 0);

  // rule e: warnings
  for (const c of valid) {
    const d = c.data;
    if (d.status === "active" && daysBetween(d.updated, now) > STALE_DAYS) {
      warnings.push(
        `claim ${d.id} is active but was last updated ${daysBetween(d.updated, now)} days ago (${who(d)}). Update it, or set it abandoned with a handover note.`,
      );
    }
    if (holding(d)) {
      for (const b of d.blocked_by ?? []) {
        if (!(d.resolved ?? []).includes(b)) {
          warnings.push(
            `claim ${d.id} is ${d.status} but blocked_by ${b} is not noted as resolved (add "${b}" to resolved: once the owner decided).`,
          );
        }
      }
    }
  }

  if (!branch || ["main", "master", "HEAD", "develop"].includes(branch)) return { errors, warnings };

  // exemptions for rules b-d
  if (branch.startsWith("hotfix/")) return { errors, warnings };
  if (labels.includes("no-claim")) return { errors, warnings };
  if (changed && changed.every((f) => f.startsWith("docs/work/"))) return { errors, warnings };

  // rule b: exactly one claim for this branch
  const mine = valid.filter(
    (c) => c.data.branch === branch && ["active", "review", "done"].includes(c.data.status),
  );
  if (mine.length === 0) {
    const hint = valid.filter((c) => c.data.branch === branch);
    errors.push(
      `branch "${branch}" matches no claim in status active/review. ` +
        (hint.length
          ? `Claim ${hint[0].data.id} names this branch but is "${hint[0].data.status}". `
          : "") +
        `Run: node scripts/work.mjs claim <id> --agent <name> --harness <claude-code|antigravity|human> --branch ${branch} ` +
        `and commit docs/work/claims/<id>.md. Exempt: branch prefix hotfix/, label no-claim, or a PR that only touches docs/work/**.`,
    );
    return { errors, warnings };
  }
  if (mine.length > 1) {
    errors.push(
      `branch "${branch}" matches ${mine.length} claims (${mine.map((c) => `${c.data.id} (${who(c.data)})`).join("; ")}). One branch = one claim.`,
    );
    return { errors, warnings };
  }
  const me = mine[0].data;
  const myFile = mine[0].file;

  // rule c: every changed file is covered by my paths
  if (changed) {
    const mineGlobs = [...me.paths, ...(me.shared ?? [])];
    for (const f of changed) {
      if (matchesAny(ALWAYS_ALLOWED, f) || matchesAny(mineGlobs, f)) continue;
      const owner = valid.find(
        (c) =>
          c.data.id !== me.id &&
          holding(c.data) &&
          matchesAny([...c.data.paths, ...(c.data.shared ?? [])], f),
      );
      errors.push(
        `file "${f}" is outside the paths of claim ${me.id} (${me.paths.join(", ")}). ` +
          (owner
            ? `It is covered by claim ${owner.data.id} (${who(owner.data)}); do not edit it, or ask that agent. `
            : "") +
          `If it is yours, add a glob to paths in docs/work/claims/${myFile}; otherwise ask the owner.`,
      );
    }
  }

  // rule d: no overlap with other active/review claims (on disk, and in other open PRs)
  if (me.status !== "done") {
    const rivals = [
      ...valid
        .filter((c) => c.data.id !== me.id && holding(c.data))
        .map((c) => ({ d: c.data, where: "on main" })),
      ...others
        .filter((o) => o.claim?.data && o.claim.errors.length === 0 && holding(o.claim.data))
        .map((o) => ({ d: o.claim.data, where: `in open ${o.source}` })),
    ];
    for (const r of rivals) {
      if (r.d.id === me.id) {
        if (r.d.branch !== me.branch)
          errors.push(
            `claim ${me.id} is also ${r.d.status} ${r.where} by ${who(r.d)}. Two agents on one task: one of you must stop (set abandoned or pick another task).`,
          );
        continue;
      }
      if (r.d.branch === me.branch) continue;
      const hit = findOverlap(me.paths, r.d.paths);
      if (hit) {
        errors.push(
          `claim ${me.id} (paths "${hit[0]}") overlaps claim ${r.d.id} (${who(r.d)}, ${r.where}, paths "${hit[1]}"). ` +
            `Narrow your paths, wait for ${r.d.id} to reach done, or mark the common file under shared: if you both only append to it.`,
        );
      }
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------- claim file editing

function formatScalar(v) {
  const s = String(v);
  return /^[\s"'\[\]{}#>|&*!%@`-]|[:#]\s|\s$|^(null|~)$/.test(s) ? JSON.stringify(s) : s;
}

/** Sets scalar frontmatter keys in place (keeps the rest of the file byte for byte). */
export function setFields(text, fields) {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (lines[0]?.trim() !== "---" || end === -1) throw new Error("claim file has no frontmatter");
  let close = end;
  for (const [k, v] of Object.entries(fields)) {
    const line = `${k}: ${v == null ? "null" : formatScalar(v)}`;
    const idx = lines.findIndex((l, i) => i > 0 && i < close && l.startsWith(`${k}:`));
    if (idx === -1) {
      lines.splice(close, 0, line);
      close++;
    } else lines[idx] = line;
  }
  return lines.join(nl);
}

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

/** Returns the new file text, or throws with a clear reason. */
export function applyClaim(claim, { agent, harness, branch }, now = new Date()) {
  if (claim.errors.length)
    throw new Error(`claim file is invalid:\n  ${claim.errors.join("\n  ")}`);
  const d = claim.data;
  if (d.status === "active" || d.status === "review") {
    throw new Error(
      `claim ${d.id} is already ${d.status} (${who(d)}, updated ${d.updated}). Pick another task, or ask that agent/the owner to set it abandoned first.`,
    );
  }
  if (d.status === "done") throw new Error(`claim ${d.id} is done.`);
  const missing = Object.entries({ agent, harness, branch })
    .filter(([, v]) => !v)
    .map(([k]) => `--${k}`);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  const today = todayIso(now);
  return setFields(claim.text, {
    status: "active",
    agent,
    harness,
    branch,
    started: today,
    updated: today,
  });
}

// ---------------------------------------------------------------- CLI plumbing

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else pos.push(a);
  }
  return { pos, flags };
}

const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const gh = (...args) =>
  execFileSync("gh", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function localChangedFiles(base) {
  const set = new Set();
  const add = (s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => set.add(x));
  try {
    add(git("diff", "--name-only", `${base}...HEAD`));
  } catch {
    add(git("diff", "--name-only", base));
  }
  add(git("diff", "--name-only", "HEAD"));
  add(git("ls-files", "-o", "--exclude-standard"));
  return [...set];
}

function eventPayload() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// Claims proposed by other open PRs: read from each PR's head commit through the GitHub API.
function fetchOtherPrClaims(repo, ownBranch) {
  const rows = gh(
    "api",
    `repos/${repo}/pulls?state=open&per_page=100`,
    "--paginate",
    "--jq",
    ".[] | [.number, .head.sha, .head.repo.full_name, .head.ref] | @tsv",
  )
    .split("\n")
    .filter(Boolean);
  const out = [];
  for (const row of rows) {
    const [number, sha, headRepo, ref] = row.split("\t");
    if (ref === ownBranch) continue;
    const files = gh(
      "api",
      `repos/${repo}/pulls/${number}/files`,
      "--paginate",
      "--jq",
      '.[] | select(.status != "removed") | .filename',
    )
      .split("\n")
      .filter((f) => /^docs\/work\/claims\/[^/]+\.md$/.test(f));
    for (const f of files) {
      const text = gh(
        "api",
        "-H",
        "Accept: application/vnd.github.raw",
        `repos/${headRepo}/contents/${encodeURI(f)}?ref=${sha}`,
      );
      out.push({ source: `PR #${number} (${ref})`, claim: loadClaim(basename(f), text) });
    }
  }
  return out;
}

function cmdList(args, dir) {
  const claims = readClaims(dir);
  const order = (c) => STATUSES.indexOf(c.data?.status ?? "open");
  const rows = claims
    .filter((c) => !args.flags.status || c.data?.status === args.flags.status)
    .sort((a, b) => order(a) - order(b) || a.file.localeCompare(b.file, "en", { numeric: true }));
  const cut = (s) => (args.flags.wide || s.length <= 48 ? s : `${s.slice(0, 45)}...`);
  const table = [["ID", "STATUS", "AGENT", "HARNESS", "BRANCH", "UPDATED", "PATHS"]];
  for (const c of rows) {
    const d = c.data;
    if (!d) {
      table.push([c.file, "INVALID", "", "", "", "", ""]);
      continue;
    }
    const extra = d.blocked_by?.length ? ` [blocked_by ${d.blocked_by.join(",")}]` : "";
    table.push([
      String(d.id),
      d.status,
      d.agent ?? "-",
      d.harness ?? "-",
      d.branch ?? "-",
      d.updated ?? "-",
      cut((d.paths ?? []).join(", ")) + extra,
    ]);
  }
  const w = table[0].map((_, i) => Math.max(...table.map((r) => r[i].length)));
  for (const r of table)
    console.log(
      r
        .map((x, i) => (i === r.length - 1 ? x : x.padEnd(w[i])))
        .join("  ")
        .trimEnd(),
    );
  if (rows.length === 0) console.log("(no claims)");
  return 0;
}

async function cmdCheck(args, dir) {
  const claims = readClaims(dir);
  const ev = eventPayload();
  const pr = ev?.pull_request;
  let branch =
    (typeof args.flags.branch === "string"
      ? args.flags.branch
      : (pr?.head?.ref ?? process.env.GITHUB_HEAD_REF)) || null;
  if (!branch) {
    try {
      branch = git("rev-parse", "--abbrev-ref", "HEAD");
    } catch {
      branch = null;
    }
  }
  const labels =
    typeof args.flags.labels === "string"
      ? args.flags.labels.split(",")
      : (pr?.labels ?? []).map((l) => l.name);
  const repo = process.env.GITHUB_REPOSITORY;
  const noNet = Boolean(args.flags["no-network"]);
  let changed = null;
  const errors = [];
  try {
    if (typeof args.flags.files === "string") changed = args.flags.files.split(",").filter(Boolean);
    else if (pr && repo && !noNet) {
      changed = gh(
        "api",
        `repos/${repo}/pulls/${pr.number}/files`,
        "--paginate",
        "--jq",
        ".[].filename",
      )
        .split("\n")
        .filter(Boolean);
    } else
      changed = localChangedFiles(
        typeof args.flags.base === "string" ? args.flags.base : "origin/main",
      );
  } catch (err) {
    errors.push(
      `could not list the files changed by this branch (${String(err.message).split("\n")[0]}); pass --files a,b or --base <ref>`,
    );
  }
  let others = [];
  if (noNet)
    console.log(
      "note: --no-network: claims in other open pull requests were NOT compared (rule d is partial).",
    );
  else {
    try {
      const slug = repo ?? JSON.parse(gh("repo", "view", "--json", "nameWithOwner")).nameWithOwner;
      others = fetchOtherPrClaims(slug, branch);
    } catch (err) {
      errors.push(
        `could not read other open pull requests through gh (${String(err.message).split("\n")[0]}). In CI this needs GH_TOKEN with pull-requests: read; locally use --no-network.`,
      );
    }
  }
  const res = checkWork({ claims, branch, labels, changed, others });
  res.errors.unshift(...errors);
  for (const w of res.warnings) console.log(`warning: ${w}`);
  for (const e of res.errors) console.log(`error: ${e}`);
  console.log(
    `work check: ${claims.length} claims, branch ${branch ?? "(none)"}, ${res.errors.length} errors, ${res.warnings.length} warnings`,
  );
  return res.errors.length ? 1 : 0;
}

function cmdClaim(args, dir) {
  const id = args.pos[0];
  if (!id) return usage("claim needs an id");
  const claim = readClaims(dir).find((c) => c.data?.id === id || c.file === `${id}.md`);
  if (!claim) return usage(`no claim file docs/work/claims/${id}.md`);
  const { agent, harness, branch } = args.flags;
  try {
    const next = applyClaim(claim, {
      agent: typeof agent === "string" ? agent : null,
      harness: typeof harness === "string" ? harness : null,
      branch: typeof branch === "string" ? branch : null,
    });
    writeFileSync(join(dir, claim.file), next);
  } catch (err) {
    console.error(`error: ${err.message}`);
    return 1;
  }
  const d = claim.data;
  if (d.blocked_by?.some((b) => !(d.resolved ?? []).includes(b)))
    console.log(
      `warning: ${id} is blocked_by ${d.blocked_by.join(", ")} (owner decisions). Do only the unblocked part and report the rest.`,
    );
  const all = readClaims(dir);
  for (const dep of d.depends_on ?? []) {
    const t = all.find((c) => c.data?.id === dep);
    if (t && t.data.status !== "done")
      console.log(`warning: ${id} depends_on ${dep}, which is ${t.data.status}.`);
  }
  console.log(
    `claimed ${id}: status active, agent ${agent}, branch ${branch}. Commit docs/work/claims/${id}.md as the FIRST commit of the branch.`,
  );
  console.log("next: node scripts/work.mjs check --no-network");
  return 0;
}

function cmdStatus(args, dir) {
  const [id, status] = args.pos;
  if (!id || !STATUSES.includes(status)) return usage(`usage: status <id> <${STATUSES.join("|")}>`);
  const claim = readClaims(dir).find((c) => c.data?.id === id);
  if (!claim) return usage(`no claim "${id}"`);
  writeFileSync(join(dir, claim.file), setFields(claim.text, { status, updated: todayIso() }));
  console.log(`${id}: status ${status}, updated ${todayIso()}`);
  return 0;
}

function cmdPrune(args, dir) {
  const days = Number(args.flags.days) || PRUNE_DAYS;
  const now = new Date();
  const old = readClaims(dir).filter(
    (c) => c.data?.status === "done" && c.data.updated && daysBetween(c.data.updated, now) > days,
  );
  for (const c of old)
    console.log(
      `${c.data.id}\tdone\tupdated ${c.data.updated} (${daysBetween(c.data.updated, now)} days)\tgit rm docs/work/claims/${c.file}`,
    );
  console.log(
    old.length
      ? `${old.length} done claim(s) older than ${days} days: remove them in a docs-only PR (history keeps them).`
      : `no done claims older than ${days} days`,
  );
  return 0;
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "usage: work.mjs list|check|claim|status|prune (see the header of scripts/work.mjs and docs/work/README.md)",
  );
  return 2;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const args = parseArgs(rest);
  const dir =
    typeof args.flags["claims-dir"] === "string"
      ? resolve(args.flags["claims-dir"])
      : join(repoRoot, "docs", "work", "claims");
  switch (cmd) {
    case "list":
      return cmdList(args, dir);
    case "check":
      return cmdCheck(args, dir);
    case "claim":
      return cmdClaim(args, dir);
    case "status":
      return cmdStatus(args, dir);
    case "prune":
      return cmdPrune(args, dir);
    default:
      return usage(cmd ? `unknown command "${cmd}"` : "");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
