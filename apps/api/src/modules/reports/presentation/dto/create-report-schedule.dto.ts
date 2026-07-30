import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReportFormat, ReportScheduleFrequency } from '@prisma/client';
import { trimString } from 'src/common/dto';
import { ReportParametersDto } from './generate-report.dto';

/** `POST /reports/schedules` (PRD §22.3, RD-013c). */
export class CreateReportScheduleDto {
  @Transform(trimString)
  @IsString()
  reportId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ReportScheduleFrequency)
  frequency!: ReportScheduleFrequency;

  /** 1 (Mon) - 7 (Sun); required when `frequency` is WEEKLY, ignored otherwise. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  /** 1-28; required when `frequency` is MONTHLY, ignored otherwise. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportParametersDto)
  parameters?: ReportParametersDto;
}
