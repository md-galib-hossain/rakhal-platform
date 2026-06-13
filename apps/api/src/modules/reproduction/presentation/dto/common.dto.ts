import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ReproductionListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  farmId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class BooleanSymptomsDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  standingHeat?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mucusDischarge?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mountingBehavior?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  restlessness?: boolean;
}
