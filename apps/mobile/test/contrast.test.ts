import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THRESHOLD_TEXT,
  THRESHOLD_UI,
  contrastRatio,
  decorativePairs,
  evaluatePairs,
  hexToRgb,
  reconcileGaps,
  relativeLuminance,
  resolveOpaque,
  thresholdFor,
  type KnownGap,
} from '../scripts/lib/contrast.ts';
import { TINT_NAMES, allColors as colors, colors as webColors, contrastPairs, textOnTint } from '../src/theme/tokens.ts';
import { mobileOnlyColors } from '../src/theme/mobile-only.ts';
import { knownGaps } from '../src/theme/known-gaps.ts';

test('hexToRgb parses 6 and 3 digit hex, rejects alpha and non-hex', () => {
  assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('#000'), [0, 0, 0]);
  assert.deepEqual(hexToRgb('#00A86B'), [0, 168, 107]);
  assert.throws(() => hexToRgb('#00a86b66'));
  assert.throws(() => hexToRgb('red'));
});

test('relative luminance of black and white', () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.ok(Math.abs(relativeLuminance([255, 255, 255]) - 1) < 1e-9);
});

test('black on white is 21:1, symmetric, same colour is 1:1', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(contrastRatio('#ffffff', '#000000'), contrastRatio('#000000', '#ffffff'));
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 1e-9);
});

test('known WCAG reference value: #777 on white is about 4.48:1', () => {
  const r = contrastRatio('#777777', '#ffffff');
  assert.ok(r > 4.47 && r < 4.49, `got ${r}`);
});

test('thresholds: text 4.5, ui 3', () => {
  assert.equal(THRESHOLD_TEXT, 4.5);
  assert.equal(THRESHOLD_UI, 3);
  assert.equal(thresholdFor('text'), 4.5);
  assert.equal(thresholdFor('ui'), 3);
});

test('resolveOpaque composites alpha over the background and leaves opaque colours alone', () => {
  assert.equal(resolveOpaque('#00000080', '#ffffff'), '#7f7f7f');
  assert.equal(resolveOpaque('#ff000000', '#0000ff'), '#0000ff');
  assert.equal(resolveOpaque('#ff0000ff', '#0000ff'), '#ff0000');
  assert.equal(resolveOpaque('#123456', '#ffffff'), '#123456');
});

test('evaluatePairs applies the per-kind threshold and skips decorative pairs', () => {
  const themes = { t: { a: '#000000', b: '#ffffff', c: '#777777', d: '#999999' } };
  const res = evaluatePairs(themes, [
    { fg: 'a', bg: 'b', kind: 'text', note: 'good' },
    { fg: 'c', bg: 'b', kind: 'text', note: '4.48 fails text' },
    { fg: 'c', bg: 'b', kind: 'ui', note: '4.48 passes ui' },
    { fg: 'd', bg: 'b', kind: 'ui', note: '2.85 fails ui' },
    { fg: 'd', bg: 'b', kind: 'decorative', note: 'skipped', reason: 'test' },
  ]);
  assert.deepEqual(res.map((r) => r.pass), [true, false, true, false]);
  assert.deepEqual(res.map((r) => r.threshold), [4.5, 4.5, 3, 3]);
});

test('evaluatePairs composites an alpha foreground before measuring', () => {
  const themes = { t: { ring: '#00000066', bg: '#ffffff' } };
  const [r] = evaluatePairs(themes, [{ fg: 'ring', bg: 'bg', kind: 'ui', note: '' }]);
  // 40% black over white = #999999 = 2.85:1, not the 21:1 of the unblended base colour.
  assert.equal(r!.ratio.toFixed(2), '2.85');
});

test('evaluatePairs throws on unknown token', () => {
  assert.throws(() => evaluatePairs({ t: { a: '#000000' } }, [{ fg: 'a', bg: 'zz', kind: 'text', note: '' }]));
});

test('plan fact: white on brand green is 3.08:1, the dark label passes text', () => {
  assert.equal(contrastRatio('#ffffff', colors.light.primary).toFixed(2), '3.08');
  assert.ok(contrastRatio(colors.light.primaryForeground, colors.light.primary) >= THRESHOLD_TEXT);
});

// --- the pair list itself ------------------------------------------------------------------

test('pair list: unique, known kinds, decorative has a reason, no deprecated size field', () => {
  const seen = new Set<string>();
  for (const p of contrastPairs) {
    const key = `${p.fg}|${p.bg}`;
    assert.ok(!seen.has(key), `duplicate pair ${key}`);
    seen.add(key);
    assert.ok(['text', 'ui', 'decorative'].includes(p.kind), key);
    if (p.kind === 'decorative') assert.ok(p.reason && p.reason.length > 10, `decorative ${key} needs a reason`);
    else assert.equal(p.reason, undefined, `${key} has a reason but is checked`);
    assert.ok(!('size' in p), key);
  }
});

test('pair list covers the review gaps (text, ui, session, accent, state, chart, ring, sidebarMuted)', () => {
  const has = (fg: string, bg: string, kind: string) => contrastPairs.some((p) => p.fg === fg && p.bg === bg && p.kind === kind);
  assert.ok(has('inputBorder', 'card', 'ui'));
  assert.ok(has('inputBorder', 'background', 'ui'));
  assert.ok(has('focusRing', 'background', 'ui'));
  assert.ok(has('focusRing', 'card', 'ui'));
  assert.ok(has('border', 'card', 'decorative'));
  assert.ok(has('primary', 'card', 'ui'));
  assert.ok(has('destructive', 'background', 'ui'));
  assert.ok(has('sessionNight', 'card', 'decorative'));
  assert.ok(has('sessionMorning', 'card', 'ui'));
  assert.ok(has('accentTeal', 'accentTealTint', 'decorative'));
  assert.ok(has('stateSickBar', 'stateSickTint', 'ui'));
  assert.ok(has('chart1', 'card', 'ui'));
  assert.ok(has('mutedForeground', 'popover', 'text'));
  assert.ok(has('foreground', 'successTint', 'text'));
  assert.ok(has('primaryText', 'successTint', 'text'));
  assert.ok(has('sidebarMuted', 'sidebar', 'text'));
  assert.ok(decorativePairs(contrastPairs).length > 0);
});

test('every listed pair resolves in both themes (2 results per checked pair)', () => {
  const checked = contrastPairs.filter((p) => p.kind !== 'decorative').length;
  assert.equal(evaluatePairs(colors, contrastPairs).length, checked * 2);
});

// --- known-gap registry --------------------------------------------------------------------

const GAP_THEMES = { t: { a: '#999999', b: '#ffffff', c: '#000000' } };
const GAP_PAIRS = [
  { fg: 'a', bg: 'b', kind: 'ui' as const, note: 'gap' },
  { fg: 'c', bg: 'b', kind: 'text' as const, note: 'ok' },
];
const GAP: KnownGap = { theme: 't', fg: 'a', bg: 'b', ratio: 2.85, threshold: 3, note: 'x' };

test('a failing pair listed with its exact ratio is a known gap', () => {
  const r = reconcileGaps(evaluatePairs(GAP_THEMES, GAP_PAIRS), [GAP]);
  assert.equal(r.known.length, 1);
  assert.deepEqual([r.unlisted, r.changed, r.stale], [[], [], []]);
});

test('an unlisted failing pair is reported (would fail the check)', () => {
  const r = reconcileGaps(evaluatePairs(GAP_THEMES, GAP_PAIRS), []);
  assert.deepEqual(r.unlisted.map((x) => x.fg), ['a']);
});

test('a stale known gap (pair now passes) is reported (would fail the check)', () => {
  const passing = { t: { a: '#000000', b: '#ffffff', c: '#000000' } };
  const r = reconcileGaps(evaluatePairs(passing, GAP_PAIRS), [GAP]);
  assert.deepEqual(r.stale, [GAP]);
});

test('a known gap whose ratio moved is reported as changed, not silently accepted', () => {
  const r = reconcileGaps(evaluatePairs(GAP_THEMES, GAP_PAIRS), [{ ...GAP, ratio: 2.5 }]);
  assert.equal(r.changed.length, 1);
  assert.equal(r.known.length, 0);
});

test('real tokens: the failing set equals known-gaps.ts exactly, and every entry is a real failure', () => {
  const r = reconcileGaps(evaluatePairs(colors, contrastPairs), knownGaps);
  assert.deepEqual(r.unlisted.map((x) => `${x.theme} ${x.fg}/${x.bg}`), []);
  assert.deepEqual(r.changed.map((x) => `${x.result.theme} ${x.result.fg}/${x.result.bg}`), []);
  assert.deepEqual(r.stale.map((x) => `${x.theme} ${x.fg}/${x.bg}`), []);
  assert.equal(r.known.length, knownGaps.length);
  for (const g of knownGaps) assert.ok(g.ratio < g.threshold && g.note.length > 0, `${g.fg}/${g.bg}`);
});

// --- owner decisions A/B/C (2026-11-11) -----------------------------------------------------
// Expectations are hand-written, independent of the pair list.

const MOBILE_ONLY_HEX = {
  light: { inputBorder: '#828c9c', focusRing: '#009f65', primaryEdge: '#009f65', warningEdge: '#c17c08' },
  dark: { inputBorder: '#586b7b', focusRing: '#12774e', primaryEdge: '#1ec883', warningEdge: '#fbbf24' },
} as const;

test('mobile-only tokens: exact declared set, exact values, none in the web-shared set', () => {
  assert.deepEqual(mobileOnlyColors.light, MOBILE_ONLY_HEX.light);
  assert.deepEqual(mobileOnlyColors.dark, MOBILE_ONLY_HEX.dark);
  for (const theme of ['light', 'dark'] as const) {
    for (const k of Object.keys(MOBILE_ONLY_HEX[theme])) assert.ok(!(k in webColors[theme]), `${theme} ${k} must not be a web-shared token`);
  }
});

test('mobile-only tokens clear 3:1 on background and card in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, hex] of Object.entries(MOBILE_ONLY_HEX[theme])) {
      for (const surface of ['background', 'card'] as const) {
        const r = contrastRatio(hex, colors[theme][surface]);
        assert.ok(r >= THRESHOLD_UI, `${theme} ${name} on ${surface} = ${r.toFixed(2)}`);
      }
    }
  }
});

test('brand fills primary and warning keep their web values (only edges were added)', () => {
  assert.equal(colors.light.primary, '#00a86b');
  assert.equal(colors.light.warning, '#f59e0b');
});

test('replaced pairs: old input/ring/primary-bg/warning UI pairs are gone, border pairs are decorative with a reason', () => {
  const find = (fg: string, bg: string) => contrastPairs.find((p) => p.fg === fg && p.bg === bg);
  const gone = [['input', 'card'], ['input', 'background'], ['ring', 'background'], ['ring', 'card'], ['primary', 'background'], ['warning', 'card'], ['warning', 'background']];
  for (const [fg, bg] of gone) assert.equal(find(fg!, bg!), undefined, `${fg}/${bg} should no longer be listed`);
  for (const bg of ['background', 'card']) {
    const p = find('border', bg)!;
    assert.equal(p.kind, 'decorative');
    assert.ok(p.reason!.length > 10);
  }
  for (const fg of ['primaryEdge', 'warningEdge']) for (const bg of ['background', 'card']) assert.equal(find(fg, bg)!.kind, 'ui');
});

test('label-only accents are decorative with the exact label-only reason; nothing else uses that reason', () => {
  const REASON = 'label-only rule: never the sole carrier of meaning; always paired with a text label or icon';
  const expected = [
    'sessionNoon/background', 'sessionNoon/card', 'sessionNight/background', 'sessionNight/card',
    'accentTeal/card', 'accentTeal/accentTealTint', 'statePregnantBar/card', 'statePregnantBar/statePregnantTint',
    'chart4/card', 'chartProfit/card', 'chartFeedcost/card',
  ];
  const got = contrastPairs.filter((p) => p.reason === REASON);
  assert.deepEqual(got.map((p) => `${p.fg}/${p.bg}`).sort(), expected.sort());
  for (const p of got) assert.equal(p.kind, 'decorative');
});

test('every decorative pair has a reason', () => {
  for (const p of decorativePairs(contrastPairs)) assert.ok(p.reason && p.reason.length > 10, `${p.fg}/${p.bg}`);
});

test('textOnTint never returns mutedForeground, and every tint has a passing text pair in both themes', () => {
  assert.equal(TINT_NAMES.length, 14);
  const results = evaluatePairs(colors, contrastPairs);
  for (const t of TINT_NAMES) {
    const fg = textOnTint(t);
    assert.notEqual(fg, 'mutedForeground', t);
    assert.equal(fg, 'foreground', t);
    assert.ok(contrastPairs.some((p) => p.fg === fg && p.bg === t && p.kind === 'text'), `no text pair for ${t}`);
    for (const theme of ['light', 'dark']) {
      const r = results.find((x) => x.theme === theme && x.fg === fg && x.bg === t)!;
      assert.ok(r.pass && r.ratio >= THRESHOLD_TEXT, `${theme} ${t} = ${r.ratio.toFixed(2)}`);
    }
    assert.equal(contrastPairs.find((p) => p.fg === 'mutedForeground' && p.bg === t), undefined, `${t} must have no muted pair`);
  }
});

test('TINT_NAMES is exactly the set of keys ending in Tint in both themes', () => {
  const expected = [...TINT_NAMES].sort();
  for (const theme of ['light', 'dark'] as const) {
    const keys = Object.keys(colors[theme]).filter((k) => k.endsWith('Tint')).sort();
    assert.deepEqual(keys, expected, theme);
  }
});

test('known gaps registry is empty (goal reached): no failing pairs remain (33 former gaps: ~11 reclassified label-only, border/input/ring/edges via mobile-only tokens, 7 via textOnTint)', () => {
  assert.equal(knownGaps.length, 0);
  assert.equal(evaluatePairs(colors, contrastPairs).filter((r) => !r.pass).length, 0);
});
