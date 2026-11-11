import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveScale, maxFontSizeMultiplier } from '../src/theme/font-scale.ts';
import { typeScale, type TextRole } from '../src/theme/tokens.ts';

const roles = Object.keys(typeScale) as TextRole[];

test('cap table covers exactly every TextRole', () => {
  assert.deepEqual(Object.keys(maxFontSizeMultiplier).sort(), [...roles].sort());
});

test('cap values follow O9: 2.0 body-class, 1.75 h2, 1.5 h1/stat', () => {
  for (const r of ['caption', 'label', 'body', 'button', 'title'] as const) assert.equal(maxFontSizeMultiplier[r], 2.0);
  assert.equal(maxFontSizeMultiplier.h2, 1.75);
  assert.equal(maxFontSizeMultiplier.h1, 1.5);
  assert.equal(maxFontSizeMultiplier.stat, 1.5);
});

test('every cap is >= 1 and <= 2', () => {
  for (const r of roles) assert.ok(maxFontSizeMultiplier[r] >= 1 && maxFontSizeMultiplier[r] <= 2);
});

test('system scale below the cap passes through', () => {
  assert.equal(effectiveScale('body', 1.3), 1.3);
  assert.equal(effectiveScale('h1', 1.0), 1.0);
});

test('system scale above the cap is clamped per role', () => {
  assert.equal(effectiveScale('body', 3), 2.0);
  assert.equal(effectiveScale('h2', 2), 1.75);
  assert.equal(effectiveScale('h1', 2), 1.5);
  assert.equal(effectiveScale('stat', 2), 1.5);
});

test('override wins over the system scale, then is clamped', () => {
  assert.equal(effectiveScale('body', 1.0, 1.3), 1.3);
  assert.equal(effectiveScale('body', 1.0, 2.5), 2.0);
  assert.equal(effectiveScale('h1', 2.0, 1.0), 1.0);
});

test('invalid override falls back to system scale; invalid system falls back to 1', () => {
  assert.equal(effectiveScale('body', 1.5, Number.NaN), 1.5);
  assert.equal(effectiveScale('body', 1.5, 0), 1.5);
  assert.equal(effectiveScale('body', 1.5, -2), 1.5);
  assert.equal(effectiveScale('body', Number.NaN), 1);
  assert.equal(effectiveScale('body', Number.POSITIVE_INFINITY), 1);
  assert.equal(effectiveScale('body', 0), 1);
});

test('exact cap boundary is allowed', () => {
  assert.equal(effectiveScale('h2', 1.75), 1.75);
});
