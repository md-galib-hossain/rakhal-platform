import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { toBoolean, trimString } from './common.dto';

/**
 * Query for `GET /reproduction/lactations/compare` (RAKHAL-287) — current
 * vs. previous lactation for one cow, DIM-aligned (not calendar-date
 * aligned). `cattleId` is required (this route has no `:id` route param of
 * its own — it resolves the cow's current active lactation itself).
 * `byLactationNumber` (default `true`) picks the previous lactation as
 * `lactationNumber - 1` for this cow; when `false`, picks the cow's most
 * recently *ended* lactation instead (usually the same lactation, but can
 * differ for an estimated/purchased-lactating intake whose `lactationNumber`
 * was farmer-supplied rather than derived from real calving history —
 * RAKHAL-281).
 */
export class CompareLactationQueryDto {
  @IsString()
  @Transform(trimString)
  cattleId!: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  byLactationNumber?: boolean;
}
