import { BadRequestException } from '@nestjs/common';

/**
 * Opaque cursor codec for cursor-based pagination.
 *
 * A cursor is just a small JSON payload (typically `{ id }`, optionally a
 * composite key like `{ id, createdAt }`) encoded as a URL-safe base64 string so
 * clients treat it as an opaque token and never parse or construct it themselves.
 *
 * @example
 * const cursor = encodeCursor({ id: 'ckv...' });   // -> "eyJpZCI6ImNrdi4uLiJ9"
 * const { id } = decodeCursor<{ id: string }>(cursor);
 */

/** Default shape of a cursor payload. Extend it for composite cursors. */
export interface CursorPayload {
  id: string;
  [key: string]: unknown;
}

/**
 * Encode a cursor payload into an opaque, URL-safe token.
 *
 * @param payload Any JSON-serializable object (keep it tiny — id + sort key).
 * @returns A base64url string safe to place in a query string.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decode an opaque cursor token back into its payload.
 *
 * @throws {BadRequestException} If the cursor is malformed or not valid JSON.
 * @typeParam T Expected payload shape (defaults to {@link CursorPayload}).
 */
export function decodeCursor<T extends CursorPayload = CursorPayload>(
  cursor: string,
): T {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as T;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.id !== 'string'
    ) {
      throw new Error('Cursor payload missing id');
    }

    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
