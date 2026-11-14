import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ShedPurpose } from '@prisma/client';
import { trimString } from 'src/common/dto';

export class CreateShedDto {
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trimString)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(ShedPurpose)
  purpose?: string;

  @IsOptional()
  @IsString()
  responsible_member_id?: string;
}
