import { IsEnum, IsOptional } from 'class-validator';
import { ProductionStatus, ReproductiveStatus } from '@prisma/client';

/**
 * Dedicated multi-dimension status update (PRD §8.1, RAKHAL-036).
 * `PATCH /cattle/:id/status`. Production status is stored on the cattle row;
 * reproductive status is stored on the linked `ReproductionProfile`. (Health
 * status is derived from Healthcare, so it is not settable here.)
 */
export class UpdateCattleStatusDto {
  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @IsOptional()
  @IsEnum(ReproductiveStatus)
  reproductiveStatus?: ReproductiveStatus;
}
