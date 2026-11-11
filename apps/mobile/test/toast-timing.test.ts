import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOAST_ACTION_MS,
  TOAST_BOTTOM_MARGIN,
  TOAST_DEFAULT_MS,
  TOAST_ENTER_MS,
  TOAST_ENTER_OFFSET,
  TOAST_ERROR_MS,
  TOAST_EXIT_MS,
  TOAST_SCREEN_READER_FACTOR,
  baseToastDuration,
  effectiveToastDuration,
  isPersistent,
  replaceToast,
  toastBottom,
  toastDurations,
  toastLiveRegion,
} from '../src/components/feedback/toast-timing.ts';

test('base durations per kind: 4s plain, 5s with undo, 6s error, 0 persistent', () => {
  assert.equal(TOAST_DEFAULT_MS, 4000);
  assert.equal(TOAST_ACTION_MS, 5000);
  assert.equal(TOAST_ERROR_MS, 6000);
  assert.equal(baseToastDuration({ tone: 'success', hasAction: false }), 4000);
  assert.equal(baseToastDuration({ tone: 'info', hasAction: false }), 4000);
  assert.equal(baseToastDuration({ tone: 'success', hasAction: true }), 5000);
  assert.equal(baseToastDuration({ tone: 'error', hasAction: false }), 6000);
  assert.equal(baseToastDuration({ tone: 'error', hasAction: true }), 6000);
});

test('an explicit durationMs wins, including 0 = persistent; invalid values fall back', () => {
  assert.equal(baseToastDuration({ tone: 'success', hasAction: false, durationMs: 1500 }), 1500);
  assert.equal(baseToastDuration({ tone: 'error', hasAction: true, durationMs: 0 }), 0);
  assert.equal(isPersistent(0), true);
  assert.equal(isPersistent(4000), false);
  assert.equal(baseToastDuration({ tone: 'success', hasAction: false, durationMs: -5 }), 4000);
  assert.equal(baseToastDuration({ tone: 'success', hasAction: true, durationMs: Number.NaN }), 5000);
});

test('screen reader extends the window: platform-recommended value, else x3; never shortens; 0 stays 0', () => {
  assert.equal(TOAST_SCREEN_READER_FACTOR, 3);
  assert.equal(effectiveToastDuration(4000, { screenReader: false }), 4000);
  assert.equal(effectiveToastDuration(4000, { screenReader: false, recommendedMs: 20000 }), 4000);
  assert.equal(effectiveToastDuration(4000, { screenReader: true }), 12000);
  assert.equal(effectiveToastDuration(5000, { screenReader: true, recommendedMs: 30000 }), 30000);
  assert.equal(effectiveToastDuration(5000, { screenReader: true, recommendedMs: 2000 }), 5000);
  assert.equal(effectiveToastDuration(5000, { screenReader: true, recommendedMs: Number.NaN }), 15000);
  assert.equal(effectiveToastDuration(0, { screenReader: true, recommendedMs: 9000 }), 0);
});

test('the undo window is the action duration, extended for screen readers', () => {
  const base = baseToastDuration({ tone: 'success', hasAction: true });
  assert.equal(effectiveToastDuration(base, { screenReader: false }), 5000);
  assert.equal(effectiveToastDuration(base, { screenReader: true }), 15000);
});

test('a new toast replaces the current one (one at a time); no queue', () => {
  assert.equal(replaceToast('a', 'b'), 'b');
  assert.equal(replaceToast(null, 'b'), 'b');
});

test('live region: assertive for error, polite otherwise', () => {
  assert.equal(toastLiveRegion('error'), 'assertive');
  assert.equal(toastLiveRegion('success'), 'polite');
  assert.equal(toastLiveRegion('info'), 'polite');
});

test('motion: enter 180ms + 16dp, exit 120ms; reduce motion makes both 0', () => {
  assert.deepEqual(toastDurations(false), { enter: 180, exit: 120 });
  assert.deepEqual(toastDurations(true), { enter: 0, exit: 0 });
  assert.equal(TOAST_ENTER_MS, 180);
  assert.equal(TOAST_EXIT_MS, 120);
  assert.equal(TOAST_ENTER_OFFSET, 16);
});

test('bottom placement: inset + 16 + bottomOffset, sanitised', () => {
  assert.equal(TOAST_BOTTOM_MARGIN, 16);
  assert.equal(toastBottom(24, 0), 40);
  assert.equal(toastBottom(0, 0), 16);
  assert.equal(toastBottom(24, 56), 96);
  assert.equal(toastBottom(Number.NaN, -10), 16);
  assert.equal(toastBottom(10, undefined), 26);
});
