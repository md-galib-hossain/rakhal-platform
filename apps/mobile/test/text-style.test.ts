import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenText, resolveTextColorName, resolveTextStyle } from '../src/components/primitives/text-style.ts';
import { maxFontSizeMultiplier } from '../src/theme/font-scale.ts';
import { textStyle, typeScale, type TextRole } from '../src/theme/tokens.ts';

const roles = Object.keys(typeScale) as TextRole[];

test('flattenText joins strings and numbers, ignores everything else', () => {
  assert.equal(flattenText('a'), 'a');
  assert.equal(flattenText(5), '5');
  assert.equal(flattenText(['a', 1, null, false, undefined, { x: 1 }, ['b']]), 'a1b');
  assert.equal(flattenText(null), '');
});

test('system mode matches textStyle for every role and script and returns the cap', () => {
  for (const role of roles) {
    for (const [text, script, localeScript] of [
      ['Milk', 'latin', 'latin'],
      ['দুধ', 'bengali', 'latin'],
    ] as const) {
      const r = resolveTextStyle({ role, text, localeScript, systemScale: 3 });
      assert.equal(r.script, script);
      assert.deepEqual(r.style, textStyle(role, script));
      assert.equal(r.manual, false);
      assert.equal(r.maxFontSizeMultiplier, maxFontSizeMultiplier[role]);
    }
  }
});

test('whole-string family: taka amount, digits-only and mixed', () => {
  const fam = (text: string, localeScript: 'latin' | 'bengali') =>
    resolveTextStyle({ role: 'body', text, localeScript, systemScale: 1 }).style.fontFamily;
  assert.equal(fam('৳12,50,000', 'latin'), 'NotoSansBengali_400Regular');
  assert.equal(fam('Milk ৳450', 'latin'), 'NotoSansBengali_400Regular');
  assert.equal(fam('1250', 'latin'), 'Inter_400Regular');
  assert.equal(fam('1250', 'bengali'), 'NotoSansBengali_400Regular');
  assert.equal(fam('Milk', 'bengali'), 'NotoSansBengali_400Regular');
  assert.equal(fam('', 'latin'), 'Inter_400Regular');
});

test('explicit script wins over the text; weight override picks another family name', () => {
  const r = resolveTextStyle({ role: 'body', text: 'দুধ', localeScript: 'bengali', script: 'latin', weight: 'semibold', systemScale: 1 });
  assert.equal(r.script, 'latin');
  assert.equal(r.style.fontFamily, 'Inter_600SemiBold');
});

test('role default weight comes from the type scale', () => {
  assert.equal(resolveTextStyle({ role: 'title', text: 'x', localeScript: 'latin', systemScale: 1 }).style.fontFamily, 'Inter_600SemiBold');
  assert.equal(resolveTextStyle({ role: 'label', text: 'x', localeScript: 'latin', systemScale: 1 }).style.fontFamily, 'Inter_500Medium');
});

test('manual mode scales size and line height, clamped to the cap', () => {
  const body = textStyle('body', 'bengali');
  const at = (role: TextRole, override: number, systemScale = 1) =>
    resolveTextStyle({ role, text: 'দুধ', localeScript: 'bengali', systemScale, override });
  const a = at('body', 1.3);
  assert.equal(a.manual, true);
  assert.equal(a.style.fontSize, Math.round(body.fontSize * 1.3 * 100) / 100);
  assert.equal(at('body', 3).appliedScale, 2);
  assert.equal(at('body', 3).style.fontSize, body.fontSize * 2);
  assert.equal(at('body', 3).style.lineHeight, body.lineHeight * 2);
  assert.equal(at('h1', 2).appliedScale, 1.5);
  assert.equal(at('h2', 2).appliedScale, 1.75);
  // invalid override falls back to the (clamped) system scale
  assert.equal(at('body', Number.NaN, 1.5).appliedScale, 1.5);
});

test('resolved style never has fontWeight or height', () => {
  for (const role of roles) {
    const s = resolveTextStyle({ role, text: 'দুধ', localeScript: 'bengali', systemScale: 2, override: 2 }).style;
    assert.deepEqual(Object.keys(s).sort(), ['fontFamily', 'fontSize', 'lineHeight']);
  }
});

test('colour: tint-safe rule', () => {
  assert.equal(resolveTextColorName(undefined), 'foreground');
  assert.equal(resolveTextColorName('mutedForeground'), 'mutedForeground');
  assert.equal(resolveTextColorName('mutedForeground', 'infoTint'), 'foreground');
  assert.equal(resolveTextColorName(undefined, 'infoTint'), 'foreground');
  assert.equal(resolveTextColorName('destructiveText', 'destructiveTint'), 'destructiveText');
});
