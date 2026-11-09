import { Prisma } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { CursorPage } from 'src/common/pagination';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { RoundSummary } from '../../domain/health-round';
import { PlanKind } from '../../domain/health-plan-stats';
import { AddRoundAnimalsDto, RoundGridQueryDto, RoundsQueryDto } from '../../presentation/dto/health-rounds.dto';
import { HealthService } from './health.service';
declare const PLAN_SELECT: {
    id: true;
    name: true;
    category: true;
    deletedAt: true;
};
type PlanRef = Prisma.HealthPlanGetPayload<{
    select: typeof PLAN_SELECT;
}>;
export interface RoundRow extends RoundSummary {
    roundKey: string;
    healthPlan: PlanRef;
    kind: PlanKind;
    startDate: string;
    animalCount: number;
}
export declare class HealthRoundsService {
    private readonly prisma;
    private readonly clock;
    private readonly health;
    constructor(prisma: PrismaService, clock: FarmClockService, health: HealthService);
    list(farmId: string, query: RoundsQueryDto): Promise<CursorPage<RoundRow>>;
    addAnimals(farmId: string, userId: string, roundKey: string, dto: AddRoundAnimalsDto): Promise<{
        roundKey: string;
        addedCount: number;
        skippedCount: number;
        results: ({
            cattleId: string;
            planEnrollmentId: string;
            status: "applied";
        } | {
            cattleId: string;
            status: "skipped";
            reason: string;
        })[] | ({
            cattleId: string;
            healthCaseId: string;
            status: "applied";
        } | {
            cattleId: string;
            status: "skipped";
            reason: string;
        })[];
    }>;
    cancelRound(farmId: string, userId: string, roundKey: string, reason?: string): Promise<{
        animals: number;
        stepsRemoved: number;
        dosesReversed: number;
        casesRemoved: number;
        roundKey: string;
    }>;
    private treatmentRoundCaseIds;
    private treatmentRoundExists;
    grid(farmId: string, roundKey: string, query: RoundGridQueryDto): Promise<{
        data: {
            round: {
                stepsTotal: number;
                stepsDone: number;
                stepsSkipped: number;
                stepsOverdue: number;
                stepsDueToday: number;
                nextDueDate: string | null;
                status: "RUNNING" | "FINISHED";
                roundKey: string;
                healthPlan: {
                    id: string;
                    name: string;
                    category: import("@prisma/client").$Enums.HealthPlanCategory;
                    deletedAt: Date | null;
                };
                kind: PlanKind;
                startDate: string;
                animalCount: number;
            };
            columns: import("../../domain/health-round").GridColumn[];
            rows: {
                runKey: string;
                runType: "CASE" | "ENROLLMENT";
                healthCaseId: string | null;
                planEnrollmentId: string | null;
                caseCode: string | null;
                cattle: {
                    id: string;
                    name: string | null;
                    tagNumber: string;
                };
                dueCount: number;
                overdueCount: number;
                cells: Record<string, import("../../domain/health-round").GridCell>;
            }[];
        };
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
}
export {};
