import Constants from 'expo-constants';
import { resolveApiBaseUrl } from './api-config.ts';

/** The API address for this build and run (env override, or the Metro host in development). One source for the HTTP client and the sync probe. */
export function currentApiBaseUrl(): string {
  return resolveApiBaseUrl({
    env: process.env.EXPO_PUBLIC_API_BASE_URL,
    isDev: __DEV__,
    hostUri: Constants.expoConfig?.hostUri,
    port: process.env.EXPO_PUBLIC_API_PORT,
  });
}
