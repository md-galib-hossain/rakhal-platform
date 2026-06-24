import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ColostrumQuality } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Record a colostrum feed (PRD §14.4). */
export class RecordColostrumDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  feedNumber!: number;

  @IsDateString()
  fedAt!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  volumeMl!: number;

  @IsOptional()
  @IsEnum(ColostrumQuality)
  quality?: ColostrumQuality;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  fedBy?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
