import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STACK_AT_FONT_SCALE,
  UNIT_DROP_FRACTION,
  shouldStack,
  shouldDropUnit,
  targetSize,
} from '../src/components/internal/layout-rules.ts';
import { touchTarget } from '../src/theme/tokens.ts';

test('stack threshold is 1.3 and strictly greater-than', () => {
  assert.equal(STACK_AT_FONT_SCALE, 1.3);
  assert.equal(shouldStack(1), false);
  assert.equal(shouldStack(1.3), false);
  assert.equal(shouldStack(1.31), true);
  assert.equal(shouldStack(2), true);
});

test('shouldStack is safe on bad input (never stacks on NaN or <= 0)', () => {
  assert.equal(shouldStack(Number.NaN), false);
  assert.equal(shouldStack(0), false);
  assert.equal(shouldStack(-2), false);
});

test('unit drops under the value only past 40% of the width and only when scaled', () => {
  assert.equal(UNIT_DROP_FRACTION, 0.4);
  assert.equal(shouldDropUnit({ fontScale: 1, unitWidth: 200, containerWidth: 300 }), false);
  assert.equal(shouldDropUnit({ fontScale: 1.5, unitWidth: 100, containerWidth: 300 }), false);
  assert.equal(shouldDropUnit({ fontScale: 1.5, unitWidth: 121, containerWidth: 300 }), true);
  assert.equal(shouldDropUnit({ fontScale: 1.5, unitWidth: 120, containerWidth: 300 }), false);
  assert.equal(shouldDropUnit({ fontScale: 1.5, unitWidth: 10, containerWidth: 0 }), false);
});

test('targetSize maps md/lg to the touchTarget tokens', () => {
  assert.equal(targetSize('md'), touchTarget.min);
  assert.equal(targetSize('lg'), touchTarget.primary);
  assert.equal(targetSize('md'), 48);
  assert.equal(targetSize('lg'), 56);
});
