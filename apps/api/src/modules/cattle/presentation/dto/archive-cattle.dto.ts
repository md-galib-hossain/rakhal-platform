import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { trimString } from './common.dto';

/** Archive reasons for `DELETE /cattle/:id` (PRD §8.5 / CAT-08/09/10). */
export const ARCHIVE_REASONS = [
  'sold',
  'deceased',
  'culled',
  'archived',
] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

/**
 * Soft-archive a cattle record (RAKHAL-036, +`culled` in RAKHAL-269). `sold` →
 * `HerdStatus.SOLD`, `deceased` → `DEAD`, `culled` → `CULLED` (CAT-09 keeps
 * these distinct); all exclude the animal from active herd KPIs (CAT-08) via
 * `isActive: false`. `productionStatus` can no longer hold lifecycle states
 * (RAKHAL-269) so every archive path also nulls it out. Body is optional — no
 * reason defaults to a plain archive.
 */
export class ArchiveCattleDto {
  @IsOptional()
  @Transform(trimString)
  @IsIn(ARCHIVE_REASONS)
  reason?: ArchiveReason;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
