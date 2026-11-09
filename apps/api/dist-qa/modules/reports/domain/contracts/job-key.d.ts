import type { ReportType } from './enums';
export interface ScheduledReportKeyInput {
    farmId: string;
    type: Extract<ReportType, 'WEEKLY' | 'MONTHLY'>;
    periodStartDate: string;
    templateVersion: number;
}
export declare const FARM_ID_PATTERN: RegExp;
export declare function scheduledReportKey(input: ScheduledReportKeyInput): string;
