/**
 * Pure routing rule for the auth gate (WP5d). Given the auth state and the first URL segment, says where the app must
 * go, or `null` to stay. No React, no expo-router: node --test imports this file.
 *
 * Segments: `app/index.tsx` is `undefined`/empty, `app/login.tsx` is `login`, `app/farm.tsx` is `farm`, `app/dev/*` is `dev`.
 *
 *  - restoring: stay (the gate shows a loader overlay until the stored session has been read).
 *  - dev routes stay reachable without a session, in development builds only.
 *  - signed out: everything goes to `/login`.
 *  - signed in without a farm (`needsFarm`): everything goes to `/farm`.
 *  - signed in with a farm: `/login` goes home; `/farm` stays reachable (switching farm from home).
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';
export type AuthRedirect = '/login' | '/farm' | '/';

export interface AuthRouteInput {
  status: AuthStatus;
  needsFarm: boolean;
  firstSegment: string | undefined;
  isDev: boolean;
}

export function authRedirect({ status, needsFarm, firstSegment, isDev }: AuthRouteInput): AuthRedirect | null {
  if (status === 'restoring') return null;
  if (isDev && firstSegment === 'dev') return null;

  if (status === 'signedOut') return firstSegment === 'login' ? null : '/login';

  if (needsFarm) return firstSegment === 'farm' ? null : '/farm';
  return firstSegment === 'login' ? '/' : null;
}

/** True while the gate must hide the routed screen (loading the session, or a redirect is about to happen). */
export function gateCoversScreen(input: AuthRouteInput): boolean {
  return input.status === 'restoring' || authRedirect(input) !== null;
}
