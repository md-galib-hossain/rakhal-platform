import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EquipmentType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Create an equipment / other-asset item. Tenant comes from the token. */
export class CreateEquipmentDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  /** Optional Unit catalog id (`Unit.id`) when counted in something other than pieces. */
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsNumber()
  @Min(0)
  currentStock!: number;

  @IsNumber()
  @Min(0)
  costPerUnit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsISO8601()
  purchaseDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
