/**
 * API base URL. Set `EXPO_PUBLIC_API_BASE_URL` (inlined by Expo at bundle time) to the customer API origin plus prefix,
 * e.g. `https://api.example.com/api/v1`. In development it falls back to the Android emulator's host loopback
 * (`10.0.2.2`) and the API's default port. A release build with no value throws at startup instead of silently
 * talking to a development address.
 */
export const DEV_API_BASE_URL = 'http://10.0.2.2:5000/api/v1';

export function resolveApiBaseUrl(env: string | undefined, isDev: boolean): string {
  const value = env?.trim();
  if (value) return value.replace(/\/+$/, '');
  if (isDev) return DEV_API_BASE_URL;
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, __DEV__);
}
