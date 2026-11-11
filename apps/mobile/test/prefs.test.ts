import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFS,
  PREF_KEYS,
  loadPrefs,
  memoryPrefs,
  parseDigitsPref,
  parseLocalePref,
  savePref,
  type PrefStorage,
} from '../src/storage/prefs.ts';
import { parseThemePref, resolveScheme } from '../src/theme/theme-pref.ts';

const silent = () => {};
const garbage: unknown[] = [undefined, null, '', ' ', 'DARK', 'Light', 'bn-BD', 'fr', 0, 1, true, {}, [], 'null', '{"a":1}'];

test('defaults: system theme, bn locale, latn digits', () => {
  assert.deepEqual(DEFAULT_PREFS, { theme: 'system', locale: 'bn', digits: 'latn' });
});

test('key names are the spec keys', () => {
  assert.deepEqual(PREF_KEYS, {
    theme: 'rakhal.pref.theme',
    locale: 'rakhal.pref.locale',
    digits: 'rakhal.pref.digits',
  });
});

test('parsers accept valid values', () => {
  for (const v of ['system', 'light', 'dark']) assert.equal(parseThemePref(v), v);
  for (const v of ['bn', 'en']) assert.equal(parseLocalePref(v), v);
  for (const v of ['latn', 'beng']) assert.equal(parseDigitsPref(v), v);
});

test('parsers return the default for any garbage and never throw', () => {
  for (const g of garbage) {
    assert.equal(parseThemePref(g), 'system');
    assert.equal(parseLocalePref(g), 'bn');
    assert.equal(parseDigitsPref(g), 'latn');
  }
});

test('resolveScheme: explicit modes ignore the OS scheme', () => {
  for (const os of ['light', 'dark', null, undefined]) {
    assert.equal(resolveScheme('light', os), 'light');
    assert.equal(resolveScheme('dark', os), 'dark');
  }
});

test('resolveScheme: system follows the OS, unknown OS value is light', () => {
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', 'light'), 'light');
  for (const os of [null, undefined, 'unspecified', 'DARK', 3]) assert.equal(resolveScheme('system', os), 'light');
});

test('loadPrefs from empty storage returns defaults', async () => {
  assert.deepEqual(await loadPrefs(memoryPrefs(), silent), DEFAULT_PREFS);
});

test('save then load round-trips every key', async () => {
  const s = memoryPrefs();
  await savePref(s, 'theme', 'dark', silent);
  await savePref(s, 'locale', 'en', silent);
  await savePref(s, 'digits', 'beng', silent);
  assert.deepEqual(s.dump(), {
    'rakhal.pref.theme': 'dark',
    'rakhal.pref.locale': 'en',
    'rakhal.pref.digits': 'beng',
  });
  assert.deepEqual(await loadPrefs(s, silent), { theme: 'dark', locale: 'en', digits: 'beng' });
});

test('corrupt stored values fall back per key without affecting valid ones', async () => {
  const s = memoryPrefs({ [PREF_KEYS.theme]: 'purple', [PREF_KEYS.locale]: 'en', [PREF_KEYS.digits]: '{bad' });
  assert.deepEqual(await loadPrefs(s, silent), { theme: 'system', locale: 'en', digits: 'latn' });
});

test('read failure yields defaults, is logged, and never rejects', async () => {
  const logged: string[] = [];
  const failing: PrefStorage = {
    getItem: () => Promise.reject(new Error('disk')),
    setItem: () => Promise.resolve(),
  };
  const prefs = await loadPrefs(failing, (m) => logged.push(m));
  assert.deepEqual(prefs, DEFAULT_PREFS);
  assert.equal(logged.length, 3);
});

test('synchronous throw inside getItem is also contained', async () => {
  const throwing: PrefStorage = {
    getItem: () => {
      throw new Error('sync');
    },
    setItem: () => Promise.resolve(),
  };
  assert.deepEqual(await loadPrefs(throwing, silent), DEFAULT_PREFS);
});

test('write failure is swallowed and logged', async () => {
  const logged: string[] = [];
  const failing: PrefStorage = {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.reject(new Error('full')),
  };
  await assert.doesNotReject(savePref(failing, 'locale', 'en', (m) => logged.push(m)));
  assert.equal(logged.length, 1);
  assert.match(logged[0]!, /rakhal\.pref\.locale/);
});
