import type { DatePreset, ReportType } from '../contracts/enums';
import type { ReportPeriod } from '../contracts/period';
export declare const MAX_CUSTOM_RANGE_DAYS = 366;
export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';
export interface CustomRange {
    from: string;
    to: string;
}
export declare function resolvePreset(preset: DatePreset, nowInstant: Date, timezone: string, custom?: CustomRange): ReportPeriod;
export declare function closedPeriodFor(type: Extract<ReportType, 'WEEKLY' | 'MONTHLY'>, nowInstant: Date, timezone: string): ReportPeriod;
export declare function detectPeriodKind(period: ReportPeriod): PeriodKind;
export interface PreviousPeriodResult {
    previous: ReportPeriod;
    partial: boolean;
    current: ReportPeriod;
    kind: PeriodKind;
}
export declare function previousEquivalentPeriod(period: ReportPeriod, nowInstant: Date, kind?: PeriodKind): PreviousPeriodResult;
export declare function scheduledRunInstant(period: ReportPeriod, timezone: string): Date;
export declare function enumerateDays(period: ReportPeriod): string[];
