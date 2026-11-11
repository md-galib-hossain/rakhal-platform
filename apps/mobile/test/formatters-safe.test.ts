import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAFE_PLACEHOLDER, bindFormatters } from '../src/i18n/formatters.ts';

const f = bindFormatters('en', 'latn');

test('safe variants match the throwing originals on valid input', () => {
  const at = Date.UTC(2026, 10, 11, 18, 30);
  assert.equal(f.moneySafe(1250000), f.money(1250000));
  assert.equal(f.numberSafe(1234.5, { fractionDigits: 1 }), f.number(1234.5, { fractionDigits: 1 }));
  assert.equal(f.dateSafe(at, 'long'), f.date(at, 'long'));
  assert.equal(f.dateTimeSafe(at), f.dateTime(at));
  assert.equal(f.timeSafe(at), f.time(at));
});

test('the throwing originals still throw RangeError on bad input', () => {
  assert.throws(() => f.money(Number.NaN), RangeError);
  assert.throws(() => f.number(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => f.date(Number.NaN), RangeError);
});

test('safe variants return the placeholder on RangeError', () => {
  assert.equal(SAFE_PLACEHOLDER, '—');
  assert.equal(f.moneySafe(Number.NaN), SAFE_PLACEHOLDER);
  assert.equal(f.moneySafe(1, { fractionDigits: 99 }), SAFE_PLACEHOLDER);
  assert.equal(f.numberSafe(Number.POSITIVE_INFINITY), SAFE_PLACEHOLDER);
  assert.equal(f.dateSafe(Number.NaN), SAFE_PLACEHOLDER);
  assert.equal(f.dateTimeSafe(Number.NaN), SAFE_PLACEHOLDER);
  assert.equal(f.timeSafe(Number.NaN), SAFE_PLACEHOLDER);
});
