// WP4: mobile resolves the source-exported @rakhal/api-client and can type against the generated customer-API schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type Schema } from '@rakhal/api-client';

test('@rakhal/api-client resolves through the workspace symlink under node --test', () => {
  const entry: Schema<'MilkLogEntryDto'> = { cattleId: 'c1', yieldL: 9.5 };
  assert.equal(entry.yieldL, 9.5);
  assert.equal(new ApiError(401, null).isAuthError, true);
});
