import { HealthCareType, HealthCondition, HealthPriority } from '@prisma/client';
export declare const BULK_REPORT_MAX_ANIMALS = 100;
export declare class BulkCreateHealthCasesDto {
    cattleIds: string[];
    condition?: HealthCondition;
    note?: string;
    careType?: HealthCareType;
    priority: HealthPriority;
    assignedVet?: string;
    startDate?: string;
    expectedRecoveryDate?: string;
    symptoms?: string[];
    notes?: string;
}
