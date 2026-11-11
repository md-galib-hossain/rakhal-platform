import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, PREF_KEYS, loadPrefsBounded, memoryPrefs, type PrefStorage } from '../src/storage/prefs.ts';

test('loadPrefsBounded returns stored values when storage answers in time', async () => {
  const storage = memoryPrefs({ [PREF_KEYS.theme]: 'dark', [PREF_KEYS.locale]: 'en' });
  const prefs = await loadPrefsBounded(storage, 1000, () => {});
  assert.deepEqual(prefs, { theme: 'dark', locale: 'en', digits: 'latn' });
});

test('loadPrefsBounded falls back to defaults and warns when a read never settles', async () => {
  const hung: PrefStorage = { getItem: () => new Promise<string | null>(() => {}), setItem: async () => {} };
  const logs: string[] = [];
  const prefs = await loadPrefsBounded(hung, 20, (message) => logs.push(message));
  assert.deepEqual(prefs, DEFAULT_PREFS);
  assert.equal(logs.length, 1);
  assert.match(logs[0] as string, /exceeded 20ms/);
});
