import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, NetworkError } from '@rakhal/api-client';
import { authErrorKind, authErrorMessageKey } from '../src/auth/auth-errors.ts';

const api = (status: number) => new ApiError(status, { success: false, message: 'x' });

test('401 and 400 are bad credentials, 429 is rate limiting, 5xx is a server problem', () => {
  assert.equal(authErrorKind(api(401)), 'invalid');
  assert.equal(authErrorKind(api(400)), 'invalid');
  assert.equal(authErrorKind(api(429)), 'rateLimited');
  assert.equal(authErrorKind(api(500)), 'server');
  assert.equal(authErrorKind(api(503)), 'server');
});

test('a missing response is a network error, never "wrong password"', () => {
  assert.equal(authErrorKind(new NetworkError('offline')), 'network');
  assert.equal(authErrorMessageKey(new NetworkError('offline')), 'auth.error.network');
});

test('anything else falls back to the generic message', () => {
  assert.equal(authErrorKind(new Error('boom')), 'unknown');
  assert.equal(authErrorKind(api(418)), 'unknown');
  assert.equal(authErrorMessageKey('weird'), 'common.error.generic');
});

test('keys exist for every kind', () => {
  assert.equal(authErrorMessageKey(api(401)), 'auth.error.invalid');
  assert.equal(authErrorMessageKey(api(429)), 'auth.error.rateLimited');
  assert.equal(authErrorMessageKey(api(500)), 'auth.error.server');
});
