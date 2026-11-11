import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStoragePrefs } from './async-storage-prefs.ts';
import { DEFAULT_PREFS, PREF_KEYS, loadPrefs, savePref } from './prefs.ts';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const silent = () => {};

describe('asyncStoragePrefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await loadPrefs(asyncStoragePrefs, silent)).toEqual(DEFAULT_PREFS);
  });

  it('round-trips preferences through AsyncStorage under the spec keys', async () => {
    await savePref(asyncStoragePrefs, 'theme', 'dark', silent);
    await savePref(asyncStoragePrefs, 'locale', 'en', silent);
    await savePref(asyncStoragePrefs, 'digits', 'beng', silent);
    expect(await AsyncStorage.getItem(PREF_KEYS.theme)).toBe('dark');
    expect(await AsyncStorage.getItem(PREF_KEYS.locale)).toBe('en');
    expect(await loadPrefs(asyncStoragePrefs, silent)).toEqual({ theme: 'dark', locale: 'en', digits: 'beng' });
  });

  it('falls back to defaults for corrupt stored values and never throws', async () => {
    await AsyncStorage.setItem(PREF_KEYS.theme, '{"oops":true}');
    await AsyncStorage.setItem(PREF_KEYS.locale, 'klingon');
    await AsyncStorage.setItem(PREF_KEYS.digits, '');
    expect(await loadPrefs(asyncStoragePrefs, silent)).toEqual(DEFAULT_PREFS);
  });

  it('swallows a rejected AsyncStorage read and a rejected write', async () => {
    (AsyncStorage.getItem as jest.Mock<typeof AsyncStorage.getItem>).mockRejectedValueOnce(new Error('boom'));
    expect(await loadPrefs(asyncStoragePrefs, silent)).toEqual(DEFAULT_PREFS);
    (AsyncStorage.setItem as jest.Mock<typeof AsyncStorage.setItem>).mockRejectedValueOnce(new Error('full'));
    await expect(savePref(asyncStoragePrefs, 'theme', 'light', silent)).resolves.toBeUndefined();
  });
});
