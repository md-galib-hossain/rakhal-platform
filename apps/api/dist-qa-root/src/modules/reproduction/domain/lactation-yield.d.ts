import { MilkDisposition } from '@prisma/client';
import { DailyYieldPoint } from './lactation-curve';
export interface YieldEntry {
    logDate: Date;
    yieldL: number;
    disposition: MilkDisposition;
}
export declare function startOfUtcDay(date: Date): Date;
export declare function daysBetween(start: Date, end: Date): number;
export declare function sumYieldForDay(entries: YieldEntry[], day: Date): number;
export declare function averageDailyYield(entries: YieldEntry[], params: {
    referenceDate: Date;
    windowDays: number;
    lactationStart: Date;
}): number;
export interface LactationTotalsByDisposition {
    produced: number;
    saleable: number;
    withheld: number;
    colostrum: number;
    calfFeed: number;
    discarded: number;
    householdUse: number;
}
export declare function totalsByDisposition(entries: YieldEntry[]): LactationTotalsByDisposition;
export interface LactationPeak {
    peakMilkYield: number;
    peakMilkDate: Date;
    peakDaysInMilk: number;
}
export declare function computeLactationPeak(series: DailyYieldPoint[]): LactationPeak | null;
