import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkMobileOnly, diffTokens, normalizeHex, parseWebTokens, reconcileDrifts, resolveDark, toCssVar, webOnlyVars } from '../scripts/lib/drift.ts';
import { THRESHOLD_TEXT, contrastRatio } from '../scripts/lib/contrast.ts';
import { SNAPSHOT_CSS, liveGlobalsPath, mobileRoot, relativeSource, parseSnapshotMd, readSnapshotMeta, renderSnapshotMd, sha256Text } from '../scripts/lib/snapshot.ts';
import { divergences } from '../src/theme/divergences.ts';
import { colors } from '../src/theme/tokens.ts';
import { mobileOnlyColors } from '../src/theme/mobile-only.ts';

const CSS = `
/* header comment with --fake: #123456; */
:root {
  --background: #F2F3F5;
  --primary: #00a86b;
  --ring: #00a86b66;
  --radius-sm: 0.5rem;
  --chart-1: #16a34a;
  --only-web: #abcdef;
}
.dark {
  --background: #10151a;
}
@theme inline {
  --color-background: var(--background);
}
:root {
  --state-fresh-bar: #059669;
}
.dark {
  --state-fresh-bar: #34d399;
}
`;

test('toCssVar maps camelCase and digits', () => {
  assert.equal(toCssVar('primaryForeground'), '--primary-foreground');
  assert.equal(toCssVar('chart1'), '--chart-1');
  assert.equal(toCssVar('stateFreshBar'), '--state-fresh-bar');
  assert.equal(toCssVar('accentPurpleTint'), '--accent-purple-tint');
});

test('parseWebTokens reads multiple blocks, ignores comments, non-hex and @theme', () => {
  const web = parseWebTokens(CSS);
  assert.equal(web.light['--background'], '#f2f3f5');
  assert.equal(web.light['--ring'], '#00a86b66');
  assert.equal(web.light['--state-fresh-bar'], '#059669');
  assert.equal(web.light['--radius-sm'], undefined);
  assert.equal(web.light['--fake'], undefined);
  assert.equal(web.light['--color-background'], undefined);
  assert.equal(web.dark['--background'], '#10151a');
  assert.equal(web.dark['--state-fresh-bar'], '#34d399');
});

test('parser: last declaration without a trailing semicolon is read', () => {
  const web = parseWebTokens(':root { --a: #111111; --b: #222222 }\n.dark { --a: #333333 }');
  assert.equal(web.light['--a'], '#111111');
  assert.equal(web.light['--b'], '#222222');
  assert.equal(web.dark['--a'], '#333333');
});

test('parser: #rgb and #rgba shorthand is expanded and lowercased', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('#abcd'), '#aabbccdd');
  assert.equal(normalizeHex('#AABBCC'), '#aabbcc');
  const web = parseWebTokens(':root { --a: #FA0; }');
  assert.equal(web.light['--a'], '#ffaa00');
  assert.deepEqual(diffTokens({ light: { a: '#ffaa00' }, dark: {} }, web).filter((d) => d.theme === 'light'), []);
});

test('parser: non-hex values are reported as unsupported, not missing', () => {
  const web = parseWebTokens(':root { --a: oklch(0.7 0.1 150); --b: hsl(10 20% 30%); --c: rgb(1 2 3); --d: var(--a); --e: #123456 }');
  assert.equal(web.light['--a'], undefined);
  assert.equal(web.unsupported.light['--a'], 'oklch(0.7 0.1 150)');
  const drifts = diffTokens({ light: { a: '#000000', b: '#000000', c: '#000000', d: '#000000', e: '#123456', f: '#000000' }, dark: {} }, web);
  assert.deepEqual(drifts.map((d) => [d.token, d.unsupported ?? null]), [
    ['a', 'oklch(0.7 0.1 150)'],
    ['b', 'hsl(10 20% 30%)'],
    ['c', 'rgb(1 2 3)'],
    ['d', 'var(--a)'],
    ['f', null],
  ]);
  assert.equal(drifts[4]!.web, null);
});

test('parser: a non-hex .dark override is unsupported in dark, hex light value is not inherited over it', () => {
  const web = parseWebTokens(':root { --a: #111111 } .dark { --a: oklch(0.2 0 0) }');
  const d = diffTokens({ light: {}, dark: { a: '#111111' } }, web);
  assert.equal(d.length, 1);
  assert.equal(d[0]!.unsupported, 'oklch(0.2 0 0)');
  assert.equal(resolveDark(web)['--a'], undefined);
});

test('resolveDark overlays .dark on :root', () => {
  const dark = resolveDark(parseWebTokens(CSS));
  assert.equal(dark['--primary'], '#00a86b');
  assert.equal(dark['--background'], '#10151a');
});

test('diffTokens: no drift when equal (case-insensitive), inherited dark values count', () => {
  const web = parseWebTokens(CSS);
  const mobile = {
    light: { background: '#F2F3F5', primary: '#00a86b' },
    dark: { background: '#10151a', primary: '#00a86b' },
  };
  assert.deepEqual(diffTokens(mobile, web), []);
});

test('diffTokens reports mismatches and missing vars', () => {
  const web = parseWebTokens(CSS);
  const mobile = {
    light: { background: '#000001', chart1: '#16a34a', nothing: '#ffffff' },
    dark: { background: '#10151a' },
  };
  const d = diffTokens(mobile, web);
  assert.equal(d.length, 2);
  assert.deepEqual(d[0], { theme: 'light', token: 'background', cssVar: '--background', mobile: '#000001', web: '#f2f3f5' });
  assert.equal(d[1]!.token, 'nothing');
  assert.equal(d[1]!.web, null);
});

test('webOnlyVars lists web vars mobile does not carry', () => {
  const web = parseWebTokens(CSS);
  assert.deepEqual(webOnlyVars({ background: '#fff' }, web).includes('--only-web'), true);
  assert.equal(webOnlyVars({ background: '#fff' }, web).includes('--background'), false);
});

// --- divergence registry (synthetic) -------------------------------------------------------

const W = parseWebTokens(':root { --success: #16a34a; --primary: #00a86b; }');
const REG = [{ theme: 'light' as const, token: 'success', webHex: '#16a34a', mobileHex: '#12883e' }];

test('listed divergence with exact web+mobile values is accepted', () => {
  const drifts = diffTokens({ light: { success: '#12883e', primary: '#00a86b' }, dark: {} }, W);
  const r = reconcileDrifts(drifts, REG);
  assert.equal(r.accepted.length, 1);
  assert.deepEqual(r.unexplained, []);
  assert.deepEqual(r.stale, []);
});

test('unlisted drift is rejected', () => {
  const drifts = diffTokens({ light: { success: '#12883e', primary: '#00a000' }, dark: {} }, W);
  const r = reconcileDrifts(drifts, REG);
  assert.deepEqual(r.unexplained.map((d) => d.token), ['primary']);
});

test('listed divergence with a wrong mobile value is rejected (and entry reported stale)', () => {
  const drifts = diffTokens({ light: { success: '#12883f', primary: '#00a86b' }, dark: {} }, W);
  const r = reconcileDrifts(drifts, REG);
  assert.deepEqual(r.unexplained.map((d) => d.token), ['success']);
  assert.equal(r.stale.length, 1);
});

test('listed divergence is rejected when the web value changes underneath it', () => {
  const web = parseWebTokens(':root { --success: #15a34a; }');
  const drifts = diffTokens({ light: { success: '#12883e' }, dark: {} }, web);
  assert.equal(reconcileDrifts(drifts, REG).unexplained.length, 1);
});

test('stale entry (mobile now equals web, no drift) is reported', () => {
  const drifts = diffTokens({ light: { success: '#16a34a' }, dark: {} }, W);
  const r = reconcileDrifts(drifts, REG);
  assert.deepEqual(r.unexplained, []);
  assert.equal(r.stale.length, 1);
});

test('a light-theme entry does not excuse the same token in dark', () => {
  const web = parseWebTokens(':root { --success: #16a34a; } .dark { --success: #22c55e; }');
  const drifts = diffTokens({ light: { success: '#12883e' }, dark: { success: '#12883e' } }, web);
  const r = reconcileDrifts(drifts, REG);
  assert.deepEqual(r.unexplained.map((d) => d.theme), ['dark']);
});

// --- vendored snapshot ---------------------------------------------------------------------

const snapshotCss = readFileSync(SNAPSHOT_CSS, 'utf8');
const snapshot = parseWebTokens(snapshotCss);

test('snapshot: sha256 recorded in SNAPSHOT.md matches vendor/web-globals.css', () => {
  const meta = readSnapshotMeta();
  assert.equal(sha256Text(snapshotCss), meta.sha256);
  assert.match(meta.commit, /^[0-9a-f]{40}$/);
  assert.ok(meta.source.length > 0);
});

test('snapshot metadata round-trips through render/parse', () => {
  const m = { source: 'a/b.css', commit: 'c'.repeat(40), dirty: 'no', sha256: 'd'.repeat(64), capturedAt: '2026-01-02' };
  assert.deepEqual(parseSnapshotMd(renderSnapshotMd(m)), m);
});

test('sha256Text ignores CRLF vs LF', () => {
  assert.equal(sha256Text('a\r\nb\n'), sha256Text('a\nb\n'));
});

test('snapshot source is recorded relative, not as an absolute machine path', () => {
  const src = readSnapshotMeta().source;
  assert.ok(!/^[A-Za-z]:|^\//.test(src), src);
  assert.ok(src.includes('rakhal-consumer-frontend/app/globals.css'));
  assert.equal(relativeSource(resolve(mobileRoot, '..', '..', '..', 'x', 'g.css')), '../../../x/g.css');
});

test('--live hard-fails (exit 1) on a stale snapshot and passes on the current one', () => {
  const run = (file: string) =>
    spawnSync(process.execPath, ['scripts/check-token-drift.ts', '--live'], {
      cwd: mobileRoot,
      encoding: 'utf8',
      env: { ...process.env, RAKHAL_WEB_GLOBALS_CSS: file },
    });
  const dir = mkdtempSync(join(tmpdir(), 'rk-stale-'));
  try {
    const stale = join(dir, 'globals.css');
    writeFileSync(stale, snapshotCss + '\n/* changed upstream */\n');
    const r = run(stale);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /STALE SNAPSHOT/);
    assert.match(r.stderr, /refresh-web-snapshot/);
    const current = join(dir, 'same.css');
    writeFileSync(current, snapshotCss);
    assert.equal(run(current).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('default live path is relative to the repo, not an absolute Windows path', () => {
  assert.equal(liveGlobalsPath({ RAKHAL_WEB_GLOBALS_CSS: 'x/y.css' }), 'x/y.css');
  assert.ok(liveGlobalsPath({}).endsWith('globals.css'));
});

test('parseWebTokens on the vendored snapshot yields the expected counts', () => {
  assert.equal(Object.keys(snapshot.light).length, 78);
  assert.equal(Object.keys(snapshot.dark).length, 74);
  // The web theme declares colours as hex only; nothing mobile carries may be hidden as unsupported.
  for (const theme of ['light', 'dark'] as const) {
    for (const token of Object.keys(colors[theme])) {
      assert.equal(snapshot.unsupported[theme][toCssVar(token)], undefined, `${theme} ${token} is a non-hex web value`);
    }
  }
});

test('real tokens: both themes carry the same 77 colour keys, all hex, and every one exists in the snapshot', () => {
  assert.equal(Object.keys(colors.light).length, 77);
  assert.deepEqual(Object.keys(colors.light).sort(), Object.keys(colors.dark).sort());
  for (const [theme, set] of Object.entries(colors)) {
    for (const [k, v] of Object.entries(set)) assert.match(v, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${theme} ${k}`);
  }
  assert.deepEqual(diffTokens(colors, snapshot).filter((d) => d.web === null), []);
});

test('light drift against the snapshot is exactly the recorded divergences', () => {
  const r = reconcileDrifts(diffTokens(colors, snapshot), divergences);
  assert.deepEqual(r.unexplained, []);
  assert.deepEqual(r.stale, []);
  assert.deepEqual(r.accepted.map((d) => d.token).sort(), divergences.map((e) => e.token).sort());
});

test('dark theme has zero drift against the snapshot (resolved with .dark overrides)', () => {
  const dark = diffTokens(colors, snapshot).filter((d) => d.theme === 'dark');
  assert.deepEqual(dark, []);
});

test('a one-digit dark change against the snapshot is detected', () => {
  const tweaked = { light: colors.light, dark: { ...colors.dark, primary: '#1ec884' } };
  const dark = diffTokens(tweaked, snapshot).filter((d) => d.theme === 'dark');
  assert.deepEqual(dark.map((d) => d.token), ['primary']);
});

// --- real registry, independent expectations -----------------------------------------------
// Literals here are written by hand on purpose: the test must not read the registry to decide what it expects.

const EXPECTED = [
  { token: 'primaryHover', web: '#00774c', mobile: '#009760', fg: '#171d22', bgBefore: '#00774c', bgAfter: '#009760', fgToken: 'primaryForeground', bgToken: 'primaryHover', before: 3.03, after: 4.53 },
  { token: 'success', web: '#16a34a', mobile: '#12883e', fg: '#ffffff', bgBefore: '#16a34a', bgAfter: '#12883e', fgToken: 'successForeground', bgToken: 'success', before: 3.3, after: 4.55 },
  { token: 'warningForeground', web: '#ffffff', mobile: '#171d22', fg: null, bgBefore: '#f59e0b', bgAfter: '#f59e0b', fgToken: 'warningForeground', bgToken: 'warning', before: 2.15, after: 7.92 },
  { token: 'destructive', web: '#ef4444', mobile: '#eb1616', fg: '#ffffff', bgBefore: '#ef4444', bgAfter: '#eb1616', fgToken: 'destructiveForeground', bgToken: 'destructive', before: 3.76, after: 4.51 },
  { token: 'info', web: '#3b82f6', mobile: '#1e6ff5', fg: '#ffffff', bgBefore: '#3b82f6', bgAfter: '#1e6ff5', fgToken: 'infoForeground', bgToken: 'info', before: 3.68, after: 4.52 },
] as const;

test('real registry: exactly the five expected divergences, no more, no fewer', () => {
  assert.deepEqual(divergences.map((d) => d.token).sort(), EXPECTED.map((e) => e.token).sort());
});

for (const e of EXPECTED) {
  test(`real registry: ${e.token} before/after ratios are true, before fails and after passes`, () => {
    const entry = divergences.find((d) => d.token === e.token)!;
    assert.equal(entry.theme, 'light');
    assert.equal(entry.webHex, e.web);
    assert.equal(entry.mobileHex, e.mobile);
    assert.equal(entry.pair.fg, e.fgToken);
    assert.equal(entry.pair.bg, e.bgToken);
    assert.equal((colors.light as Record<string, string>)[e.token], e.mobile, 'tokens.ts value');

    // The foreground before the fix: for warningForeground the web (white) value; otherwise the label that never changed.
    const fgBefore = e.fg ?? e.web;
    const fgAfter = e.fg ?? e.mobile;
    const before = contrastRatio(fgBefore, e.bgBefore);
    const after = contrastRatio(fgAfter, e.bgAfter);
    assert.equal(before.toFixed(2), e.before.toFixed(2), 'independent before');
    assert.equal(after.toFixed(2), e.after.toFixed(2), 'independent after');
    assert.equal(entry.ratioBefore, e.before);
    assert.equal(entry.ratioAfter, e.after);
    assert.ok(entry.ratioBefore < THRESHOLD_TEXT, `${e.token} ratioBefore must fail`);
    assert.ok(entry.ratioAfter >= THRESHOLD_TEXT, `${e.token} ratioAfter must pass`);
    // The live token values really produce the recorded "after" ratio.
    assert.equal(contrastRatio(colors.light[entry.pair.fg], colors.light[entry.pair.bg]).toFixed(2), e.after.toFixed(2));
  });
}

// --- mobile-only tokens --------------------------------------------------------------------

const MO = { light: { focusRing: '#009f65' }, dark: { focusRing: '#12774e' } };
const SHARED = { light: { primary: '#00a86b' }, dark: { primary: '#1ec883' } };

test('mobile-only: tokens absent from the web file are fine', () => {
  const r = checkMobileOnly(MO, SHARED, parseWebTokens(':root { --primary: #00a86b; }'));
  assert.deepEqual(r, { issues: [], nowInWeb: [] });
});

test('mobile-only: web later declares the same name with a DIFFERENT value => conflict (per theme)', () => {
  const web = parseWebTokens(':root { --focus-ring: #009f65; } .dark { --focus-ring: #ffffff; }');
  const r = checkMobileOnly(MO, SHARED, web);
  assert.deepEqual(r.issues.map((i) => [i.theme, i.token, i.kind, i.web]), [['dark', 'focusRing', 'conflict', '#ffffff']]);
  assert.deepEqual(r.nowInWeb.map((n) => n.theme), ['light']);
});

test('mobile-only: web declares it as a non-hex value => conflict', () => {
  const r = checkMobileOnly(MO, SHARED, parseWebTokens(':root { --focus-ring: oklch(0.6 0.1 150); }'));
  assert.ok(r.issues.some((i) => i.kind === 'conflict' && i.theme === 'light'));
});

test('mobile-only: same value in web is only a note, not a failure', () => {
  const r = checkMobileOnly(MO, SHARED, parseWebTokens(':root { --focus-ring: #009F65; } .dark { --focus-ring: #12774e; }'));
  assert.deepEqual(r.issues, []);
  assert.equal(r.nowInWeb.length, 2);
});

test('mobile-only: a name also in the web-shared set is an overlap failure', () => {
  const r = checkMobileOnly({ light: { primary: '#000000' }, dark: {} }, SHARED, parseWebTokens(':root { }'));
  assert.deepEqual(r.issues.map((i) => i.kind), ['overlap']);
});

test('an undeclared extra token is plain drift (missing in web), not silently accepted', () => {
  const web = parseWebTokens(':root { --primary: #00a86b; }');
  const d = diffTokens({ light: { primary: '#00a86b', sneakyExtra: '#123456' }, dark: {} }, web);
  assert.deepEqual(d.map((x) => [x.token, x.web]), [['sneakyExtra', null]]);
  assert.deepEqual(reconcileDrifts(d, []).unexplained.map((x) => x.token), ['sneakyExtra']);
});

test('real mobile-only tokens: exactly four names, none in the vendored web snapshot, no conflicts', () => {
  assert.deepEqual(Object.keys(mobileOnlyColors.light).sort(), ['focusRing', 'inputBorder', 'primaryEdge', 'warningEdge']);
  assert.deepEqual(Object.keys(mobileOnlyColors.light).sort(), Object.keys(mobileOnlyColors.dark).sort());
  for (const k of Object.keys(mobileOnlyColors.light)) {
    assert.equal(snapshot.light[toCssVar(k)], undefined, k);
    assert.equal(snapshot.dark[toCssVar(k)], undefined, k);
    assert.equal(snapshot.unsupported.light[toCssVar(k)], undefined, k);
  }
  assert.deepEqual(checkMobileOnly(mobileOnlyColors, colors, snapshot), { issues: [], nowInWeb: [] });
  for (const set of [mobileOnlyColors.light, mobileOnlyColors.dark]) for (const v of Object.values(set)) assert.match(v, /^#[0-9a-f]{6}$/);
});
