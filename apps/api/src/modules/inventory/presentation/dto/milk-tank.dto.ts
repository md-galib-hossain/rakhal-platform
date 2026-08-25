import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MilkTankActivity, MilkTankType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Create a milk storage tank (SELLABLE or WITHHOLDING). Tenant from token. */
export class CreateMilkTankDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(MilkTankType)
  tankType!: MilkTankType;

  @IsNumber()
  @Min(0)
  totalCapacityL!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentVolumeL?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  snfPct?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  smartSensorId?: string;

  @IsOptional()
  @IsNumber()
  targetTempC?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  agitationIntervalMin?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedShedId?: string;
}

/** Partial update of a milk tank. Volume changes go through adjust-volume. */
export class UpdateMilkTankDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(MilkTankType)
  tankType?: MilkTankType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCapacityL?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  snfPct?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  smartSensorId?: string;

  @IsOptional()
  @IsNumber()
  targetTempC?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  agitationIntervalMin?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedShedId?: string;
}

/**
 * Adjust a tank's volume and write an audit entry.
 * `delta` is signed (+collection / -sale or -dispatch).
 */
export class AdjustMilkTankVolumeDto {
  @IsNumber()
  delta!: number;

  @IsEnum(MilkTankActivity)
  activityType!: MilkTankActivity;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RAKHAL-342 — the `SaleLine` (type MILK) whose atomic sale caused this
   * SALE-activity decrement, so `MilkTankAuditLog` can be traced back to it.
   * Not part of any HTTP route today (no controller passes it) — only
   * `SellMilkUseCase` sets it via a direct in-process call. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  saleLineId?: string;
}

/** Query for `GET /inventory/milk-tanks` list. */
export class ListMilkTankQueryDto {
  @IsOptional()
  @IsEnum(MilkTankType)
  tankType?: MilkTankType;

  @IsOptional()
  @Transform(toBoolean)
  includeArchived = false;
}

/** Query for `GET /inventory/milk-tanks/audit-log` — cursor-paginated. */
export class ListMilkTankAuditQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;
}
