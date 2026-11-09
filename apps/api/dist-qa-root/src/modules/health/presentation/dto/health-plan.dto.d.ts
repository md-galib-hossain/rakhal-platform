import { HealthActionType, HealthCondition, HealthPlanCategory, HealthPlanType, MedicineRoute } from '@prisma/client';
export declare class HealthPlanStepDto {
    dayNumber: number;
    title: string;
    actionType: HealthActionType;
    medicineId?: string;
    medicineName?: string;
    doseAmount?: number;
    doseUnit?: string;
    doseUnitId?: string;
    timeOfDay?: string;
    route?: MedicineRoute;
    instruction?: string;
    estimatedTime?: string;
    milkWithdrawalDays?: number;
    meatWithdrawalDays?: number;
    isRequired?: boolean;
}
export declare class CreateHealthPlanDto {
    name: string;
    category: HealthPlanCategory;
    planType: HealthPlanType;
    condition?: HealthCondition;
    description?: string;
    diagnosis?: string;
    cycleLengthDays?: number;
    isTemplate?: boolean;
    steps: HealthPlanStepDto[];
}
export declare class UpdateHealthPlanDto {
    name?: string;
    category?: HealthPlanCategory;
    planType?: HealthPlanType;
    condition?: HealthCondition | null;
    description?: string;
    diagnosis?: string;
    cycleLengthDays?: number;
    isTemplate?: boolean;
    steps?: HealthPlanStepDto[];
}
export declare class ApplyPlanToAnimalsDto {
    cattleIds: string[];
    startDate?: string;
    route?: MedicineRoute;
}
