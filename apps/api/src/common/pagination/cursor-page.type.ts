/**
 * Metadata describing a single page of a cursor-paginated result.
 *
 * Returned under `meta` so the global ResponseEnvelopeInterceptor lifts it into
 * the API contract shape: `{ success, data: items, meta }`.
 */
export interface CursorPageMeta {
  /** Number of items actually returned on this page. */
  count: number;
  /** The page size that was requested. */
  limit: number;
  /** True when another page exists after this one (fetch with `endCursor`). */
  hasNextPage: boolean;
  /** True when this page was requested with a cursor (i.e. not the first page). */
  hasPreviousPage: boolean;
  /** Cursor pointing at the first item on this page (null when empty). */
  startCursor: string | null;
  /** Cursor to pass as `cursor` to fetch the next page (null when empty). */
  endCursor: string | null;
}

/**
 * A page of results plus its cursor metadata.
 *
 * Service methods return this directly; controllers return it as-is and the
 * envelope interceptor turns it into `{ success: true, data: items, meta }`.
 */
export interface CursorPage<T> {
  items: T[];
  meta: CursorPageMeta;
}
