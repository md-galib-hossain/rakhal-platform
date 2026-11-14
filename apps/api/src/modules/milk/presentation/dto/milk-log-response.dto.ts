import { ApiProperty } from '@nestjs/swagger';
import { MilkDisposition, MilkSession, MilkTankType } from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { MilkImportService } from '../../application/services/milk-import.service';
import type { MilkService } from '../../application/services/milk.service';
import type {
  MilkEligibilityStatus,
  MilkRestrictionReason,
} from '../../domain/milk-eligibility';

/**
 * Documented response shapes for the milk log, import, anomaly, submit and overview routes typed under
 * RD-140 (the availability and quality-test routes are in their own files). Each class mirrors what the
 * service really returns and is pinned to it by a compile-time guard at the bottom of this file, so a change
 * in a service (or a Prisma column) fails `nest build` until this file follows. Dates are ISO-8601 strings
 * on the wire; quantities are plain JSON numbers.
 *
 * Not documented: `POST /milk/export`, which streams an Excel file rather than a JSON envelope.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const ELIGIBILITY_STATUS = [
  'SALEABLE',
  'WITHHELD',
  'COLOSTRUM',
  'DISCARD_REQUIRED',
] as const;
const RESTRICTION_REASON = [
  'COLOSTRUM_PERIOD',
  'MEDICINE_WITHDRAWAL',
  'MASTITIS',
  'VETERINARY_HOLD',
  'ABNORMAL_MILK',
  'OTHER',
] as const;
const TREND_RANGE = ['7d', '30d', '3m', '6m', '1y', 'lifetime'] as const;

// ─── Eligibility ───────────────────────────────────────────────────────────

export class MilkEligibilityResponseDto {
  @ApiProperty({ description: 'True when this cow’s milk can be sold now.' })
  isSaleable!: boolean;
  @ApiProperty({ enum: ELIGIBILITY_STATUS, enumName: 'MilkEligibilityStatus' })
  primaryStatus!: MilkEligibilityStatus;
  @ApiProperty({
    enum: RESTRICTION_REASON,
    enumName: 'MilkRestrictionReason',
    isArray: true,
    description: 'Every active restriction, not just the winning one.',
  })
  reasons!: MilkRestrictionReason[];
}

// ─── Daily log ─────────────────────────────────────────────────────────────

export class MilkLogEntrySessionsDto {
  @ApiProperty(NULLABLE_NUMBER) morningL!: number | null;
  @ApiProperty(NULLABLE_NUMBER) noonL!: number | null;
  @ApiProperty(NULLABLE_NUMBER) eveningL!: number | null;
  @ApiProperty(NULLABLE_NUMBER) nightL!: number | null;
  @ApiProperty() totalL!: number;
  @ApiProperty({ enum: ['SELLABLE', 'WITHHOLDING'], enumName: 'MilkTankKind' })
  tank!: 'SELLABLE' | 'WITHHOLDING';
  @ApiProperty() tankLocked!: boolean;
  @ApiProperty(NULLABLE_STRING) tankId!: string | null;
  @ApiProperty() anomalyFlag!: boolean;
  @ApiProperty({
    enum: MilkSession,
    enumName: 'MilkSession',
    isArray: true,
    description: 'Sessions already submitted for this day.',
  })
  submittedSessions!: MilkSession[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { enum: Object.values(MilkDisposition) },
    description: 'Disposition per session key (for example `morning`).',
  })
  dispositions!: Record<string, MilkDisposition>;
}

export class MilkLogTableRowDto {
  @ApiProperty() cattleId!: string;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty() tag!: string;
  @ApiProperty(NULLABLE_STRING) shed!: string | null;
  @ApiProperty(NULLABLE_NUMBER) avgYield7d!: number | null;
  @ApiProperty(NULLABLE_NUMBER) prevDayYieldL!: number | null;
  @ApiProperty() productionStatus!: string;
  @ApiProperty() withholding!: boolean;
  @ApiProperty({ type: () => MilkLogEntrySessionsDto })
  log!: MilkLogEntrySessionsDto;
}

export class MilkLogTableResponseDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({
    enum: MilkSession,
    enumName: 'MilkSession',
    isArray: true,
    description: 'Sessions this farm has configured.',
  })
  sessionConfig!: MilkSession[];
  @ApiProperty({ type: () => [MilkLogTableRowDto] })
  entries!: MilkLogTableRowDto[];
}

export class MilkSaveLogResponseDto {
  @ApiProperty() saved!: number;
  @ApiProperty() anomaliesFlagged!: number;
  @ApiProperty() sessionTotalL!: number;
}

export class MilkLogCalendarDayDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({
    enum: ['complete', 'partial', 'missing', 'future', 'before_farm'],
    enumName: 'MilkLogDayStatus',
  })
  status!: 'complete' | 'partial' | 'missing' | 'future' | 'before_farm';
}

export class MilkLogCalendarResponseDto {
  @ApiProperty({ description: 'Month, YYYY-MM.' }) month!: string;
  @ApiProperty({ type: () => [MilkLogCalendarDayDto] })
  days!: MilkLogCalendarDayDto[];
}

// ─── Submit ────────────────────────────────────────────────────────────────

export class MilkSubmitAnomalyDto {
  @ApiProperty() cattleId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() yieldL!: number;
}

export class MilkSubmitResponseDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({ enum: MilkSession, enumName: 'MilkSession' })
  session!: MilkSession;
  @ApiProperty() totalCowsLogged!: number;
  @ApiProperty() sellableTotalL!: number;
  @ApiProperty() withholdingTotalL!: number;
  @ApiProperty() mainTankUpdated!: boolean;
  @ApiProperty() withholdingTankUpdated!: boolean;
  @ApiProperty() activityLogCreated!: boolean;
  @ApiProperty({ type: () => [MilkSubmitAnomalyDto] })
  anomalies!: MilkSubmitAnomalyDto[];
}

// ─── Anomalies ─────────────────────────────────────────────────────────────

export class MilkAnomalyItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() tag!: string;
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({ enum: MilkSession, enumName: 'MilkSession' })
  session!: MilkSession;
  @ApiProperty() yieldL!: number;
  @ApiProperty(NULLABLE_NUMBER) avg7dL!: number | null;
  @ApiProperty(NULLABLE_NUMBER) dropPct!: number | null;
  @ApiProperty(NULLABLE_STRING) workerNote!: string | null;
  @ApiProperty() reviewed!: boolean;
}

/** The reviewed `MilkLogEntry` row returned by `POST /milk/anomalies/:id/review`. */
export class MilkLogEntryRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() cattleId!: string;
  @ApiProperty(DATE_TIME) logDate!: Date;
  @ApiProperty({ enum: MilkSession, enumName: 'MilkSession' })
  session!: MilkSession;
  @ApiProperty() yieldL!: number;
  @ApiProperty({ enum: MilkTankType, enumName: 'MilkTankType' })
  tankType!: MilkTankType;
  @ApiProperty(NULLABLE_STRING) tankId!: string | null;
  @ApiProperty({ enum: MilkDisposition, enumName: 'MilkDisposition' })
  disposition!: MilkDisposition;
  @ApiProperty() anomalyFlag!: boolean;
  @ApiProperty(NULLABLE_STRING) anomalyNote!: string | null;
  @ApiProperty() reviewed!: boolean;
  @ApiProperty(NULLABLE_STRING) reviewAction!: string | null;
  @ApiProperty(NULLABLE_STRING) reviewNote!: string | null;
  @ApiProperty() submitted!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) submittedAt!: Date | null;
  @ApiProperty(NULLABLE_STRING) editReason!: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

// ─── Excel import ──────────────────────────────────────────────────────────

export class MilkImportPreviewRowDto {
  @ApiProperty({ description: 'Spreadsheet row number.' }) row!: number;
  @ApiProperty(NULLABLE_STRING) date!: string | null;
  @ApiProperty(NULLABLE_STRING) tag!: string | null;
  @ApiProperty({ enum: ['ready', 'error'], enumName: 'MilkImportRowStatus' })
  status!: 'ready' | 'error';
  @ApiProperty({ type: String, required: false }) error!: string | undefined;
}

export class MilkImportPreviewResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Pass this to `POST /milk/import/confirm`.',
  })
  importSessionId!: `${string}-${string}-${string}-${string}-${string}`;
  @ApiProperty() total!: number;
  @ApiProperty() ready!: number;
  @ApiProperty() errors!: number;
  @ApiProperty({ type: () => [MilkImportPreviewRowDto] })
  rows!: MilkImportPreviewRowDto[];
}

export class MilkImportConfirmResponseDto {
  @ApiProperty() imported!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty() failedGroups!: number;
}

// ─── Overview ──────────────────────────────────────────────────────────────

export class MilkOverviewTodayDto {
  @ApiProperty() totalL!: number;
  @ApiProperty() sellableL!: number;
  @ApiProperty() withholdingL!: number;
  @ApiProperty() calfL!: number;
}

export class MilkDayTotalDto {
  @ApiProperty() totalL!: number;
}

export class MilkTrendPointDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty() totalL!: number;
}

export class MilkOverviewResponseDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty({ type: () => MilkOverviewTodayDto })
  today!: MilkOverviewTodayDto;
  @ApiProperty({ type: () => MilkDayTotalDto }) yesterday!: MilkDayTotalDto;
  @ApiProperty({ type: () => MilkDayTotalDto })
  sameDayLastWeek!: MilkDayTotalDto;
  @ApiProperty({ type: () => MilkDayTotalDto })
  sameDayLastYear!: MilkDayTotalDto;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Always null today: cost per litre is not computed yet.',
  })
  costPerLitreToday!: null;
  @ApiProperty(NULLABLE_NUMBER) marketValueToday!: number | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Status per session key (for example `morning`).',
  })
  sessionsStatus!: Record<string, string>;
  @ApiProperty({ enum: TREND_RANGE, enumName: 'MilkTrendRange' })
  trendRange!: (typeof TREND_RANGE)[number];
  @ApiProperty({ type: () => [MilkTrendPointDto] })
  trend!: MilkTrendPointDto[];
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Milk = MilkService;
type Imp = MilkImportService;

export type MilkLogShapeGuards = [
  Assert<Same<Ret<Milk, 'getMilkEligibility'>, MilkEligibilityResponseDto>>,
  Assert<Same<Ret<Milk, 'logTable'>, MilkLogTableResponseDto>>,
  Assert<Same<Ret<Milk, 'saveLog'>, MilkSaveLogResponseDto>>,
  Assert<Same<Ret<Milk, 'logCalendar'>, MilkLogCalendarResponseDto>>,
  Assert<Same<Ret<Milk, 'submit'>, MilkSubmitResponseDto>>,
  Assert<Same<Ret<Milk, 'anomalies'>, CursorPage<MilkAnomalyItemDto>>>,
  Assert<Same<Ret<Milk, 'reviewAnomaly'>, MilkLogEntryRowDto>>,
  Assert<Same<Ret<Milk, 'overview'>, MilkOverviewResponseDto>>,
  Assert<Same<Ret<Imp, 'preview'>, MilkImportPreviewResponseDto>>,
  Assert<Same<Ret<Imp, 'confirm'>, MilkImportConfirmResponseDto>>,
];
