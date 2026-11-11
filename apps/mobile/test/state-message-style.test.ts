import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EMPTY_GLYPH,
  ERROR_KINDS,
  STATE_MESSAGE_METRICS,
  discColors,
  errorActionPlan,
  errorCopy,
} from '../src/components/feedback/state-message-style.ts';
import { messages } from '../src/i18n/messages.ts';
import { contrastPairs, type AnyColorName } from '../src/theme/tokens.ts';

const isListed = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.some((p) => p.fg === fg && p.bg === bg);

test('metrics match the spec: 24 / 32 padding, 12 gap, 48 disc', () => {
  assert.deepEqual({ ...STATE_MESSAGE_METRICS }, { paddingHorizontal: 24, paddingVertical: 32, gap: 12, disc: 48 });
});

test('every error kind maps to keys that exist in en and bn', () => {
  assert.equal(ERROR_KINDS.length, 4);
  for (const kind of ERROR_KINDS) {
    const c = errorCopy(kind);
    for (const key of [c.titleKey, c.messageKey]) {
      assert.ok(messages.en[key], `en ${key}`);
      assert.ok(messages.bn[key], `bn ${key}`);
    }
  }
});

test('kinds pick their own copy (distinct titles, no catch-all)', () => {
  assert.equal(errorCopy('network').titleKey, 'state.error.network.title');
  assert.equal(errorCopy('server').titleKey, 'state.error.server.title');
  assert.equal(errorCopy('session').titleKey, 'state.error.session.title');
  assert.equal(errorCopy('generic').titleKey, 'state.error.generic.title');
  assert.equal(errorCopy().titleKey, 'state.error.generic.title');
  assert.equal(new Set(ERROR_KINDS.map((k) => errorCopy(k).titleKey)).size, 4);
});

test('disc colours are listed pairs: destructiveText/destructiveTint, secondaryForeground/secondary', () => {
  assert.deepEqual({ ...discColors('error') }, { fill: 'destructiveTint', glyph: 'destructiveText' });
  assert.deepEqual({ ...discColors('empty') }, { fill: 'secondary', glyph: 'secondaryForeground' });
  for (const tone of ['error', 'empty'] as const) {
    const d = discColors(tone);
    assert.ok(isListed(d.glyph, d.fill), `${d.glyph} on ${d.fill}`);
  }
});

test('title and message colours on the screen background are listed', () => {
  assert.ok(isListed('mutedForeground', 'background'));
  assert.ok(isListed('foreground', 'card'));
});

test('empty default glyph is the info glyph', () => {
  assert.equal(DEFAULT_EMPTY_GLYPH, 'info');
});

test('action replaces retry; retry needs onRetry; retrying only matters for retry', () => {
  assert.deepEqual(errorActionPlan({ hasAction: true, hasRetry: true, retrying: true }), { kind: 'action' });
  assert.deepEqual(errorActionPlan({ hasAction: true, hasRetry: false }), { kind: 'action' });
  assert.deepEqual(errorActionPlan({ hasAction: false, hasRetry: true }), { kind: 'retry', loading: false });
  assert.deepEqual(errorActionPlan({ hasAction: false, hasRetry: true, retrying: true }), { kind: 'retry', loading: true });
  assert.deepEqual(errorActionPlan({ hasAction: false, hasRetry: false, retrying: true }), { kind: 'none' });
});
