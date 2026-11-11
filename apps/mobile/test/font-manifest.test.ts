import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOADED_WEIGHTS, requiredFontFamilies } from '../src/theme/font-manifest.ts';
import { fontFamilyForText, resolveScript } from '../src/theme/font-family.ts';
import { fontFamily, textStyle, typeScale, type TextRole } from '../src/theme/tokens.ts';

const roles = Object.keys(typeScale) as TextRole[];

test('manifest loads exactly regular/medium/semibold of both families (O8: no bold)', () => {
  assert.deepEqual([...LOADED_WEIGHTS], ['regular', 'medium', 'semibold']);
  assert.equal(requiredFontFamilies.length, 6);
  assert.equal(new Set(requiredFontFamilies).size, 6);
  assert.ok(!requiredFontFamilies.some((f) => f.includes('_700')));
});

test('manifest equals the set of families textStyle can return for every role and script', () => {
  const used = new Set<string>();
  for (const role of roles) for (const s of ['latin', 'bengali'] as const) used.add(textStyle(role, s).fontFamily);
  assert.deepEqual([...used].sort(), [...requiredFontFamilies].sort());
});

test('resolveScript: Latin text keeps the locale script', () => {
  assert.equal(resolveScript('Milk 450', 'latin'), 'latin');
  assert.equal(resolveScript('Milk 450', 'bengali'), 'bengali');
});

test('resolveScript: any Bengali codepoint flips the whole string', () => {
  assert.equal(resolveScript('দুগ্ধ', 'latin'), 'bengali');
  assert.equal(resolveScript('Total ৳450', 'latin'), 'bengali');
  assert.equal(resolveScript('Milk ১২', 'latin'), 'bengali');
  assert.equal(resolveScript('Milk and দুধ mixed', 'latin'), 'bengali');
});

test('resolveScript: digits only and empty strings use the locale script', () => {
  assert.equal(resolveScript('1250000', 'latin'), 'latin');
  assert.equal(resolveScript('12,50,000.50', 'latin'), 'latin');
  assert.equal(resolveScript('', 'latin'), 'latin');
  assert.equal(resolveScript('', 'bengali'), 'bengali');
});

test('resolveScript: an explicit script ignores the text', () => {
  assert.equal(resolveScript('৳450', 'latin', 'latin'), 'latin');
  assert.equal(resolveScript('Milk', 'latin', 'bengali'), 'bengali');
  assert.equal(resolveScript('Milk', 'bengali', 'auto'), 'bengali');
});

test('fontFamilyForText picks the per-weight family name', () => {
  assert.equal(fontFamilyForText('Milk', 'latin'), fontFamily.latin.regular);
  assert.equal(fontFamilyForText('Milk', 'latin', 'medium'), 'Inter_500Medium');
  assert.equal(fontFamilyForText('৳450', 'latin', 'semibold'), 'NotoSansBengali_600SemiBold');
  assert.equal(fontFamilyForText('', 'bengali'), 'NotoSansBengali_400Regular');
  assert.equal(fontFamilyForText('৳450', 'bengali', 'regular', 'latin'), 'Inter_400Regular');
});
