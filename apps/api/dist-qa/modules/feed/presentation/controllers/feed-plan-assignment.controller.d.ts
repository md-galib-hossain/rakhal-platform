import { FeedPlanAssignmentService } from '../../application/services/feed-plan-assignment.service';
import { ListPlanAssignmentsQueryDto } from '../dto/feed-plan.dto';
export declare class FeedPlanAssignmentController {
    private readonly assignments;
    constructor(assignments: FeedPlanAssignmentService);
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
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    remove(farmId: string, userId: string, id: string): Promise<{
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
}
