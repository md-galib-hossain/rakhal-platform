import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import {
  DATE_PRESETS,
  REPORT_ORIGINS,
  REPORT_SCOPE_KINDS,
  REPORT_STATUSES,
  REPORT_TYPES,
  type DatePreset,
  type ReportOrigin,
  type ReportScopeKind,
  type ReportStatus,
  type ReportType,
} from '../../domain/contracts/enums';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class ReportPeriodDto {
  @IsIn(DATE_PRESETS)
  preset!: DatePreset;

  @IsOptional()
  @Matches(YMD)
  customStartDate?: string;

  @IsOptional()
  @Matches(YMD)
  customEndDate?: string;
}

export class ReportScopeDto {
  @IsIn(REPORT_SCOPE_KINDS)
  kind!: ReportScopeKind;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  cattleId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  groupId?: string;
}

/** Body of `POST /reports/preview`. No `farmId`: the tenant comes from the token. */
export class PreviewReportDto {
  @IsString()
  @Length(1, 64)
  templateId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ReportPeriodDto)
  period!: ReportPeriodDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ReportScopeDto)
  scope!: ReportScopeDto;

  /** Raw bound only (DoS guard); the service dedupes and enforces the real cap of 60. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  selectedMetricIds!: string[];

  /** Accepted for contract parity; the compute service decides the comparison period. */
  @IsOptional()
  @IsBoolean()
  compare?: boolean;
}

/** Body of `POST /reports`. */
export class CreateReportDto extends PreviewReportDto {
  /** Create a new snapshot even if an identical report already exists. */
  @IsOptional()
  @IsBoolean()
  forceNew?: boolean;
}

export class ListReportsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsIn(REPORT_TYPES)
  type?: ReportType;

  @IsOptional()
  @IsIn(REPORT_ORIGINS)
  origin?: ReportOrigin;

  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: ReportStatus;
}

export class ReportIdParamDto {
  @IsString()
  @Length(1, 64)
  id!: string;
}
