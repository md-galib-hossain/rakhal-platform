/**
 * Shared request-DTO building blocks (transformers + common DTOs).
 *
 *   import { trimString, toBoolean, DateRangeQueryDto, IdParamDto } from 'src/common/dto';
 *
 * For pagination use the cursor toolkit in `src/common/pagination`.
 */
export * from './transform.helpers';
export * from './id-param.dto';
export * from './date-range-query.dto';
