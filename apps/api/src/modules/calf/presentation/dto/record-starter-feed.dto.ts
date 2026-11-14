import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CalfStarterEventType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Record starter-feed introduction or daily intake (PRD §14.4). */
export class RecordStarterFeedDto {
  @IsDateString()
  date!: string;

  @IsEnum(CalfStarterEventType)
  eventType!: CalfStarterEventType;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  amountG?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
