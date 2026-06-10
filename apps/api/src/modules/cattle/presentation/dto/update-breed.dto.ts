import { CreateBreedDto } from './create-breed.dto';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { trimString } from './common.dto';

export class UpdateBreedDto implements Partial<CreateBreedDto> {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  farmId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;
}
