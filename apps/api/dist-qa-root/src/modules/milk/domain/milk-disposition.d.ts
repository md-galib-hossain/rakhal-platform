import { MilkDisposition } from '@prisma/client';
export interface ResolveMilkDispositionInput {
    isWithheld: boolean;
    activeLactationStartDate: Date | null;
    logDate: Date;
    colostrumWindowDays: number;
}
export declare function resolveMilkDisposition({ isWithheld, activeLactationStartDate, logDate, colostrumWindowDays, }: ResolveMilkDispositionInput): MilkDisposition;
export interface IsWithinColostrumWindowInput {
    activeLactationStartDate: Date | null;
    asOfDate: Date;
    colostrumWindowDays: number;
}
export declare function isWithinColostrumWindow({ activeLactationStartDate, asOfDate, colostrumWindowDays, }: IsWithinColostrumWindowInput): boolean;
