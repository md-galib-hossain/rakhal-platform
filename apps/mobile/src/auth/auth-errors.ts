/**
 * Maps a failed auth call to a user-facing message key (WP5d). Pure: node --test imports this file.
 *
 * The server answers a wrong password, an unknown identifier AND a locked account with the same 401 "Invalid
 * credentials" (by design: no account enumeration), so the copy for `invalid` also mentions the lockout rule.
 * A 429 is the rate limiter. A request that never got a response is a network problem, which must not read as
 * "wrong password" (UX P1 15: distinguish no network / server error / bad credentials).
 */
import { ApiError, NetworkError } from '@rakhal/api-client';
import type { MessageKey } from '../i18n/messages.ts';

export type AuthErrorKind = 'invalid' | 'rateLimited' | 'network' | 'server' | 'unknown';

export function authErrorKind(error: unknown): AuthErrorKind {
  if (error instanceof NetworkError) return 'network';
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 400) return 'invalid';
    if (error.status === 429) return 'rateLimited';
    if (error.status >= 500) return 'server';
  }
  return 'unknown';
}

const KEYS: Readonly<Record<AuthErrorKind, MessageKey>> = {
  invalid: 'auth.error.invalid',
  rateLimited: 'auth.error.rateLimited',
  network: 'auth.error.network',
  server: 'auth.error.server',
  unknown: 'common.error.generic',
};

export function authErrorMessageKey(error: unknown): MessageKey {
  return KEYS[authErrorKind(error)];
}
