import { Prisma } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { PlanStats } from '../../domain/health-plan-stats';
export declare function liveStepWhere(farmId: string): Prisma.HealthTaskWhereInput;
export declare class HealthPlanStatsService {
    private readonly prisma;
    private readonly clock;
    constructor(prisma: PrismaService, clock: FarmClockService);
    statsFor(farmId: string, plans: {
        id: string;
        category: string;
    }[], now?: Date): Promise<Map<string, PlanStats>>;
    attach<T extends {
        id: string;
        category: string;
    }, M>(farmId: string, page: {
        items: T[];
        meta: M;
    }): Promise<{
        items: (T & {
            stats: PlanStats;
        })[];
        meta: M;
    }>;
}
