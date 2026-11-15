import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMem = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockMem.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockMem.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockMem.delete(key);
    return Promise.resolve();
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { SESSION_KEY, secureTokenStore } from './secure-token-store.ts';

describe('secureTokenStore', () => {
  beforeEach(() => {
    mockMem.clear();
    jest.clearAllMocks();
  });

  it('round-trips the refresh token and farm id as one SecureStore value, readable after first unlock', async () => {
    await secureTokenStore.save({ refreshToken: 'refresh-1', farmId: 'farm-1' });
    expect(await secureTokenStore.load()).toEqual({ refreshToken: 'refresh-1', farmId: 'farm-1' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SESSION_KEY, expect.any(String), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    expect(mockMem.size).toBe(1);
  });

  it('never persists anything but the two fields (no access token can leak in)', async () => {
    await secureTokenStore.save({ refreshToken: 'r', farmId: 'f', accessToken: 'SECRET' } as never);
    expect(JSON.parse(mockMem.get(SESSION_KEY) ?? '{}')).toEqual({ refreshToken: 'r', farmId: 'f' });
  });

  it('returns null when empty, and clear removes the entry', async () => {
    expect(await secureTokenStore.load()).toBeNull();
    await secureTokenStore.save({ refreshToken: 'r', farmId: '' });
    await secureTokenStore.clear();
    expect(await secureTokenStore.load()).toBeNull();
  });

  it.each([['not json'], ['{"refreshToken":""}'], ['{"farmId":"f"}'], ['[]'], ['null']])(
    'treats a corrupted value (%s) as no session and deletes it',
    async (raw) => {
      mockMem.set(SESSION_KEY, raw);
      expect(await secureTokenStore.load()).toBeNull();
      expect(mockMem.has(SESSION_KEY)).toBe(false);
    },
  );
});
