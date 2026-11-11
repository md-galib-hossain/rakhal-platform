/**
 * Boundary guard (ADR-005 decision 4): apps/mobile must not import @rakhal/ui or reach into packages/ui by
 * relative path, and colour literals (hex, rgb/hsl/oklch functions) live only in src/theme/tokens.ts and
 * divergences.ts. Test files are exempt from the colour rules because fixtures need literal values; the
 * vendored web snapshot (vendor/) is data, not code. Checks .ts/.tsx/.js/.json/.css/.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', 'build', '.turbo']);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE.test(name)) out.push(full);
  }
  return out;
}

const files = walk(root);
const rel = (f: string) => relative(root, f).split(sep).join('/');
const isTest = (f: string) => rel(f).startsWith('test/');
const isVendor = (f: string) => rel(f).startsWith('vendor/');
const read = (f: string) => readFileSync(f, 'utf8');

export const HEX = /#[0-9a-fA-F]{3,8}\b/g;
export const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/gi;
export const UI_RELATIVE_IMPORT = /['"`](?:\.{1,2}\/)+[^'"`]*packages\/ui(?:\/|['"`])/;

test('guard sees source, script and css/md files', () => {
  assert.ok(files.some((f) => rel(f) === 'src/theme/tokens.ts'));
  assert.ok(files.some((f) => rel(f) === 'scripts/check-contrast.ts'));
  assert.ok(files.some((f) => rel(f) === 'vendor/web-globals.css'));
  assert.ok(files.some((f) => rel(f) === 'vendor/SNAPSHOT.md'));
});

test('detectors catch what they claim to', () => {
  assert.ok('x = #00a86b;'.match(HEX));
  assert.ok('x = #abc;'.match(HEX));
  assert.ok('rgb(0 0 0)'.match(COLOR_FN));
  assert.ok('rgba(0,0,0,.1)'.match(COLOR_FN));
  assert.ok('background: hsl(10 20% 30%)'.match(COLOR_FN));
  assert.ok('oklch(0.7 0.1 150)'.match(COLOR_FN));
  assert.ok(!'var(--x)'.match(COLOR_FN));
  assert.ok(UI_RELATIVE_IMPORT.test("import x from '../../../packages/ui/src/foo.ts'"));
  assert.ok(UI_RELATIVE_IMPORT.test("import '../../packages/ui'"));
  assert.ok(!UI_RELATIVE_IMPORT.test("import x from '../../packages/admin-api-client/src/x.ts'"));
});

test('nothing under apps/mobile imports or depends on @rakhal/ui', () => {
  const offenders = files.filter((f) => !isTest(f) && /@rakhal\/ui\b/.test(read(f)));
  assert.deepEqual(offenders.map(rel), []);
});

test('no relative import into packages/ui', () => {
  const offenders = files.filter((f) => !isTest(f) && !isVendor(f) && UI_RELATIVE_IMPORT.test(read(f)));
  assert.deepEqual(offenders.map(rel), []);
});

// app.json: native splash config cannot read JS, so it carries two hex values; test/app-config.test.ts pins them to the tokens.
const COLOR_ALLOWED = new Set(['src/theme/tokens.ts', 'src/theme/divergences.ts', 'src/theme/mobile-only.ts', 'app.json']);

test('no hex colour literal outside tokens.ts and divergences.ts (src, scripts, docs; tests and vendor exempt)', () => {
  const offenders: string[] = [];
  for (const f of files) {
    if (isTest(f) || isVendor(f) || COLOR_ALLOWED.has(rel(f)) || rel(f).endsWith('package.json')) continue;
    const hits = read(f).match(HEX);
    if (hits) offenders.push(`${rel(f)}: ${hits.join(', ')}`);
  }
  assert.deepEqual(offenders, []);
});

test('no rgb()/hsl()/oklch() colour function literal in src or scripts (including tokens.ts)', () => {
  const offenders: string[] = [];
  for (const f of files) {
    if (isTest(f) || isVendor(f) || rel(f).endsWith('package.json')) continue;
    const hits = read(f).match(COLOR_FN);
    if (hits) offenders.push(`${rel(f)}: ${hits.join(', ')}`);
  }
  assert.deepEqual(offenders, []);
});
