#!/usr/bin/env node
// Route-manifest parity check for the apps/web import (docs/migration/01-consumer-frontend.md, M2).
//
// Any route that differs between the original app and the monorepo copy at the same commit is a bug in the
// import, not a feature. This compares the set of app routes, read from each build's
// `.next/app-path-routes-manifest.json` (a stable, structured file; far less fragile than scraping `next build`
// output).
//
//   # monorepo build against the recorded baseline (what CI runs; needs no second checkout)
//   node scripts/compare-web-routes.mjs --monorepo apps/web --baseline docs/migration/baseline/web-routes-92e24e8.txt
//
//   # monorepo build against a build of the original repo at the same commit
//   node scripts/compare-web-routes.mjs --monorepo apps/web --original ../rakhal-consumer-frontend
//
// Both sides must have been built (`next build`). Exit code: 0 identical, 1 differences, 2 usage or missing input.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith("--") || argv[i + 1] === undefined) usage(`bad argument: ${key}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

function usage(msg) {
  console.error(
    `${msg}\nusage: compare-web-routes.mjs --monorepo <apps/web dir> (--baseline <routes.txt> | --original <dir>)`,
  );
  process.exit(2);
}

/** Routes of a built Next app: the values of `.next/app-path-routes-manifest.json`. */
function routesFromBuild(appDir) {
  const file = join(appDir, ".next", "app-path-routes-manifest.json");
  if (!existsSync(file)) {
    console.error(`missing ${file}: run \`next build\` in ${appDir} first`);
    process.exit(2);
  }
  return new Set(Object.values(JSON.parse(readFileSync(file, "utf8"))));
}

/**
 * Routes of a recorded `next build` route list (`web-routes-<sha>.txt`): lines like `├ ƒ /animals/[id]`.
 * The header comment line and anything that is not a route line is ignored.
 */
function routesFromBaseline(file) {
  if (!existsSync(file)) usage(`missing baseline ${file}`);
  const routes = new Set();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    const m = /(\/\S*)\s*$/u.exec(line);
    if (m) routes.add(m[1]);
  }
  return routes;
}

/** `/_not-found` and friends appear in the build table but not in the manifest under the same name. */
const normalise = (set) =>
  new Set([...set].filter((r) => r !== "/_not-found" && r !== "/_global-error" && r !== "/_error"));

const args = parseArgs(process.argv.slice(2));
if (!args.monorepo) usage("--monorepo is required");
if (Boolean(args.baseline) === Boolean(args.original))
  usage("pass exactly one of --baseline or --original");

// The build table (and so the recorded baseline) lists page and route-handler routes but not metadata files such as
// the favicon, which only the manifest has. Original-vs-monorepo mode compares them exactly; baseline mode cannot.
const METADATA_ROUTES = new Set(["/favicon.ico"]);
let mono = normalise(routesFromBuild(args.monorepo));
if (args.baseline) mono = new Set([...mono].filter((r) => !METADATA_ROUTES.has(r)));
const [refName, ref] = args.baseline
  ? [`baseline ${args.baseline}`, normalise(routesFromBaseline(args.baseline))]
  : [`original build ${args.original}`, normalise(routesFromBuild(args.original))];

const onlyMono = [...mono].filter((r) => !ref.has(r)).sort();
const onlyRef = [...ref].filter((r) => !mono.has(r)).sort();

console.log(`monorepo routes: ${mono.size}, ${refName}: ${ref.size}`);
if (onlyMono.length === 0 && onlyRef.length === 0) {
  console.log("route parity: identical");
  process.exit(0);
}
for (const r of onlyMono) console.log(`+ only in monorepo: ${r}`);
for (const r of onlyRef) console.log(`- only in ${args.baseline ? "baseline" : "original"}: ${r}`);
console.log("route parity: DIFFERENT (an import bug, not a feature)");
process.exit(1);
