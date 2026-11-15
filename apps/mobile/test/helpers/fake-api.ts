/** Test-only fakes for the offline core: a scripted API, manual timers, deterministic ids. */
import { ApiError, NetworkError } from '@rakhal/api-client';
import type { Timers } from '../../src/offline/sync-engine.ts';

export interface Call {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
}

/** Return the `data` (or `page(...)`) for a call, or throw an `apiError` / `networkError`. */
export type Responder = (call: Call) => unknown;

interface Page {
  __page: true;
  data: unknown;
  meta: Record<string, unknown>;
}

export const page = (data: unknown[], nextCursor?: string): Page => ({
  __page: true,
  data,
  meta: nextCursor ? { hasNextPage: true, endCursor: nextCursor } : { hasNextPage: false },
});

export const apiError = (status: number, message = 'nope', code?: string) =>
  new ApiError(status, { success: false, message, ...(code ? { code } : {}) });
export const networkError = () => new NetworkError();

function wrap(value: unknown): { data: never; meta?: Record<string, unknown> } {
  if (value !== null && typeof value === 'object' && '__page' in value) {
    const p = value as Page;
    return { data: p.data as never, meta: p.meta };
  }
  return { data: value as never };
}

export function createFakeApi(responder: Responder) {
  const calls: Call[] = [];
  const api = {
    async request<T>(
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: string,
      options: { body?: unknown; headers?: Record<string, string> } = {},
    ): Promise<{ data: T }> {
      const call: Call = { method, path, body: options.body, headers: options.headers };
      calls.push(call);
      return wrap(responder(call)) as { data: T };
    },
    async get<T>(
      path: string,
      options: { query?: Record<string, string | number | boolean | null | undefined> } = {},
    ): Promise<{ data: T; meta?: Record<string, unknown> }> {
      const call: Call = { method: 'GET', path, query: options.query };
      calls.push(call);
      return wrap(responder(call)) as { data: T; meta?: Record<string, unknown> };
    },
  };
  return {
    api,
    calls,
    posts: () => calls.filter((c) => c.method !== 'GET'),
    gets: () => calls.filter((c) => c.method === 'GET'),
  };
}

export function createManualTimers() {
  interface Handle {
    fn: () => void;
    ms: number;
    cancelled: boolean;
    fired: boolean;
  }
  const handles: Handle[] = [];
  const timers: Timers = {
    set(fn, ms) {
      const handle: Handle = { fn, ms, cancelled: false, fired: false };
      handles.push(handle);
      return handle;
    },
    clear(h) {
      (h as Handle).cancelled = true;
    },
  };
  return {
    timers,
    /** Timers that are scheduled and neither cancelled nor fired. */
    active: () => handles.filter((h) => !h.cancelled && !h.fired),
    /** Fire the oldest active timer. */
    fire(): void {
      const next = handles.find((h) => !h.cancelled && !h.fired);
      if (!next) throw new Error('No active timer to fire');
      next.fired = true;
      next.fn();
    },
  };
}

export function fixedIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
