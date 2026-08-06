import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ProductionStatus, ReproductionState } from '@prisma/client';

/**
 * Dedicated multi-dimension status update (PRD §8.1, RAKHAL-036).
 * `PATCH /cattle/:id/status`. Production status is stored on the cattle row;
 * reproduction state is stored on the linked `ReproductionProfile`. (Health
 * status is derived from Healthcare, so it is not settable here.)
 *
 * Setting `productionStatus` to `MILKING` requires an active `Lactation`
 * record to already exist (RAKHAL-269/271) — see `CattleService.updateStatus`.
 * `lactationStartDate` was removed (v2 correction): lactation start now lives
 * solely on `Lactation.startDate`, never on `Cattle`.
 *
 * RAKHAL-291: `lactationStartDate` is back, but only as an *input* here (not
 * a `Cattle` column) — when no active `Lactation` exists yet, supplying it
 * lets `updateStatus()` create one with `startReason: PURCHASE_IMPORT` (e.g.
 * a purchased already-milking cow with no calving history in this system).
 */
export class UpdateCattleStatusDto {
  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @IsOptional()
  @IsEnum(ReproductionState)
  reproductiveStatus?: ReproductionState;

  @IsOptional()
  @IsDateString()
  lactationStartDate?: string;

  /** A heifer (no calving history) can never be set to Milking. On a
   * profile-less purchase-intake cow, supplying this alongside
   * `lactationStartDate` records her real prior calving count on the same
   * `ReproductionProfile` create this MILKING flow already does — see
   * `CattleService.updateStatus`. Ignored (and unnecessary) once a
   * `ReproductionProfile` already exists — its own `totalCalvings` wins. */
  @IsOptional()
  @IsInt()
  @Min(1)
  priorCalvings?: number;
}
