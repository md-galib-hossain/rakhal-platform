import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blend, contrastRatio, hexToRgb, resolveOpaque } from '../scripts/lib/contrast.ts';
import { allColors } from '../src/theme/tokens.ts';

test('blend: alpha 0 is the background, alpha 1 is the foreground', () => {
  const { foreground, card } = allColors.light;
  assert.deepEqual(hexToRgb(blend(foreground, card, 1)), hexToRgb(foreground));
  assert.deepEqual(hexToRgb(blend(foreground, card, 0)), hexToRgb(card));
});

test('blend: matches resolveOpaque for the same alpha (sRGB-space compositing)', () => {
  const { foreground, card } = allColors.dark;
  const a = 0.12;
  const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
  // resolveOpaque quantises alpha to 1/255; blend takes a real fraction, so allow a 1-unit channel difference.
  const viaHex = hexToRgb(resolveOpaque(foreground + alphaHex, card));
  const viaBlend = hexToRgb(blend(foreground, card, a));
  viaHex.forEach((v, i) => assert.ok(Math.abs(v - viaBlend[i]!) <= 1, `channel ${i}`));
});

test('blend: black over white at 50% is mid grey', () => {
  const mid = blend('#000000', '#ffffff', 0.5);
  assert.deepEqual(hexToRgb(mid), [128, 128, 128]);
});

test('blend: rejects alpha outside 0..1 and non-finite', () => {
  assert.throws(() => blend('#000000', '#ffffff', -0.1));
  assert.throws(() => blend('#000000', '#ffffff', 1.1));
  assert.throws(() => blend('#000000', '#ffffff', Number.NaN));
});

test('blend: a 12% dark overlay on a light surface keeps dark text readable', () => {
  const { foreground, card } = allColors.light;
  assert.ok(contrastRatio(foreground, blend(foreground, card, 0.12)) > 4.5);
});
