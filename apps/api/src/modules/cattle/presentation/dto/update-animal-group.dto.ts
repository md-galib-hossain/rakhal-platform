import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from 'src/common/dto';

export class UpdateAnimalGroupDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;
}
