/**
 * Reusable `class-transformer` `@Transform` callbacks for request DTOs.
 *
 * These are the canonical home for input normalizers — prefer them over
 * re-declaring per-module copies.
 *
 *   import { trimString, toBoolean } from 'src/common/dto';
 *
 * @example
 * class CreateShedDto {
 *   @Transform(trimString) @IsString() @IsNotEmpty() name!: string;
 *   @Transform(toBoolean)  @IsBoolean() active = true;
 * }
 */

/** Trim surrounding whitespace from string inputs; pass non-strings through. */
export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Coerce common truthy/falsy query-string values to a real boolean.
 * Accepts `true`/`false` (boolean or string); leaves anything else untouched
 * so `@IsBoolean()` can reject it.
 */
export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

/** Coerce a query-string number; leaves non-numeric input for the validator to reject. */
export const toNumber = ({ value }: { value: unknown }): unknown => {
  if (value === '' || value === null || value === undefined) return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};
