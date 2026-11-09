import { AppetiteStatus, HealthCareType, HealthCondition, HealthPriority } from '@prisma/client';
export declare class CreateHealthCaseDto {
    cattleId: string;
    note?: string;
    condition?: HealthCondition;
    careType: HealthCareType;
    priority: HealthPriority;
    shedId?: string;
    shedName?: string;
    reportedBy?: string;
    assignedVet?: string;
    startDate?: string;
    expectedRecoveryDate?: string;
    symptoms?: string[];
    notes?: string;
    temperature?: number;
    appetite?: AppetiteStatus;
    staffObservation?: string;
    photoUrl?: string;
}
