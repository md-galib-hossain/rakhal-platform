import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ReportFormat } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Per-report parameters (PRD §22). All optional; each generator reads what it needs. */
export class ReportParametersDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month?: string;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'year must be YYYY' })
  year?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  category?: string;
}

/** `POST /reports/generate` (PRD §22 / API §15, RAKHAL-103). */
export class GenerateReportDto {
  @Transform(trimString)
  @IsString()
  reportId!: string;

  // Accept the API's lowercase `pdf`/`csv` (and any case) → enum PDF/CSV.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportParametersDto)
  parameters?: ReportParametersDto;
}
