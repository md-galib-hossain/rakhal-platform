/**
 * Cursor-based pagination toolkit (framework-agnostic, Prisma-friendly).
 *
 * Import from the barrel:
 *   import {
 *     CursorPaginationQueryDto,
 *     getCursorArgs,
 *     toCursorPage,
 *     CursorPage,
 *   } from 'src/common/pagination';
 *
 * See cursor-pagination.util.ts for the full usage example.
 */
export * from './cursor.codec';
export * from './cursor-pagination.dto';
export * from './cursor-page.type';
export * from './cursor-pagination.util';
