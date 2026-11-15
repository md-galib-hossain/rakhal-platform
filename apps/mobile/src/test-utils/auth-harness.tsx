/**
 * Test-only: a real `AuthProvider` over a real `ApiClient` whose `fetch` is a scripted fake and whose token store is
 * in memory, wrapped in the SafeAreaProvider the screens need. Never import from app code.
 */
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createApiClient,
  createMemoryTokenStore,
  type ApiClient,
  type StoredSession,
} from '@rakhal/api-client';
import { AuthProvider } from '../auth/AuthProvider.tsx';
import type { PrefStorage } from '../storage/prefs.ts';

export type Reply = { status?: number; json?: unknown } | 'network';
export type Handler = (url: string, body: Record<string, unknown> | undefined, method: string) => Reply;

export const user = { id: 'u1', email: 'rahim@farm.test', name: 'Rahim', isEmailVerified: true };
export const ok = (data: unknown): Reply => ({ status: 200, json: { success: true, data } });
export const fail = (status: number, message = 'nope'): Reply => ({ status, json: { success: false, message } });
export const sessionReply = (n: number, farmId = 'farm-1'): Reply =>
  ok({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, sessionId: 's1', user, farmId, needsFarm: farmId === '' });

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

export function fakeApi(handler: Handler, stored: StoredSession | null = null, accessStorage?: PrefStorage) {
  const store = createMemoryTokenStore(stored);
  const requests: { url: string; method: string; body: Record<string, unknown> | undefined }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    requests.push({ url, method: String(init.method), body });
    const reply = handler(url, body, String(init.method));
    if (reply === 'network') throw new TypeError('Network request failed');
    return {
      ok: (reply.status ?? 200) < 400,
      status: reply.status ?? 200,
      json: () => Promise.resolve(reply.json),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  const createClient = (hooks: { onSessionExpired: () => void }): ApiClient =>
    createApiClient({ baseUrl: 'https://api.test/api/v1', store, fetch: fetchImpl, onSessionExpired: hooks.onSessionExpired });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <AuthProvider createClient={createClient} accessStorage={accessStorage}>
          {children}
        </AuthProvider>
      </SafeAreaProvider>
    );
  }

  return { store, requests, Wrapper };
}
