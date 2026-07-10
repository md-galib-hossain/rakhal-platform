/**
 * Backend response contract — verified live against Repos/rakhal-backend (2026-07-10), NOT the
 * aspirational shape in the cross-repo template docs. Concrete differences from those templates:
 *   - Error envelope is FLAT: `{success:false, message, code, requestId, timestamp}` — no
 *     `error: {code,message,details}` wrapper, no `meta.requestId`.
 *   - Validation errors (400, code `VALIDATION_ERROR`) return a single comma-joined `message`
 *     string, NOT a structured per-field `details[]` array — there is nothing to map onto
 *     individual form fields. `lib/api/errors.ts` treats this as a form-level error only.
 *   - Pagination is cursor-based with opaque base64 cursors: `{count, limit, hasNextPage,
 *     hasPreviousPage, startCursor, endCursor}`.
 * See docs/ARCHITECTURE.md §4 for the full auth-flow writeup this was derived from.
 */

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: CursorMeta | Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  code: string;
  requestId: string;
  timestamp: string;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface CursorMeta {
  count: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface CursorPage<T> {
  items: T[];
  meta: CursorMeta;
}

/** Stable backend error codes observed live: UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, CONFLICT. */
export type ApiErrorCode = string;
