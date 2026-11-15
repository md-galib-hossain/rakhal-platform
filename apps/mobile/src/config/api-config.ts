/**
 * API base URL. Set `EXPO_PUBLIC_API_BASE_URL` (inlined by Expo at bundle time) to the customer API origin plus prefix,
 * e.g. `https://api.example.com/api/v1`.
 *
 * In development, when it is not set, the API is assumed to run on the same machine as Metro: the host comes from
 * Expo's `hostUri` (e.g. `192.168.0.100:8081`) and the port from `EXPO_PUBLIC_API_PORT` (default 5000, the API's own
 * default). This works for an emulator and for a phone on the same network. The Android emulator loopback `10.0.2.2`
 * is only the last resort: on a Pixel 8 / Android 17 emulator Expo Go requests to it hung until the timeout while the
 * LAN address of the same machine worked. A release build with no value throws at startup instead of silently talking
 * to a development address.
 */
export const DEFAULT_DEV_API_PORT = '5000';
export const DEV_API_FALLBACK_URL = `http://10.0.2.2:${DEFAULT_DEV_API_PORT}/api/v1`;

export interface ApiBaseUrlInput {
  /** `process.env.EXPO_PUBLIC_API_BASE_URL` */
  env: string | undefined;
  isDev: boolean;
  /** Expo's `Constants.expoConfig?.hostUri`, e.g. `192.168.0.100:8081`. */
  hostUri?: string | null;
  /** `process.env.EXPO_PUBLIC_API_PORT` */
  port?: string | undefined;
}

export function resolveApiBaseUrl({ env, isDev, hostUri, port }: ApiBaseUrlInput): string {
  const value = env?.trim();
  if (value) return value.replace(/\/+$/, '');
  if (!isDev) throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');

  const host = hostUri?.trim().replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0];
  const apiPort = port?.trim() || DEFAULT_DEV_API_PORT;
  return host ? `http://${host}:${apiPort}/api/v1` : DEV_API_FALLBACK_URL;
}
