import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canAny } from '../src/permissions/can.ts';
import { DEFAULT_TAB, TABS, resolveStartTab, tabByHref, visibleTabs } from '../src/navigation/nav-config.ts';
import { ACCESS_KEY, clearAccess, loadAccess, parseAccess, saveAccess } from '../src/auth/access-store.ts';
import { messages } from '../src/i18n/messages.ts';

const keys = (granted: string[] | null) => visibleTabs(granted).map((t) => t.key);

test('can: wildcard, resource wildcard, exact match, and nothing else', () => {
  assert.equal(can(['*'], 'cattle.read'), true);
  assert.equal(can(['cattle.*'], 'cattle.read'), true);
  assert.equal(can(['cattle.*'], 'milk.read'), false);
  assert.equal(can(['cattle.read'], 'cattle.read'), true);
  assert.equal(can(['cattle.read'], 'cattle.update'), false);
  assert.equal(can([], 'cattle.read'), false);
  assert.equal(can(null, 'cattle.read'), false);
  assert.equal(can(undefined, 'cattle.read'), false);
});

test('can: no requirement is always allowed, even with unknown permissions', () => {
  assert.equal(can(null, null), true);
  assert.equal(can([], undefined), true);
});

test('canAny: any one of the permissions is enough; an empty list is no requirement', () => {
  assert.equal(canAny(['milk.read'], ['cattle.read', 'milk.read']), true);
  assert.equal(canAny(['task.read'], ['cattle.read', 'milk.read']), false);
  assert.equal(canAny([], []), true);
});

test('owner (*) sees every tab, in PRD order', () => {
  assert.deepEqual(keys(['*']), ['home', 'cattle', 'milk', 'tasks', 'more']);
});

test('a worker with only milk and task permissions sees no Cattle tab', () => {
  assert.deepEqual(keys(['milk.read', 'milk.log', 'task.read', 'task.complete']), ['home', 'milk', 'tasks', 'more']);
});

test('unknown permissions (not loaded, no cache) show only the always-on tabs, never a guess', () => {
  assert.deepEqual(keys(null), ['home', 'more']);
  assert.deepEqual(keys([]), ['home', 'more']);
});

test('resource wildcards (manager) grant the tabs of that resource', () => {
  assert.deepEqual(keys(['cattle.*', 'milk.*']), ['home', 'cattle', 'milk', 'more']);
});

test('every tab has a unique route, href and existing label in both languages', () => {
  assert.equal(new Set(TABS.map((t) => t.routeName)).size, TABS.length);
  assert.equal(new Set(TABS.map((t) => t.href)).size, TABS.length);
  for (const tab of TABS) {
    assert.ok(messages.en[tab.labelKey], `en label for ${tab.key}`);
    assert.ok(messages.bn[tab.labelKey], `bn label for ${tab.key}`);
  }
  assert.equal(DEFAULT_TAB.key, 'home');
  assert.equal(tabByHref('/milk')?.key, 'milk');
  assert.equal(tabByHref('/nope'), undefined);
});

test('start tab: restores the stored tab when permitted, else Home', () => {
  assert.equal(resolveStartTab('/milk', ['*']).key, 'milk');
  assert.equal(resolveStartTab('/cattle', ['milk.read']).key, 'home');
  assert.equal(resolveStartTab('/gone', ['*']).key, 'home');
  assert.equal(resolveStartTab(null, ['*']).key, 'home');
});

test('access snapshot: parse rejects bad shapes and keeps good ones', () => {
  assert.deepEqual(parseAccess('{"farmId":"f1","farmName":"Green","permissions":["*"]}'), {
    farmId: 'f1',
    farmName: 'Green',
    permissions: ['*'],
  });
  assert.equal(parseAccess('{"farmId":"f1","permissions":["*"]}')?.farmName, null);
  for (const bad of [null, '', 'nope', '[]', '{"farmId":"","permissions":[]}', '{"farmId":"f","permissions":[1]}', '{"permissions":[]}']) {
    assert.equal(parseAccess(bad), null);
  }
});

test('access snapshot: only trusted for the farm it was saved for; clear invalidates it', async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => Promise.resolve(data.get(k) ?? null),
    setItem: (k: string, v: string) => {
      data.set(k, v);
      return Promise.resolve();
    },
  };
  await saveAccess(storage, { farmId: 'f1', farmName: 'Green', permissions: ['milk.read'] });
  assert.equal((await loadAccess(storage, 'f1'))?.farmName, 'Green');
  assert.equal(await loadAccess(storage, 'f2'), null);
  await clearAccess(storage);
  assert.equal(await loadAccess(storage, 'f1'), null);
  assert.equal(data.get(ACCESS_KEY), '');
});
