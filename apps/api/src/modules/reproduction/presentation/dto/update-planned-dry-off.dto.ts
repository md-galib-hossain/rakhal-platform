import { IsDateString, IsOptional } from 'class-validator';

/**
 * `PATCH /reproduction/lactations/:id/planned-dry-off` (RAKHAL-285).
 * Farmer-writable target dry-off date, independent of the system-computed
 * `recommendedDryOffAt` — never overwritten by the pregnancy-driven
 * recompute. Omitting `plannedDryOffAt` (or passing `null`) clears it back
 * to unset.
 */
export class UpdatePlannedDryOffDto {
  @IsOptional()
  @IsDateString()
  plannedDryOffAt?: string | null;
}
