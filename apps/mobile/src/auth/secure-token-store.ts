/**
 * `TokenStore` over expo-secure-store (Android Keystore / iOS Keychain). Holds ONLY the refresh token and the active
 * farm id, as one JSON value under a versioned key. The access token never touches disk; AsyncStorage is never used
 * for credentials (prefs only). A value that does not parse to the expected shape is treated as "no session" and
 * removed, so a corrupted entry cannot wedge the app on a login loop.
 */
import * as SecureStore from 'expo-secure-store';
import type { StoredSession, TokenStore } from '@rakhal/api-client';

export const SESSION_KEY = 'rakhal.auth.session.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable after the first unlock so a background sync (WP8b) can refresh a token while the phone is locked.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.refreshToken === 'string' && v.refreshToken.length > 0 && typeof v.farmId === 'string';
}

export const secureTokenStore: TokenStore = {
  async load() {
    const raw = await SecureStore.getItemAsync(SESSION_KEY, OPTIONS);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredSession(parsed)) return { refreshToken: parsed.refreshToken, farmId: parsed.farmId };
    } catch {
      // fall through: corrupted value
    }
    await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
    return null;
  },

  async save(session) {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ refreshToken: session.refreshToken, farmId: session.farmId }),
      OPTIONS,
    );
  },

  async clear() {
    await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
  },
};
