import { HealthCaseStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface CaseSummaryInput {
    id: string;
    cattleId: string;
    condition: string | null;
    status: HealthCaseStatus;
    startDate: Date;
    closedDate: Date | null;
    currentStep: number;
    totalSteps: number;
    healthPlan: {
        id: string;
        name: string;
    } | null;
    treatmentLogs: {
        financeTransactionId: string | null;
    }[];
}
export declare class HealthOutcomesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    caseSummary(farmId: string, healthCase: CaseSummaryInput, now?: Date): Promise<{
        daysSick: number;
        daysToRecover: number | null;
        outcome: import("@prisma/client").$Enums.HealthCaseStatus | null;
        treatmentCount: number;
        stepsDone: number;
        stepsTotal: number;
        protocol: {
            id: string;
            name: string;
        } | null;
        totalCost: number;
        recurrence: {
            isRecurrence: boolean;
            previousCaseId: string;
            previousClosedDate: Date;
            daysSincePrevious: number;
        } | {
            isRecurrence: boolean;
            previousCaseId: null;
            previousClosedDate: null;
            daysSincePrevious: null;
        };
    }>;
    getOutcomes(farmId: string, days: number, now?: Date): Promise<{
        openCases: number;
        otherClosed: number;
        totalCost: number;
        recurrenceRate: number | null;
        byCondition: (import("../../domain/health-case-outcome").OutcomeBreakdown & {
            condition: string | null;
        })[];
        cases: number;
        recovered: number;
        mortality: number;
        recoveryRate: number | null;
        avgDaysToRecover: number | null;
        avgCost: number | null;
        windowDays: number;
        since: Date;
    }>;
    getMorbidityTrend(farmId: string, days: number | undefined, now?: Date): Promise<{
        total: number;
        previousTotal: null;
        bucket: import("../../domain/morbidity-trend").TrendBucket;
        points: import("../../domain/morbidity-trend").TrendPoint[];
        windowDays: null;
    } | {
        total: number;
        previousTotal: number;
        bucket: import("../../domain/morbidity-trend").TrendBucket;
        points: import("../../domain/morbidity-trend").TrendPoint[];
        windowDays: number;
    }>;
    private previousSameCondition;
    private expenseAmounts;
}
