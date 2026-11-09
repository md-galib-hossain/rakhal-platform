export type ScheduleRepeatType = 'NONE' | 'EVERY_N_DAYS' | 'WEEKLY' | 'MONTHLY';
export type ScheduleTriggerType = 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT' | 'SOURCE_DUE';
export declare const SERIES_MAX_ANCHORS = 400;
export declare const MAX_LEADS = 4;
export declare const MAX_LEAD_MINUTES: number;
export declare const DEFAULT_SEND_TIME = "08:00";
export declare const MAX_REPEAT_INTERVAL_DAYS = 365;
export declare const MAX_OFFSET_DAYS = 3650;
export declare const SYSTEM_JITTER_SECONDS = 180;
export declare function isValidSendTime(hm: string): boolean;
export declare function addDaysYmd(ymd: string, days: number): string;
export declare function addMonthsClampedYmd(baseYmd: string, months: number): string;
export declare function allDayAnchorYmd(anchorAt: Date): string;
export declare function allDayAnchorFromYmd(ymd: string): Date;
export declare function localParts(instant: Date, timezone: string): {
    ymd: string;
    hm: string;
};
export declare function anchorLocalYmd(anchorAt: Date, allDay: boolean, timezone: string): string;
export declare function endOfDayKey(ymd: string): Date;
export type LeadError = 'LEADS_EMPTY' | 'LEADS_TOO_MANY' | 'LEAD_NEGATIVE' | 'LEAD_TOO_LONG' | 'LEAD_NOT_WHOLE_DAYS' | 'LEAD_NOT_INTEGER';
export declare function validateLeads(leadMinutes: readonly number[], allDay: boolean): LeadError | null;
export declare function normalizeLeads(leadMinutes: readonly number[]): number[];
export interface FireTimeInput {
    anchorAt: Date;
    allDay: boolean;
    sendTime?: string;
    leadMinutes: number;
    timezone: string;
}
export declare function computeFireAt(input: FireTimeInput): Date;
export declare function jitterSeconds(occurrenceId: string): number;
export declare function applyJitter(fireAt: Date, occurrenceId: string, origin: 'SYSTEM' | 'USER'): Date;
export declare function eventKeyForBand(origin: 'SYSTEM' | 'USER', leadMinutes: number): 'custom_reminder' | 'scheduled_upcoming' | 'scheduled_due';
export declare function anchorFromEntity(input: {
    trigger: 'BEFORE_EVENT' | 'AFTER_EVENT';
    entityAt: Date;
    offsetDays: number;
    allDay: boolean;
    timezone: string;
}): Date;
export declare function isAnchorInFuture(anchorAt: Date, now: Date): boolean;
export interface SeriesInput {
    baseAnchorAt: Date;
    allDay: boolean;
    repeat: ScheduleRepeatType;
    repeatInterval?: number | null;
    repeatEndDate?: Date | null;
    timezone: string;
}
export declare function anchorForIndex(series: SeriesInput, k: number): Date | null;
export interface PlannedOccurrence {
    anchorAt: Date;
    leadMinutes: number;
    fireAt: Date;
}
export declare function liveOccurrencesForAnchor(input: {
    anchorAt: Date;
    allDay: boolean;
    sendTime?: string;
    leadMinutes: readonly number[];
    timezone: string;
    now: Date;
}): PlannedOccurrence[];
export interface PlannedSeriesStart {
    seriesIndex: number;
    anchorAt: Date;
    occurrences: PlannedOccurrence[];
}
type SeriesWithLeads = SeriesInput & {
    sendTime?: string;
    leadMinutes: readonly number[];
};
export declare function firstLiveAnchor(series: SeriesWithLeads, fromIndex: number, now: Date): PlannedSeriesStart | null;
export declare function advanceSeries(series: SeriesWithLeads, currentIndex: number, now: Date): PlannedSeriesStart | null;
export type RepeatError = 'REPEAT_INTERVAL_REQUIRED' | 'REPEAT_INTERVAL_OUT_OF_RANGE' | 'REPEAT_END_BEFORE_START' | 'REPEAT_END_INVALID';
export declare function validateRepeat(input: {
    repeat: ScheduleRepeatType;
    repeatInterval?: number | null;
    endDateYmd?: string | null;
    startYmd: string;
}): RepeatError | null;
export {};
