import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  numGoblets?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  storageLocation?: string;
}
