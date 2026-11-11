import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHEET_BACKDROP_MS,
  SHEET_BACKDROP_OPACITY,
  SHEET_ENTER_MS,
  SHEET_EXIT_MS,
  SHEET_MAX_HEIGHT_FRACTION,
  dismissAllowed,
  sheetBottomPadding,
  sheetDurations,
} from '../src/components/internal/sheet-motion.ts';
import { contrastPairs, type AnyColorName } from '../src/theme/tokens.ts';

const isListed = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.some((p) => p.fg === fg && p.bg === bg);

test('durations match the spec: 150 backdrop, 220 enter, 160 exit, all <= 220', () => {
  assert.deepEqual(sheetDurations(false), { backdrop: 150, enter: 220, exit: 160 });
  assert.equal(SHEET_BACKDROP_MS, 150);
  assert.equal(SHEET_ENTER_MS, 220);
  assert.equal(SHEET_EXIT_MS, 160);
  assert.ok(Math.max(SHEET_BACKDROP_MS, SHEET_ENTER_MS, SHEET_EXIT_MS) <= 220);
});

test('reduce motion makes every duration 0', () => {
  assert.deepEqual(sheetDurations(true), { backdrop: 0, enter: 0, exit: 0 });
});

test('backdrop opacity 0.5; sheet capped at 90% of the screen', () => {
  assert.equal(SHEET_BACKDROP_OPACITY, 0.5);
  assert.equal(SHEET_MAX_HEIGHT_FRACTION, 0.9);
});

test('bottom padding = 16 + max(inset, 16); bad input falls back to the minimum', () => {
  assert.equal(sheetBottomPadding(0), 32);
  assert.equal(sheetBottomPadding(8), 32);
  assert.equal(sheetBottomPadding(34), 50);
  assert.equal(sheetBottomPadding(Number.NaN), 32);
});

test('dismissal follows the dismissable flag', () => {
  assert.equal(dismissAllowed(true), true);
  assert.equal(dismissAllowed(false), false);
});

test('sheet text pairs on popover are listed (popoverForeground, mutedForeground)', () => {
  assert.ok(isListed('popoverForeground', 'popover'));
  assert.ok(isListed('foreground', 'popover'));
  assert.ok(isListed('mutedForeground', 'popover'));
});
