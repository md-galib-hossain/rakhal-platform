import { AppetiteStatus, BreedingMethod, HealthCareType, HealthCondition, HealthPriority } from '@prisma/client';
export declare class IntakePregnancyDto {
    conceptionDate?: string;
    expectedCalvingDate?: string;
}
export declare class IntakeLactationDto {
    estimatedDaysInMilk?: number;
    estimatedCalvingDate?: string;
    estimatedLactationNumber?: number;
}
export declare class IntakeHealthConditionDto {
    note?: string;
    condition?: HealthCondition;
    careType: HealthCareType;
    priority: HealthPriority;
    appetite?: AppetiteStatus;
    notes?: string;
}
export declare class IntakeBreedingDto {
    breedingDate: string;
    breedingMethod?: BreedingMethod;
    notes?: string;
}
export declare class IntakeHeatDto {
    heatDateTime: string;
    notes?: string;
}
export declare const HISTORY_KINDS: readonly ["LAST_CALVING", "LAST_BREEDING", "PREGNANT", "MILKING_SINCE", "DRY_SINCE", "LAST_VACCINATION"];
export type HistoryKind = (typeof HISTORY_KINDS)[number];
export declare class HistoryItemDto {
    kind: HistoryKind;
    date?: string;
    calvingNumber?: number;
    method?: BreedingMethod;
    bull?: string;
    expectedCalvingDate?: string;
    monthsPregnant?: number;
    product?: string;
}
