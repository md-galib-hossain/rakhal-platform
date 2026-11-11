/**
 * Fails if any mobile colour token differs from the web source of truth (globals.css), except recorded
 * divergences (src/theme/divergences.ts).
 *
 * Default: compares against the vendored snapshot (vendor/web-globals.css, pinned, see vendor/SNAPSHOT.md),
 * so it runs in CI without the web repo. It also verifies the snapshot against its recorded sha256.
 *   --live                        compare against the live web file instead (RAKHAL_WEB_GLOBALS_CSS, else the
 *                                 sibling checkout) and HARD FAIL (exit 1) if the snapshot is
 *                                 stale (run refresh-web-snapshot).
 *   RAKHAL_WEB_GLOBALS_CSS=<path> same as --live with that path.
 * The web file is READ-ONLY. Refresh the snapshot with scripts/refresh-web-snapshot.ts.
 * Exit codes: 0 ok, 1 drift/stale divergence/stale snapshot under --live, 2 missing or corrupt input.
 */
import { existsSync, readFileSync } from 'node:fs';
import { colors } from '../src/theme/tokens.ts';
import { divergences } from '../src/theme/divergences.ts';
import { mobileOnlyColors } from '../src/theme/mobile-only.ts';
import { checkMobileOnly, describeWeb, diffTokens, parseWebTokens, reconcileDrifts, webOnlyVars } from './lib/drift.ts';
import { SNAPSHOT_CSS, SNAPSHOT_MD, liveGlobalsPath, readSnapshotMeta, sha256Text } from './lib/snapshot.ts';

const live = process.argv.includes('--live') || Boolean(process.env.RAKHAL_WEB_GLOBALS_CSS);

if (!existsSync(SNAPSHOT_CSS) || !existsSync(SNAPSHOT_MD)) {
  console.error('check-token-drift: vendor/web-globals.css or vendor/SNAPSHOT.md missing. Run scripts/refresh-web-snapshot.ts.');
  process.exit(2);
}
const snapshotText = readFileSync(SNAPSHOT_CSS, 'utf8');
const meta = readSnapshotMeta();
if (sha256Text(snapshotText) !== meta.sha256) {
  console.error('check-token-drift: vendor/web-globals.css does not match the sha256 in vendor/SNAPSHOT.md (hand-edited?).');
  console.error('Re-run scripts/refresh-web-snapshot.ts to regenerate both.');
  process.exit(2);
}

let sourceLabel = `snapshot vendor/web-globals.css (web commit ${meta.commit}, captured ${meta.capturedAt})`;
let css = snapshotText;
if (live) {
  const path = liveGlobalsPath();
  if (!existsSync(path)) {
    console.error(`check-token-drift --live: web globals.css not found at ${path}`);
    console.error('Set RAKHAL_WEB_GLOBALS_CSS to its location.');
    process.exit(2);
  }
  css = readFileSync(path, 'utf8');
  sourceLabel = `live ${path}`;
  if (sha256Text(css) !== meta.sha256) {
    console.error(`STALE SNAPSHOT: live web file sha256 ${sha256Text(css)} != snapshot ${meta.sha256}.`);
    console.error('The vendored snapshot no longer matches the web source. Run `node scripts/refresh-web-snapshot.ts` (pnpm refresh:web-snapshot), review the diff, and commit it.');
    process.exit(1);
  } else {
    console.log('Snapshot is current (live web file has the same sha256).');
  }
}

const web = parseWebTokens(css);
const drifts = diffTokens(colors, web);
const count = Object.keys(colors.light).length;

console.log(`Web source: ${sourceLabel}`);
console.log(`Web colour vars parsed: ${Object.keys(web.light).length} (:root), ${Object.keys(web.dark).length} (.dark overrides)`);
console.log(`Mobile tokens checked: ${count} light + ${count} dark`);

// Mobile-only tokens are declared in src/theme/mobile-only.ts; they must stay out of the web file (or match it).
const mobileOnly = checkMobileOnly(mobileOnlyColors, colors, web);
console.log(`Mobile-only tokens declared: ${Object.keys(mobileOnlyColors.light).join(', ')} (light + dark each)`);
for (const n of mobileOnly.nowInWeb) console.log(`  NOTE [${n.theme}] ${n.token}: web now declares ${n.cssVar} with the same value; consider promoting it to a shared token.`);
if (mobileOnly.issues.length) {
  console.error(`\nMOBILE-ONLY CONFLICT: ${mobileOnly.issues.length} declared mobile-only token(s) are not safely mobile-only:\n`);
  for (const i of mobileOnly.issues)
    console.error(
      i.kind === 'overlap'
        ? `  [${i.theme}] ${i.token}: also listed in the web-shared colours (tokens.ts); remove one`
        : `  [${i.theme}] ${i.token} (${i.cssVar})  mobile=${i.mobile}  web=${i.web} (web declares it with a different value; owner decides which wins)`,
    );
}

const extra = webOnlyVars(colors.light, web);
if (extra.length) console.log(`Web-only colour vars not carried by mobile (info): ${extra.join(', ')}`);

const { accepted, unexplained, stale } = reconcileDrifts(drifts, divergences);

if (accepted.length) {
  console.log(`Recorded divergences accepted (${accepted.length}, src/theme/divergences.ts):`);
  for (const d of accepted) console.log(`  [${d.theme}] ${d.token}  web=${d.web}  mobile=${d.mobile}`);
}

if (unexplained.length === 0 && stale.length === 0 && mobileOnly.issues.length === 0) {
  console.log('OK: no unrecorded drift.');
  process.exit(0);
}

if (unexplained.length) {
  console.error(`\nDRIFT: ${unexplained.length} token(s) differ from web and are not (exactly) recorded:\n`);
  for (const d of unexplained) {
    console.error(`  [${d.theme}] ${d.token} (${d.cssVar})  mobile=${d.mobile}  web=${describeWeb(d)}`);
  }
}
if (stale.length) {
  console.error(`\nSTALE divergence entr${stale.length === 1 ? 'y' : 'ies'} (no matching drift; update or remove):\n`);
  for (const e of stale) console.error(`  [${e.theme}] ${e.token}  recorded web=${e.webHex} mobile=${e.mobileHex}`);
}
process.exit(1);
