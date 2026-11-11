import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canStep,
  clampToRange,
  exceedsMax,
  parseDecimalInput,
  stepValue,
  toInputString,
} from '../src/components/forms/decimal-input.ts';

const P = (text: string, decimals = 1) => parseDecimalInput(text, { decimals });

test('empty and whitespace-only input is empty', () => {
  assert.deepEqual(P(''), { kind: 'empty', value: null, normalized: '' });
  assert.deepEqual(P('   '), { kind: 'empty', value: null, normalized: '' });
});

test('plain integers and decimals', () => {
  assert.deepEqual(P('12'), { kind: 'valid', value: 12, normalized: '12' });
  assert.deepEqual(P('12.5'), { kind: 'valid', value: 12.5, normalized: '12.5' });
  assert.deepEqual(P('0.5'), { kind: 'valid', value: 0.5, normalized: '0.5' });
  assert.deepEqual(P('.5'), { kind: 'valid', value: 0.5, normalized: '0.5' });
  assert.deepEqual(P('007'), { kind: 'valid', value: 7, normalized: '7' });
});

test('a trailing separator is partial (keeps the draft legal mid-typing)', () => {
  assert.deepEqual(P('12.'), { kind: 'partial', value: 12, normalized: '12.' });
  assert.deepEqual(P('12,'), { kind: 'partial', value: 12, normalized: '12.' });
  assert.deepEqual(P('.'), { kind: 'partial', value: null, normalized: '0.' });
});

test('comma is a decimal separator (Android decimal-pad follows the device locale)', () => {
  assert.deepEqual(P('12,5'), { kind: 'valid', value: 12.5, normalized: '12.5' });
});

test('Bangla digits are accepted, alone and mixed with Latin', () => {
  assert.deepEqual(P('১২.৫'), { kind: 'valid', value: 12.5, normalized: '12.5' });
  assert.deepEqual(P('১২,৫'), { kind: 'valid', value: 12.5, normalized: '12.5' });
  assert.deepEqual(P('০'), { kind: 'valid', value: 0, normalized: '0' });
  assert.deepEqual(P('১২.'), { kind: 'partial', value: 12, normalized: '12.' });
  assert.deepEqual(P('1২.5'), { kind: 'valid', value: 12.5, normalized: '12.5' });
});

test('spaces are stripped (including NBSP)', () => {
  assert.deepEqual(P(' 7 '), { kind: 'valid', value: 7, normalized: '7' });
  assert.deepEqual(P('1 2.5'), { kind: 'valid', value: 12.5, normalized: '12.5' });
  assert.deepEqual(P('12 .5'), { kind: 'valid', value: 12.5, normalized: '12.5' });
});

test('more fraction digits than `decimals` is rejected, never silently rounded', () => {
  assert.equal(P('12.55', 1).kind, 'invalid');
  assert.equal(P('12.5', 0).kind, 'invalid');
  assert.equal(P('12.', 0).kind, 'invalid'); // decimals 0 allows no separator at all
  assert.deepEqual(P('12.55', 2), { kind: 'valid', value: 12.55, normalized: '12.55' });
  assert.deepEqual(P('12', 0), { kind: 'valid', value: 12, normalized: '12' });
});

test('two separators, signs, exponents, letters, NaN-like text are invalid', () => {
  for (const bad of ['1.2.3', '1,2,3', '1.2,3', '-1', '+1', '1e3', '1E3', 'abc', 'NaN', 'Infinity', '1/2', '১২৩x', '--', '١٢']) {
    assert.deepEqual(P(bad), { kind: 'invalid', value: null, normalized: '' }, bad);
  }
});

test('absurdly long digit strings are invalid (no precision loss)', () => {
  assert.equal(P('1'.repeat(16)).kind, 'invalid');
  assert.equal(P('1'.repeat(15)).kind, 'valid');
});

test('no float drift while parsing', () => {
  assert.equal(P('0.3').value, 0.3);
  assert.equal(P('1.1', 1).value, 1.1);
  assert.equal(P('4.35', 2).value, 4.35);
  assert.equal(P('1234567.89', 2).value, 1234567.89);
});

test('toInputString: plain string, no grouping, trailing zeros trimmed', () => {
  assert.equal(toInputString(12.5, 1, 'latn'), '12.5');
  assert.equal(toInputString(12, 1, 'latn'), '12');
  assert.equal(toInputString(12.0, 2, 'latn'), '12');
  assert.equal(toInputString(1234567.5, 1, 'latn'), '1234567.5');
  assert.equal(toInputString(0, 1, 'latn'), '0');
  assert.equal(toInputString(null, 1, 'latn'), '');
  assert.equal(toInputString(Number.NaN, 1, 'latn'), '');
  assert.equal(toInputString(Number.POSITIVE_INFINITY, 1, 'latn'), '');
});

test('toInputString applies the digit system', () => {
  assert.equal(toInputString(12.5, 1, 'beng'), '১২.৫');
  assert.equal(toInputString(0, 1, 'beng'), '০');
});

test('toInputString rounds to decimals', () => {
  assert.equal(toInputString(0.1 + 0.2, 1, 'latn'), '0.3');
  assert.equal(toInputString(12.55, 1, 'latn'), '12.6');
});

test('round trip: parse(toInputString(v)) === v, both digit systems', () => {
  for (const v of [0, 0.5, 1, 12.5, 99.9, 1000]) {
    for (const d of ['latn', 'beng'] as const) assert.equal(P(toInputString(v, 1, d)).value, v);
  }
});

const B = { step: 0.5, min: 0, max: 20, decimals: 1 };

test('stepValue adds and subtracts one step', () => {
  assert.equal(stepValue(10, 1, B), 10.5);
  assert.equal(stepValue(10, -1, B), 9.5);
});

test('stepValue clamps at the bounds', () => {
  assert.equal(stepValue(0.2, -1, B), 0);
  assert.equal(stepValue(0, -1, B), 0);
  assert.equal(stepValue(19.8, 1, B), 20);
  assert.equal(stepValue(20, 1, B), 20);
  assert.equal(stepValue(50, -1, B), 20); // out-of-range input is pulled into range
  assert.equal(stepValue(5, 1, { ...B, max: undefined }), 5.5);
});

test('stepValue treats null as min: + gives min + step, - stays null', () => {
  assert.equal(stepValue(null, 1, B), 0.5);
  assert.equal(stepValue(null, 1, { ...B, min: 2 }), 2.5);
  assert.equal(stepValue(null, -1, B), null);
});

test('stepValue has no float drift', () => {
  assert.equal(stepValue(0.1, 1, { step: 0.2, min: 0, decimals: 1 }), 0.3);
  assert.equal(stepValue(0.7, 1, { step: 0.1, min: 0, decimals: 1 }), 0.8);
  assert.equal(stepValue(0.3, -1, { step: 0.1, min: 0, decimals: 1 }), 0.2);
  assert.equal(stepValue(1.15, 1, { step: 0.05, min: 0, decimals: 2 }), 1.2);
  let v: number | null = 0;
  for (let i = 0; i < 30; i++) v = stepValue(v, 1, { step: 0.1, min: 0, decimals: 1 });
  assert.equal(v, 3);
});

test('stepValue ignores bad numbers', () => {
  assert.equal(stepValue(Number.NaN, 1, B), 0.5); // NaN is treated as empty
  assert.equal(stepValue(5, 1, { ...B, step: 0 }), 5);
  assert.equal(stepValue(5, 1, { ...B, step: Number.NaN }), 5);
});

test('canStep: - disabled at min and when empty, + disabled at max', () => {
  assert.equal(canStep(10, -1, B), true);
  assert.equal(canStep(0, -1, B), false);
  assert.equal(canStep(null, -1, B), false);
  assert.equal(canStep(null, 1, B), true);
  assert.equal(canStep(20, 1, B), false);
  assert.equal(canStep(19.5, 1, B), true);
  assert.equal(canStep(100, 1, { ...B, max: undefined }), true);
});

test('clampToRange and exceedsMax', () => {
  assert.equal(clampToRange(-3, { min: 0, max: 20 }), 0);
  assert.equal(clampToRange(25, { min: 0, max: 20 }), 20);
  assert.equal(clampToRange(7, { min: 0 }), 7);
  assert.equal(clampToRange(7, {}), 7);
  assert.equal(exceedsMax(20.1, 20), true);
  assert.equal(exceedsMax(20, 20), false);
  assert.equal(exceedsMax(1e9, undefined), false);
});
