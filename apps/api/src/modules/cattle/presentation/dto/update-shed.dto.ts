import { CreateShedDto } from './create-shed.dto';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { trimString } from './common.dto';

export class UpdateShedDto implements Partial<CreateShedDto> {
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
  code?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  capacity?: number;
}
