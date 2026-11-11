import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_RING_INSET_OFFSET,
  FOCUS_RING_OFFSET,
  FOCUS_RING_WIDTH,
  focusRingFallbackStyle,
  focusRingStyle,
} from '../src/components/internal/focus-ring.ts';
import { allColors } from '../src/theme/tokens.ts';

test('outside ring: 2dp wide, offset 2dp outside, focusRing token', () => {
  assert.equal(FOCUS_RING_WIDTH, 2);
  assert.equal(FOCUS_RING_OFFSET, 2);
  for (const theme of ['light', 'dark'] as const) {
    const s = focusRingStyle(allColors[theme]);
    assert.equal(s.outlineWidth, 2);
    assert.equal(s.outlineOffset, 2);
    assert.equal(s.outlineColor, allColors[theme].focusRing);
    assert.equal(s.outlineStyle, 'solid');
  }
});

test('inset ring (ListRow) draws 4dp inside the row', () => {
  assert.equal(FOCUS_RING_INSET_OFFSET, -4);
  assert.equal(focusRingStyle(allColors.light, { inset: true }).outlineOffset, -4);
});

test('ring style only carries outline props: never layout, never the fill', () => {
  for (const k of Object.keys(focusRingStyle(allColors.light))) assert.match(k, /^outline/, k);
});

test('fallback (if Android ignores outline): reserved space, ring only when focused, no layout shift', () => {
  const on = focusRingFallbackStyle(allColors.light, true);
  const off = focusRingFallbackStyle(allColors.light, false);
  assert.equal(on.borderColor, allColors.light.focusRing);
  assert.equal(off.borderColor, 'transparent');
  for (const s of [on, off]) {
    assert.equal(s.borderWidth, 2);
    assert.equal(s.padding, 2);
    assert.equal(s.margin, -4);
  }
});
