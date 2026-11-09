import { BreedingStatus } from '@prisma/client';
export type ReproductionAlert = 'HEAT_DETECTED' | 'PREGNANCY_CHECK_DUE' | 'OVERDUE_PREGNANCY_CHECK' | 'REPEAT_BREEDER' | 'LONG_DAYS_OPEN' | 'CALVING_DUE' | 'CALVING_OVERDUE' | 'ABORTION_HISTORY' | 'REPRODUCTIVE_HOLD' | 'HEAT_ON_ACTIVE_PREGNANCY';
export interface ReproductionAlertsInput {
    now: Date;
    reproductionState: 'NOT_ELIGIBLE' | 'POSTPARTUM_WAITING' | 'OPEN' | 'BRED_AWAITING_CONFIRMATION' | 'PREGNANT';
    recentHeat: {
        heatDateTime: Date;
    } | null;
    heatWindowDays: number;
    lastBreeding: {
        status: BreedingStatus;
        expectedPregnancyCheckDate: Date | null;
    } | null;
    currentPregnancy: {
        expectedCalvingDate: Date | null;
    } | null;
    closeUpWindowDays: number;
    overdueCheckDays: number;
    calvingOverdueDays: number;
    breedingsSinceLastSuccess: number;
    repeatBreederThreshold: number;
    daysOpen: number | null;
    longDaysOpenThresholdDays: number;
    totalAbortions: number;
    hasReproductiveHold: boolean;
}
export declare function deriveReproductionAlerts(input: ReproductionAlertsInput): ReproductionAlert[];
