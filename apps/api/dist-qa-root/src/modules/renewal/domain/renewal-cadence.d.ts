import { RenewalStage } from '@prisma/client';
export declare const PRE_EXPIRY_CADENCE: {
    stage: RenewalStage;
    daysUntil: number;
}[];
export declare const WINBACK_CADENCE: {
    stage: RenewalStage;
    daysSince: number;
}[];
export declare function calendarDaysBetween(from: Date, to: Date): number;
export declare function preExpiryStageFor(daysUntil: number): RenewalStage | null;
export declare function winbackStageFor(daysSince: number): RenewalStage | null;
