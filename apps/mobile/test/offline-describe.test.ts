import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conflictCount, describePill, describeRow, describeStatus } from '../src/offline/describe-row.ts';
import { MESSAGE_KEYS, messages } from '../src/i18n/messages.ts';
import { interpolate, placeholdersOf } from '../src/i18n/translate.ts';

const snap = (over: Partial<Parameters<typeof describePill>[0]> = {}) => ({
  state: 'idle' as const,
  waiting: 0,
  failed: 0,
  conflict: 0,
  ...over,
});

test('the pill says "Synced" when nothing is waiting, and "3 pending" when something is', () => {
  assert.deepEqual(describePill(snap()), { key: 'sync.pill.synced', tone: 'success' });
  assert.deepEqual(describePill(snap({ waiting: 3 })), { key: 'sync.pill.pending', params: { count: 3 }, tone: 'info' });
  assert.equal(describePill(snap({ state: 'syncing' })).key, 'sync.pill.syncing');
});

test('offline always shows, with the number of entries waiting when there are any', () => {
  assert.deepEqual(describePill(snap({ state: 'offline' })), { key: 'sync.pill.offline', tone: 'neutral' });
  assert.deepEqual(describePill(snap({ state: 'offline', waiting: 2 })), {
    key: 'sync.pill.offlinePending',
    params: { count: 2 },
    tone: 'warning',
  });
  assert.equal(describePill(snap({ state: 'offline', failed: 1 })).key, 'sync.pill.offline', 'offline beats failed: nothing can be retried yet');
});

test('entries that need the user outrank progress: review, then failed', () => {
  assert.equal(describePill(snap({ conflict: 1, failed: 2, waiting: 3 })).key, 'sync.pill.review');
  assert.equal(describePill(snap({ failed: 2, waiting: 3 })).key, 'sync.pill.failed');
  assert.equal(describePill(snap({ failed: 2, waiting: 3 })).tone, 'destructive');
  assert.equal(describePill(snap({ state: 'syncing', failed: 1 })).key, 'sync.pill.failed');
});

test('a dead session is shown as "sign in to sync", whatever else is queued', () => {
  assert.equal(describePill(snap({ state: 'paused', waiting: 5, failed: 1 })).key, 'sync.pill.paused');
});

test('every row status has a word and a tone (never colour alone)', () => {
  for (const status of ['pending', 'sending', 'failed', 'conflict', 'done'] as const) {
    const d = describeStatus(status);
    assert.ok(d.key.startsWith('sync.status.'));
    assert.ok(['success', 'warning', 'destructive', 'info', 'neutral'].includes(d.tone));
  }
});

test('queued writes get a plain title with the numbers the screen needs', () => {
  assert.deepEqual(describeRow({ endpoint: 'milk.saveLog', body: { date: '2026-11-15', entries: [{}, {}, {}] } }), {
    key: 'sync.item.milkSave',
    count: 3,
    date: '2026-11-15',
  });
  assert.deepEqual(describeRow({ endpoint: 'milk.submit', body: { date: '2026-11-15', session: 'MORNING' } }), {
    key: 'sync.item.milkSubmit',
    date: '2026-11-15',
  });
  assert.equal(describeRow({ endpoint: 'health.createCase', body: {} }).key, 'sync.item.sickness');
  assert.equal(describeRow({ endpoint: 'task.complete', body: null }).key, 'sync.item.taskComplete');
  assert.equal(describeRow({ endpoint: 'something.else', body: 'x' }).key, 'sync.item.generic');
  assert.equal(describeRow({ endpoint: 'milk.saveLog', body: null }).key, 'sync.item.milkSave', 'a damaged body never throws');
});

test('conflictCount counts the entries the server kept its own version of', () => {
  assert.equal(conflictCount({ conflict: [{}, {}] }), 2);
  assert.equal(conflictCount({ conflict: null }), 0);
});

test('every sync message exists in both languages with the same placeholders', () => {
  const keys = MESSAGE_KEYS.filter((k) => k.startsWith('sync.'));
  assert.ok(keys.length >= 30);
  for (const key of keys) {
    const en = messages.en[key];
    const bn = messages.bn[key];
    assert.ok(en.length > 0 && bn.length > 0, key);
    assert.deepEqual(placeholdersOf(bn).sort(), placeholdersOf(en).sort(), key);
  }
  assert.equal(interpolate(messages.en['sync.pill.offlinePending'], { count: 4 }), 'Offline, 4 pending');
});
