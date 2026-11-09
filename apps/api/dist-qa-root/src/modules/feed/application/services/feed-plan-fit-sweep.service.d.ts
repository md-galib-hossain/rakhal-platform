import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { FeedPlanService } from './feed-plan.service';
export declare const OFF_TARGET_DAYS = 3;
export declare const OFF_TARGET_TASK_EVENT = "FEED_PLAN_OUT_OF_BAND";
export declare class FeedPlanFitSweepService {
    private readonly prisma;
    private readonly resolver;
    private readonly plans;
    private readonly tasks;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, resolver: FeedPlanResolverService, plans: FeedPlanService, tasks: TaskService);
    sweepAll(now?: Date): Promise<number>;
    sweepFarm(farmId: string, now?: Date): Promise<number>;
    private recordDay;
    private digest;
}
