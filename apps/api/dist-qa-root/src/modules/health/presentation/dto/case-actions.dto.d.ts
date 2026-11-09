import { AppetiteStatus, AppearanceStatus, ClinicalProgress, HealthCareType, HealthCloseOutcome, HealthCondition, MedicineRoute } from '@prisma/client';
export declare class ApplyHealthPlanDto {
    healthPlanId: string;
    startDate?: string;
}
export declare class LogTreatmentDto {
    healthTaskId?: string;
    medicineId?: string;
    medicineName?: string;
    doseAmount?: number;
    doseUnit?: string;
    doseUnitId?: string;
    route?: MedicineRoute;
    administeredAt?: string;
    administeredBy?: string;
    stockDeductionQuantity?: number;
    batchNo?: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    notes?: string;
    outsideInventory?: boolean;
    vetCost?: number;
    financialAccountId?: string;
}
export declare class LogTaskTreatmentDto {
    medicineId?: string;
    medicineName?: string;
    doseAmount?: number;
    doseUnit?: string;
    route?: MedicineRoute;
    administeredAt?: string;
    administeredBy?: string;
    stockDeductionQuantity?: number;
    batchNo?: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    notes?: string;
    financialAccountId?: string;
}
export declare class CreateHealthUpdateDto {
    clinicalProgress: ClinicalProgress;
    symptoms?: string[];
    temperature?: number;
    appetite?: AppetiteStatus;
    appearance?: AppearanceStatus;
    observation?: string;
    recordedBy?: string;
}
export declare class MortalityDto {
    deathDate: string;
    primaryCauseOfDeath: string;
    vetSignOff?: string;
    symptoms?: string[];
    postMortemPerformed?: boolean;
    disposalMethod?: string;
    disposalCost?: number;
    financialAccountId?: string;
    disposalLocation?: string;
    additionalNotes?: string;
    recordedBy?: string;
}
export declare class CloseHealthCaseDto {
    outcome: HealthCloseOutcome;
    observation?: string;
    mortality?: MortalityDto;
}
export declare class RescheduleHealthTaskDto {
    newDueDateTime: string;
    reason?: string;
}
export declare class SkipHealthTaskDto {
    reason?: string;
}
export declare class RecordTreatmentDto {
    cattleIds: string[];
    medicineId?: string;
    medicineName?: string;
    outsideInventory?: boolean;
    vetCost?: number;
    doseAmount: number;
    doseUnit: string;
    doseUnitId?: string;
    route: MedicineRoute;
    treatedAt: string;
    careType?: HealthCareType;
    reason?: string;
    condition?: HealthCondition;
    notes?: string;
    financialAccountId?: string;
}
