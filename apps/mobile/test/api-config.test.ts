import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_API_FALLBACK_URL, resolveApiBaseUrl } from '../src/config/api-config.ts';

test('uses the configured URL, trimmed and without trailing slashes', () => {
  assert.equal(
    resolveApiBaseUrl({ env: ' https://api.example.com/api/v1/ ', isDev: false }),
    'https://api.example.com/api/v1',
  );
  // An explicit value wins over the Metro host, in dev too.
  assert.equal(
    resolveApiBaseUrl({ env: 'http://10.1.1.1:9/api/v1', isDev: true, hostUri: '192.168.0.100:8081' }),
    'http://10.1.1.1:9/api/v1',
  );
});

test('development without a URL uses the Metro host and the default or configured API port', () => {
  assert.equal(
    resolveApiBaseUrl({ env: undefined, isDev: true, hostUri: '192.168.0.100:8081' }),
    'http://192.168.0.100:5000/api/v1',
  );
  assert.equal(
    resolveApiBaseUrl({ env: '', isDev: true, hostUri: '192.168.0.100:8081', port: '5005' }),
    'http://192.168.0.100:5005/api/v1',
  );
  assert.equal(
    resolveApiBaseUrl({ env: undefined, isDev: true, hostUri: 'exp://192.168.0.100:8081/x', port: ' 5005 ' }),
    'http://192.168.0.100:5005/api/v1',
  );
});

test('development with no host at all falls back to the emulator loopback', () => {
  assert.equal(resolveApiBaseUrl({ env: undefined, isDev: true }), DEV_API_FALLBACK_URL);
  assert.equal(resolveApiBaseUrl({ env: undefined, isDev: true, hostUri: '' }), DEV_API_FALLBACK_URL);
});

test('a release build without a configured URL throws, even if a host is known', () => {
  assert.throws(() => resolveApiBaseUrl({ env: undefined, isDev: false }), /EXPO_PUBLIC_API_BASE_URL/);
  assert.throws(
    () => resolveApiBaseUrl({ env: '   ', isDev: false, hostUri: '192.168.0.100:8081' }),
    /EXPO_PUBLIC_API_BASE_URL/,
  );
});
