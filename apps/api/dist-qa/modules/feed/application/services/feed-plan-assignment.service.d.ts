import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { ApplyFeedPlanDto, ListPlanAssignmentsQueryDto } from '../../presentation/dto/feed-plan.dto';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
export declare class FeedPlanAssignmentService {
    private readonly prisma;
    private readonly resolver;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, resolver: FeedPlanResolverService, activityLog: ActivityLogService);
    apply(farmId: string, userId: string, planId: string, dto: ApplyFeedPlanDto): Promise<{
        plan_id: string;
        assignments: {
            id: string;
            plan_id: string;
            target_type: import("@prisma/client").$Enums.FeedPlanTarget;
            cattle_id: string | null;
            animal_group_id: string | null;
            applied_at: Date;
            applied_by: string;
            removed_at: Date | null;
            removed_by: string | null;
        }[];
        replaced: {
            plan_name: string;
            id: string;
            plan_id: string;
            target_type: import("@prisma/client").$Enums.FeedPlanTarget;
            cattle_id: string | null;
            animal_group_id: string | null;
            applied_at: Date;
            applied_by: string;
            removed_at: Date | null;
            removed_by: string | null;
        }[];
        leaves_group_program: {
            cattle_id: string;
            group_id: string | null;
            plan_id: string;
            plan_name: string;
        }[];
    }>;
    remove(farmId: string, userId: string, assignmentId: string): Promise<{
        plan_name: string;
        id: string;
        plan_id: string;
        target_type: import("@prisma/client").$Enums.FeedPlanTarget;
        cattle_id: string | null;
        animal_group_id: string | null;
        applied_at: Date;
        applied_by: string;
        removed_at: Date | null;
        removed_by: string | null;
    }>;
    removeAllForPlan(tx: Prisma.TransactionClient, farmId: string, userId: string, planId: string): Promise<number>;
    countActive(farmId: string, planId: string): Promise<number>;
    appliedTo(farmId: string, planIds: string[]): Promise<Map<string, {
        cattle_ids: string[];
        group_ids: string[];
        herd: boolean;
    }>>;
    list(farmId: string, query: ListPlanAssignmentsQueryDto): Promise<{
        items: {
            plan_name: string;
            plan_kind: import("@prisma/client").$Enums.FeedPlanKind;
            id: string;
            plan_id: string;
            target_type: import("@prisma/client").$Enums.FeedPlanTarget;
            cattle_id: string | null;
            animal_group_id: string | null;
            applied_at: Date;
            applied_by: string;
            removed_at: Date | null;
            removed_by: string | null;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    private resolveTargets;
    private targetWhere;
    private assertNoGroupOverlap;
    private mapAssignment;
    private describe;
    private describeRow;
    private audit;
}
