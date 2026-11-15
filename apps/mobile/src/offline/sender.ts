import { ApiError, NetworkError } from '@rakhal/api-client';
import type { OutboxRow } from './outbox.ts';

export type RetryReason = 'network' | 'server' | 'rate-limit' | 'in-progress';

/** What happened to one queued write (ADR-006 section 5, step 4). */
export type SendOutcome =
  | { kind: 'done'; result: unknown }
  /** Saved, except for entries the server kept a newer version of. Needs the user. */
  | { kind: 'conflict'; result: unknown; conflict: unknown }
  /** Try again later with the same key. */
  | { kind: 'retry'; reason: RetryReason; error: string }
  /** The server rejected it for good (validation, permission, key misuse). Shown to the user, never dropped. */
  | { kind: 'failed'; error: string }
  /** The session is gone; keep the row and wait for the next sign-in. */
  | { kind: 'paused'; error: string };

/** The part of `ApiClient` the sender needs, so tests can pass a fake. */
export interface ApiRequester {
  request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<{ data: T }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Endpoint-specific reading of a 2xx answer. Everything not listed here is simply done. */
function interpretSuccess(endpoint: string, data: unknown): SendOutcome {
  if (endpoint === 'milk.saveLog') {
    const conflicts = asRecord(data)?.conflicts;
    if (Array.isArray(conflicts) && conflicts.length > 0) return { kind: 'conflict', result: data, conflict: conflicts };
  }
  return { kind: 'done', result: data };
}

export function classifyError(error: unknown): SendOutcome {
  if (error instanceof NetworkError) return { kind: 'retry', reason: 'network', error: 'network' };
  if (error instanceof ApiError) {
    const { status } = error;
    if (status === 401) return { kind: 'paused', error: 'Session ended' };
    if (status === 409 && error.code === 'IDEMPOTENCY_IN_PROGRESS') {
      return { kind: 'retry', reason: 'in-progress', error: error.message };
    }
    if (status === 429) return { kind: 'retry', reason: 'rate-limit', error: error.message };
    if (status === 408 || status === 425 || status >= 500) return { kind: 'retry', reason: 'server', error: error.message };
    return { kind: 'failed', error: error.message };
  }
  // Anything unexpected: keep the write and try again rather than lose it.
  return { kind: 'retry', reason: 'server', error: error instanceof Error ? error.message : 'Unknown error' };
}

/** Send one outbox row with its stable `Idempotency-Key` and classify the result. Never throws. */
export async function sendRow(api: ApiRequester, row: OutboxRow): Promise<SendOutcome> {
  try {
    const res = await api.request<unknown>(row.method, row.path, {
      body: row.body ?? undefined,
      headers: { 'Idempotency-Key': row.localId },
    });
    return interpretSuccess(row.endpoint, res.data);
  } catch (error) {
    return classifyError(error);
  }
}
