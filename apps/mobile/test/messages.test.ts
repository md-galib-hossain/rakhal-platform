/**
 * Pure i18n tests (node --test): dictionary parity, placeholder parity, missing-key behaviour, formatter binding.
 * Must not import React / React Native.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bn, en, MESSAGE_KEYS, messages, type MessageKey } from '../src/i18n/messages.ts';
import { interpolate, placeholdersOf, translate } from '../src/i18n/translate.ts';
import { bindFormatters } from '../src/i18n/formatters.ts';

test('every key exists in both locales, no extras either way', () => {
  assert.deepEqual(Object.keys(bn).sort(), Object.keys(en).sort());
  assert.equal(MESSAGE_KEYS.length, Object.keys(en).length);
  assert.ok(MESSAGE_KEYS.length > 0);
});

test('no empty or whitespace-only strings', () => {
  for (const locale of ['bn', 'en'] as const) {
    for (const key of MESSAGE_KEYS) {
      const value = messages[locale][key];
      assert.equal(typeof value, 'string', `${locale}:${key}`);
      assert.ok(value.trim().length > 0, `${locale}:${key} is empty`);
    }
  }
});

test('placeholders match between bn and en for every key', () => {
  for (const key of MESSAGE_KEYS) {
    assert.deepEqual(placeholdersOf(bn[key]).sort(), placeholdersOf(en[key]).sort(), key);
  }
});

test('keys are dotted lowercase identifiers and the dictionary is JSON-compatible', () => {
  for (const key of MESSAGE_KEYS) assert.match(key, /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/, key);
  assert.deepEqual(JSON.parse(JSON.stringify(en)), en);
  assert.deepEqual(JSON.parse(JSON.stringify(bn)), bn);
});

test('no hand-built string concatenation hazards: braces are only well-formed {name} placeholders', () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of ['bn', 'en'] as const) {
      const stripped = messages[locale][key].replace(/\{\w+\}/g, '');
      assert.ok(!/[{}]/.test(stripped), `${locale}:${key} has a stray brace`);
    }
  }
});

test('translate returns the locale string and interpolates named params', () => {
  assert.equal(translate('en', 'gallery.herdCount', { count: 12 }), '12 cows in the herd');
  assert.equal(translate('bn', 'gallery.herdCount', { count: 12 }), 'পালে 12টি গরু আছে');
  assert.equal(translate('bn', 'common.ok'), 'ঠিক আছে');
  assert.equal(translate('en', 'gallery.greeting', { name: 'Rahim' }), 'Hello, Rahim');
});

test('interpolate leaves an unsupplied placeholder visible and ignores extra params', () => {
  assert.equal(interpolate('Hi {name} {x}', { name: 'A' }), 'Hi A {x}');
  assert.equal(interpolate('Hi', { name: 'A' }), 'Hi');
  assert.equal(interpolate('Hi {name}'), 'Hi {name}');
  assert.deepEqual(placeholdersOf('{a} and {b} and {a}'), ['a', 'b']);
});

test('missing key: falls back to English and reports fallback-en', () => {
  const dict = messages as unknown as Record<string, Record<string, string>>;
  const saved = dict.bn!['common.ok'];
  delete dict.bn!['common.ok'];
  try {
    const seen: string[] = [];
    assert.equal(translate('bn', 'common.ok', undefined, (k, l, kind) => seen.push(`${k}|${l}|${kind}`)), 'OK');
    assert.deepEqual(seen, ['common.ok|bn|fallback-en']);
    // an empty string counts as missing too
    dict.bn!['common.ok'] = '';
    assert.equal(translate('bn', 'common.ok'), 'OK');
  } finally {
    dict.bn!['common.ok'] = saved as string;
  }
});

test('missing everywhere: returns the key itself and reports missing; never throws', () => {
  const seen: string[] = [];
  const bogus = 'no.such.key' as MessageKey;
  assert.equal(translate('en', bogus, undefined, (k, l, kind) => seen.push(`${k}|${l}|${kind}`)), 'no.such.key');
  assert.equal(translate('bn', bogus), 'no.such.key');
  assert.deepEqual(seen, ['no.such.key|en|missing']);
});

test('present key does not call onMissing', () => {
  let called = 0;
  translate('bn', 'common.ok', undefined, () => (called += 1));
  assert.equal(called, 0);
});

test('bindFormatters: money is lakh grouped in both locales, only digits vary', () => {
  assert.equal(bindFormatters('bn', 'latn').money(1250000), '৳12,50,000');
  assert.equal(bindFormatters('en', 'latn').money(1250000), '৳12,50,000');
  assert.equal(bindFormatters('bn', 'beng').money(1250000), '৳১২,৫০,০০০');
  assert.equal(bindFormatters('en', 'beng').money(1250000), '৳১২,৫০,০০০');
  assert.equal(bindFormatters('en', 'latn').money(1250000.5, { fractionDigits: 2 }), '৳12,50,000.50');
});

test('bindFormatters: number, date, dateTime, time and farmDay follow locale and digits', () => {
  const f = bindFormatters('en', 'latn');
  const g = bindFormatters('bn', 'beng');
  assert.equal(f.number(1234567.891, { fractionDigits: 3 }), '12,34,567.891');
  assert.equal(g.number(1234567), '১২,৩৪,৫৬৭');
  const at = Date.UTC(2026, 10, 11, 18, 30); // 2026-11-12 00:30 in Dhaka
  assert.equal(f.date(at), '12 Nov, 2026');
  assert.equal(f.date(at, 'long'), '12 November, 2026');
  assert.equal(f.dateTime(at), '12 Nov, 2026, 00:30');
  assert.equal(f.time(at), '00:30');
  assert.equal(f.farmDay(at), '2026-11-12');
  assert.equal(g.farmDay(at), '2026-11-12');
  assert.ok(/[০-৯]/.test(g.date(at)));
  assert.ok(g.date(at) !== f.date(at));
});
