import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_API_BASE_URL, resolveApiBaseUrl } from '../src/config/api-config.ts';

test('uses the configured URL, trimmed and without trailing slashes', () => {
  assert.equal(resolveApiBaseUrl(' https://api.example.com/api/v1/ ', false), 'https://api.example.com/api/v1');
});

test('falls back to the Android emulator loopback only in development', () => {
  assert.equal(resolveApiBaseUrl(undefined, true), DEV_API_BASE_URL);
  assert.equal(resolveApiBaseUrl('', true), DEV_API_BASE_URL);
});

test('a release build without a configured URL throws instead of using a dev address', () => {
  assert.throws(() => resolveApiBaseUrl(undefined, false), /EXPO_PUBLIC_API_BASE_URL/);
  assert.throws(() => resolveApiBaseUrl('   ', false), /EXPO_PUBLIC_API_BASE_URL/);
});
