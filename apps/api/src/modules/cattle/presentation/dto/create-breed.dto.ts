import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { trimString } from './common.dto';

export class CreateBreedDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  farmId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;
}
