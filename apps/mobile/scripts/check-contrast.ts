/**
 * WCAG contrast over the pairs listed in contrastPairs (src/theme/tokens.ts), both themes.
 * text pairs need 4.5:1, ui pairs (non-text, WCAG 1.4.11) need 3:1, decorative pairs are excluded with a reason.
 * Colours are never silently fixed: brand values are an owner decision. Failing pairs must be recorded in
 * src/theme/known-gaps.ts. Exit 0 only if the failing set equals that registry exactly (unlisted failure,
 * changed ratio, or stale entry => exit 1).
 * Usage: node scripts/check-contrast.ts
 */
import { allColors as colors, contrastPairs } from '../src/theme/tokens.ts';
import { knownGaps } from '../src/theme/known-gaps.ts';
import { decorativePairs, evaluatePairs, reconcileGaps } from './lib/contrast.ts';

const results = evaluatePairs(colors, contrastPairs);
const { known, unlisted, changed, stale } = reconcileGaps(results, knownGaps);
const isKnown = new Set(known);
const line = (r: (typeof results)[number], status: string) =>
  `${status}  ${r.ratio.toFixed(2).padStart(5)}:1 (need ${r.threshold})  ${r.fg} on ${r.bg}  ${r.fgHex}/${r.bgHex}  [${r.kind}] ${r.note}`;

for (const theme of Object.keys(colors)) {
  console.log(`\n== ${theme} ==`);
  for (const r of results.filter((x) => x.theme === theme)) console.log(line(r, r.pass ? 'PASS' : isKnown.has(r) ? 'GAP ' : 'FAIL'));
}

const deco = decorativePairs(contrastPairs);
console.log(`\nExcluded as decorative (${deco.length}, not checked):`);
for (const p of deco) console.log(`  ${p.fg} on ${p.bg}: ${p.reason}`);

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks pass, ${known.length} KNOWN GAPS, ${unlisted.length + changed.length} unlisted/changed failures, ${stale.length} stale registry entries.`);

if (known.length) {
  console.log(`\nKNOWN GAPS (${known.length}, src/theme/known-gaps.ts, owner decision pending):`);
  for (const r of known) console.log(`  [${r.theme}] ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}:1 < ${r.threshold} [${r.kind}]`);
}

let bad = false;
if (unlisted.length) {
  bad = true;
  console.error(`\n${unlisted.length} UNLISTED failing pair(s) (fix the colour or record in src/theme/known-gaps.ts):`);
  for (const r of unlisted) console.error(`  [${r.theme}] ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}:1 < ${r.threshold}  (${r.note})`);
}
if (changed.length) {
  bad = true;
  console.error(`\n${changed.length} known gap(s) whose ratio/threshold changed (re-review and update the registry):`);
  for (const { result: r, entry: e } of changed)
    console.error(`  [${r.theme}] ${r.fg} on ${r.bg} now ${r.ratio.toFixed(2)}:1 (need ${r.threshold}), recorded ${e.ratio.toFixed(2)}:1 (need ${e.threshold})`);
}
if (stale.length) {
  bad = true;
  console.error(`\n${stale.length} STALE known-gap entr${stale.length === 1 ? 'y' : 'ies'} (pair now passes or no longer exists; remove):`);
  for (const e of stale) console.error(`  [${e.theme}] ${e.fg} on ${e.bg}`);
}
process.exit(bad ? 1 : 0);
