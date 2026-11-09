import { HealthActionType, HealthCareType, HealthCaseStatus, HealthCondition, HealthPlanCategory, HealthPlanType, HealthPriority, HealthTaskStatus, MedicineRoute, SafetyWithdrawalStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { HealthListQueryDto } from './common.dto';
export declare class SickBayQueryDto extends HealthListQueryDto {
    shed?: string;
    diagnosis?: string;
    priority?: HealthPriority;
    status?: HealthCaseStatus;
}
export declare class TreatmentLogsQueryDto extends HealthListQueryDto {
    careType?: HealthCareType;
    route?: MedicineRoute;
}
export declare class HealthOutcomesQueryDto {
    days?: number;
}
export declare class MorbidityTrendQueryDto {
    days?: number;
}
export declare class HealthPlanQueryDto extends HealthListQueryDto {
    category?: HealthPlanCategory;
    condition?: HealthCondition;
    planType?: HealthPlanType;
    kind?: 'TREATMENT' | 'PREVENTION' | 'BREEDING';
    inUse?: boolean;
}
export declare class PlanRunsQueryDto extends CursorPaginationQueryDto {
    status: 'active' | 'all';
    search?: string;
}
export declare class HealthTaskQueryDto extends HealthListQueryDto {
    date?: string;
    status?: HealthTaskStatus;
    statuses?: HealthTaskStatus[];
    healthPlanId?: string;
    noPlan?: boolean;
    dueTo?: string;
    sortBy?: 'created' | 'due';
    type?: HealthActionType;
    healthCaseId?: string;
}
export declare class HealthTaskCalendarQueryDto {
    month: number;
    year: number;
}
export declare class SafetyWithdrawalQueryDto extends HealthListQueryDto {
    status?: SafetyWithdrawalStatus;
    activeOnly?: boolean;
}
export declare class AppliedPlansQueryDto extends HealthListQueryDto {
    healthPlanId?: string;
}
