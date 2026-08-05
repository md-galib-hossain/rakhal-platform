import { IsEnum, IsOptional } from 'class-validator';
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
 */
export class UpdateCattleStatusDto {
  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @IsOptional()
  @IsEnum(ReproductionState)
  reproductiveStatus?: ReproductionState;
}
