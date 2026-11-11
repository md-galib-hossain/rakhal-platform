/**
 * app.json carries native-config colours as hex (native config cannot read JS). This test keeps that a mirror
 * of the tokens, not a second source of truth (spec 4.4, O10): splash = sidebar light / sidebar dark.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { colorsDark, colorsLight } from '../src/theme/tokens.ts';

const config = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'app.json'), 'utf8')) as {
  expo: { userInterfaceStyle: string; plugins: unknown[] };
};

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

test('app.json userInterfaceStyle is automatic (OS dark mode + Appearance.setColorScheme)', () => {
  assert.equal(config.expo.userInterfaceStyle, 'automatic');
});

test('app.json splash colours equal the sidebar tokens', () => {
  const splash = config.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as
    | [string, { backgroundColor: string; dark: { backgroundColor: string } }]
    | undefined;
  assert.ok(splash, 'expo-splash-screen plugin entry present');
  assert.equal(splash[1].backgroundColor.toLowerCase(), colorsLight.sidebar.toLowerCase());
  assert.equal(splash[1].dark.backgroundColor.toLowerCase(), colorsDark.sidebar.toLowerCase());
});

test('every hex colour in app.json is one of those two token values', () => {
  const allowed = new Set([colorsLight.sidebar.toLowerCase(), colorsDark.sidebar.toLowerCase()]);
  const hits = (readFileSync(resolve(import.meta.dirname, '..', 'app.json'), 'utf8').match(HEX) ?? []).map((h) => h.toLowerCase());
  assert.ok(hits.length > 0);
  assert.deepEqual(hits.filter((h) => !allowed.has(h)), []);
});
