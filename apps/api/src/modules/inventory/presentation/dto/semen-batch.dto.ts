import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Register a semen straw batch (optionally placed in a tank). */
export class CreateSemenBatchDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  bullId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breed?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  strawColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  initialVitalityPct?: number;

  @IsInt()
  @Min(0)
  strawQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStrawThreshold?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  fatherId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  motherId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  canister?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cane?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  goblet?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/** Partial update of a semen batch. Straw count is set here (re-stock/correction). */
export class UpdateSemenBatchDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  bullId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breed?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  strawColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  initialVitalityPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  strawQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStrawThreshold?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  canister?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cane?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  goblet?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/** Query for `GET /inventory/semen/batches` — cursor-paginated. */
export class ListSemenBatchQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;

  @IsOptional()
  @Transform(toBoolean)
  includeArchived = false;
}
