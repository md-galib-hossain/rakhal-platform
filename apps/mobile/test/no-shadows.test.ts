/**
 * ADR-007 (owner rule, 2026-11-16): the mobile app draws no drop shadows. Surfaces (page, cards, sheets, toasts) are told
 * apart by a 1px border and a fill that differs from the background, in both themes. This test fails the build when a
 * shadow or elevation style creeps back into `src` or `app`, and when the surface tokens stop being distinguishable.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { allColors } from '../src/theme/tokens.ts';

const root = join(import.meta.dirname, '..');

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

/** Drop comments so prose such as "no shadow" in a doc comment is not a violation; code and strings stay. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const FORBIDDEN: readonly { pattern: RegExp; what: string }[] = [
  { pattern: /\bshadow(Color|Offset|Opacity|Radius)\b/, what: 'shadowColor/shadowOffset/shadowOpacity/shadowRadius' },
  { pattern: /\bboxShadow\b/, what: 'boxShadow' },
  { pattern: /\btextShadow(Color|Offset|Radius)?\b/, what: 'textShadow*' },
  { pattern: /\belevation\b/, what: 'elevation (Android shadow)' },
];

function violationsIn(code: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(withoutComments(code))).map(({ what }) => what);
}

test('no source file under src/ or app/ uses a shadow or elevation style', () => {
  const violations: string[] = [];
  for (const dir of ['src', 'app']) {
    for (const file of sourceFiles(join(root, dir))) {
      for (const what of violationsIn(readFileSync(file, 'utf8'))) {
        violations.push(`${relative(root, file).split(sep).join('/')}: ${what}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `ADR-007: the app has no drop shadows. Separate surfaces with a 1px border and a different fill.\n${violations.join('\n')}`,
  );
});

test('the scan reads the real sources and catches each forbidden style', () => {
  const scanned = [...sourceFiles(join(root, 'src')), ...sourceFiles(join(root, 'app'))];
  assert.ok(scanned.length > 50, `scanned only ${scanned.length} files`);

  assert.deepEqual(violationsIn('const s = { shadowColor: "#000", shadowOpacity: 0.1 };'), [
    'shadowColor/shadowOffset/shadowOpacity/shadowRadius',
  ]);
  assert.deepEqual(violationsIn('const s = { boxShadow: "0 1px 2px #000" };'), ['boxShadow']);
  assert.deepEqual(violationsIn('const s = { textShadowRadius: 2 };'), ['textShadow*']);
  assert.deepEqual(violationsIn('const s = { elevation: 4 };'), ['elevation (Android shadow)']);
  assert.deepEqual(violationsIn('import { elevation } from "./tokens.ts";'), ['elevation (Android shadow)']);
});

test('prose about shadows in comments is not a violation', () => {
  assert.deepEqual(violationsIn('// no shadow, no elevation here\nconst a = 1;'), []);
  assert.deepEqual(violationsIn('/* shadowColor and elevation in a comment */ const a = 1;'), []);
  assert.deepEqual(violationsIn('/** Shadows the ARIA role prop. */ const a = 1;'), []);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`surfaces stay distinguishable without shadows (${scheme})`, () => {
    const c = allColors[scheme];
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    assert.ok(!same(c.card, c.background), 'card fill must differ from the page background');
    assert.ok(!same(c.popover, c.background), 'sheet and toast fill must differ from the page background');
    assert.ok(!same(c.border, c.card), 'card border must differ from the card fill');
    assert.ok(!same(c.border, c.background), 'card border must differ from the page background');
    assert.ok(!same(c.inputBorder, c.popover), 'sheet and toast outline must differ from their fill');
  });
}
