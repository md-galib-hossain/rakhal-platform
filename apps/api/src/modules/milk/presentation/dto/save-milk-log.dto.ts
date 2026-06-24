import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MilkSession } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** One cow's yield for a session. The tank is derived server-side (withholding is locked). */
export class MilkLogEntryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  yieldL!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  anomalyNote?: string;
}

/** `POST /milk/log` — save/update draft entries for a session on a date. */
export class SaveMilkLogDto {
  @IsDateString()
  date!: string;

  @IsEnum(MilkSession)
  session!: MilkSession;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilkLogEntryDto)
  entries!: MilkLogEntryDto[];
}
