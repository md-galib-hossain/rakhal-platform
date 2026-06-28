import { FixedAssetCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export class CreateFixedAssetDto {
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsEnum(FixedAssetCategory)
  category?: FixedAssetCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  purchaseDate!: string;

  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usefulLifeYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salvageValue?: number;
}
