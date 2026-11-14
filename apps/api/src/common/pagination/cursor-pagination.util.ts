import { CursorPaginationQueryDto } from './cursor-pagination.dto';
import { CursorPage } from './cursor-page.type';
import { decodeCursor, encodeCursor } from './cursor.codec';

/**
 * Keyset (cursor) pagination helpers for Prisma `findMany`.
 *
 * Why keyset over offset: stable pages under concurrent inserts/deletes and no
 * `OFFSET` table scan — the right default for large, append-heavy tables (herd
 * records, milk logs, activity feed, etc.).
 *
 * The cursor anchors on the unique `id` column, so any sort field works as long
 * as `id` is the final tiebreaker in `orderBy` (required by Prisma's `cursor`).
 *
 * @example  Service method
 * import { getCursorArgs, toCursorPage } from 'src/common/pagination';
 *
 * async list(farmId: string, query: ListCattleQueryDto): Promise<CursorPage<Cattle>> {
 *   const rows = await this.prisma.cattle.findMany({
 *     where: { farmId },
 *     // ALWAYS end orderBy with `id` so it matches the cursor anchor:
 *     orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
 *     ...getCursorArgs(query),          // adds take (+1), skip, cursor
 *   });
 *   return toCursorPage(rows, query);   // -> { items, meta }
 * }
 *
 * The controller returns the CursorPage as-is; the ResponseEnvelopeInterceptor
 * emits `{ success: true, data: items, meta: { hasNextPage, endCursor, ... } }`.
 * The client requests the next page with `?cursor=<meta.endCursor>`.
 */

/** Prisma `findMany` fragment produced from a cursor query. Spread into the call. */
export interface CursorFindArgs {
  /** limit + 1 — one extra row is fetched to detect `hasNextPage`. */
  take: number;
  /** Skip the anchor row itself when paginating from a cursor. */
  skip?: number;
  /** Prisma cursor anchored on the unique id. */
  cursor?: { id: string };
}

/**
 * Build the `take` / `skip` / `cursor` fragment for a Prisma `findMany`.
 *
 * Fetches `limit + 1` rows so {@link toCursorPage} can tell whether a next page
 * exists. Provide your own `orderBy` ending in `{ id: sortOrder }`.
 *
 * @throws {BadRequestException} If `query.cursor` is malformed.
 */
export function getCursorArgs(query: CursorPaginationQueryDto): CursorFindArgs {
  const take = query.limit + 1;

  if (!query.cursor) {
    return { take };
  }

  const { id } = decodeCursor(query.cursor);
  return { take, skip: 1, cursor: { id } };
}

/**
 * Turn the rows returned by `findMany` (fetched with {@link getCursorArgs}) into
 * a {@link CursorPage}. Trims the extra look-ahead row and computes cursors.
 *
 * @typeParam T Any row carrying a string `id`.
 */
export function toCursorPage<T extends { id: string }>(
  rows: T[],
  query: CursorPaginationQueryDto,
): CursorPage<T> {
  const hasNextPage = rows.length > query.limit;
  const items = hasNextPage ? rows.slice(0, query.limit) : rows;

  return {
    items,
    meta: {
      count: items.length,
      limit: query.limit,
      hasNextPage,
      hasPreviousPage: Boolean(query.cursor),
      startCursor: items.length ? encodeCursor({ id: items[0].id }) : null,
      endCursor: items.length
        ? encodeCursor({ id: items[items.length - 1].id })
        : null,
    },
  };
}
