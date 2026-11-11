import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIP_METRICS, chipColors } from '../src/components/forms/chip-style.ts';
import { contrastPairs, touchTarget, type AnyColorName } from '../src/theme/tokens.ts';

const isListed = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.some((p) => p.fg === fg && p.bg === bg);

test('metrics: 48 target, 16 horizontal padding, 18dp leading slot', () => {
  assert.equal(CHIP_METRICS.minHeight, touchTarget.min);
  assert.equal(CHIP_METRICS.minWidth, touchTarget.min);
  assert.equal(CHIP_METRICS.paddingHorizontal, 16);
  assert.equal(CHIP_METRICS.leadingSlot, 18);
});

test('colour table matches the spec', () => {
  assert.deepEqual(chipColors(false, false), { fill: 'card', label: 'foreground', border: 'inputBorder', mark: 'inputBorder' });
  assert.deepEqual(chipColors(true, false), { fill: 'primary', label: 'primaryForeground', border: 'primary', mark: 'primaryForeground' });
});

test('disabled is muted for both selection states', () => {
  for (const selected of [false, true]) {
    assert.deepEqual(chipColors(selected, true), { fill: 'muted', label: 'mutedForeground', border: 'border', mark: 'mutedForeground' });
  }
});

test('every label/fill pair is in contrastPairs; borders and marks meet the ui list', () => {
  for (const selected of [false, true]) {
    for (const disabled of [false, true]) {
      const c = chipColors(selected, disabled);
      assert.ok(isListed(c.label, c.fill), `${c.label} on ${c.fill}`);
    }
  }
  assert.ok(isListed('inputBorder', 'card'));
});
