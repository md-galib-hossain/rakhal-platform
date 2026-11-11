// V3: mobile node tests can import the source-exported workspace package under Node type-stripping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '@rakhal/domain';

test('@rakhal/domain resolves through the workspace symlink under node --test', () => {
  assert.equal(formatMoney(1250000), '৳12,50,000');
});
