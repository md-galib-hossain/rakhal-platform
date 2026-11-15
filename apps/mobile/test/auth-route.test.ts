import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authRedirect, gateCoversScreen, type AuthRouteInput } from '../src/auth/auth-route.ts';

const base: AuthRouteInput = { status: 'signedOut', needsFarm: false, firstSegment: undefined, isDev: false };
const at = (patch: Partial<AuthRouteInput>) => ({ ...base, ...patch });

test('restoring never redirects (the gate shows a loader instead)', () => {
  assert.equal(authRedirect(at({ status: 'restoring' })), null);
  assert.equal(gateCoversScreen(at({ status: 'restoring' })), true);
});

test('signed out: every screen except login goes to /login', () => {
  assert.equal(authRedirect(at({ firstSegment: undefined })), '/login');
  assert.equal(authRedirect(at({ firstSegment: 'farm' })), '/login');
  assert.equal(authRedirect(at({ firstSegment: 'login' })), null);
  assert.equal(gateCoversScreen(at({ firstSegment: 'login' })), false);
});

test('dev routes are reachable signed out in development only', () => {
  assert.equal(authRedirect(at({ firstSegment: 'dev', isDev: true })), null);
  assert.equal(authRedirect(at({ firstSegment: 'dev', isDev: false })), '/login');
});

test('signed in without a farm is held on /farm', () => {
  const s = at({ status: 'signedIn', needsFarm: true });
  assert.equal(authRedirect({ ...s, firstSegment: undefined }), '/farm');
  assert.equal(authRedirect({ ...s, firstSegment: 'login' }), '/farm');
  assert.equal(authRedirect({ ...s, firstSegment: 'farm' }), null);
});

test('signed in with a farm: login goes home, home and farm stay', () => {
  const s = at({ status: 'signedIn', needsFarm: false });
  assert.equal(authRedirect({ ...s, firstSegment: 'login' }), '/');
  assert.equal(authRedirect({ ...s, firstSegment: undefined }), null);
  assert.equal(authRedirect({ ...s, firstSegment: 'farm' }), null);
  assert.equal(gateCoversScreen({ ...s, firstSegment: undefined }), false);
});
