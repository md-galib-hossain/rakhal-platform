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
import { trimString } from 'src/common/dto';

/** Create an LN2 semen storage tank. Tenant comes from the token. */
export class CreateSemenTankDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  modelManufacturer?: string;

  @IsInt()
  @Min(1)
  strawCapacity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numCanisters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numCanes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numGoblets?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  storageLocation?: string;

  /** Must be below 0 °C (INV-07) — validated in the service. */
  @IsOptional()
  @IsNumber()
  currentTempC?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ln2LevelPct?: number;
}

/** Partial update of a semen tank. */
export class UpdateSemenTankDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  modelManufacturer?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  strawCapacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numCanisters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numCanes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numGoblets?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsNumber()
  currentTempC?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ln2LevelPct?: number;
}
