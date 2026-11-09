import { HealthCareType, HealthCaseStatus, HealthCondition, HealthPriority } from '@prisma/client';
export declare class UpdateHealthCaseDto {
    note?: string;
    condition?: HealthCondition;
    careType?: HealthCareType;
    priority?: HealthPriority;
    status?: HealthCaseStatus;
    assignedVet?: string;
    expectedRecoveryDate?: string;
    symptoms?: string[];
    notes?: string;
}
