/** The only file that imports AsyncStorage. Plain preferences only: never store tokens or secrets here. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PrefStorage } from './prefs.ts';

export const asyncStoragePrefs: PrefStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
