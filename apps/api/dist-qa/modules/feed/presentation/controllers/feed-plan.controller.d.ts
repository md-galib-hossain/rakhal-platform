import { FeedPlanService } from '../../application/services/feed-plan.service';
import { FeedPlanAssignmentService } from '../../application/services/feed-plan-assignment.service';
import { ApplyFeedPlanDto, ArchiveFeedPlanQueryDto, CreateFeedPlanDto, FeedPlanFitQueryDto, ListFeedPlansQueryDto, PreviewPlanFitDto, UpdateFeedPlanDto } from '../dto/feed-plan.dto';
export declare class FeedPlanController {
    private readonly plans;
    private readonly assignments;
    constructor(plans: FeedPlanService, assignments: FeedPlanAssignmentService);
    list(farmId: string, query: ListFeedPlansQueryDto): Promise<{
        items: {
            id: string;
            name: string;
            kind: import("@prisma/client").$Enums.FeedPlanKind;
            notes: string | null;
            made_for_cattle_id: string | null;
            made_for_animal_group_id: string | null;
            reference_requirement: import("@prisma/client/runtime/client").JsonValue;
            is_active: boolean;
            applied_to: {
                cattle_ids: string[];
                group_ids: string[];
                herd: boolean;
            };
            lines: {
                id: string;
                line_type: import("@prisma/client").$Enums.FeedPlanLineType;
                feed_item_id: string | null;
                concentration_id: string | null;
                name: string | null;
                recipe_kind: string | null;
                kg_per_day: number;
                sort_order: number;
            }[];
            total_kg_per_day: number;
            created_at: Date;
            updated_at: Date;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    get(farmId: string, id: string): Promise<{
        id: string;
        name: string;
        kind: import("@prisma/client").$Enums.FeedPlanKind;
        notes: string | null;
        made_for_cattle_id: string | null;
        made_for_animal_group_id: string | null;
        reference_requirement: import("@prisma/client/runtime/client").JsonValue;
        is_active: boolean;
        applied_to: {
            cattle_ids: string[];
            group_ids: string[];
            herd: boolean;
        };
        lines: {
            id: string;
            line_type: import("@prisma/client").$Enums.FeedPlanLineType;
            feed_item_id: string | null;
            concentration_id: string | null;
            name: string | null;
            recipe_kind: string | null;
            kg_per_day: number;
            sort_order: number;
        }[];
        total_kg_per_day: number;
        created_at: Date;
        updated_at: Date;
    }>;
    fit(farmId: string, id: string, query: FeedPlanFitQueryDto): Promise<{
        plan_id: string;
        date: string;
        lines: {
            line_id: string;
            line_type: import("@prisma/client").$Enums.FeedPlanLineType;
            feed_item_id: string | null;
            concentration_id: string | null;
            name: string;
            kg_per_day: number;
            density: {
                dm_pct: number;
                cp_pct: number;
                me_mj_per_kg_dm: number;
            } | null;
            source: {
                source_type: "FEED_ITEM" | "FEED_STOCK";
                feed_item_id: string | null;
                feed_stock_id: string | null;
            } | null;
            stock_ok: boolean;
            nutrition: import("../../domain/nutrition-profile").NutritionValues | null;
            supply: {
                as_fed_kg: number;
                dm_kg: number | null;
                cp_kg: number | null;
                me_mj: number | null;
            };
        }[];
        supply: {
            as_fed_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
        };
        supply_complete: boolean;
        cows: {
            requirement: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
            };
            requirement_full: import("../../domain/plan-nutrition").PlanRequirement;
            delta_pct: {
                dm: number | null;
                cp: number | null;
                me: number | null;
            };
            fit: {
                severity: import("../../domain/program-fit").FitSeverity;
                estimated: boolean;
                dm: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
                cp: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
                me: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
            };
            nutrients: import("../../domain/plan-nutrition").NutrientRow[];
            inputs: unknown;
            flags: string[];
            dynamic_requirements?: unknown;
            manual?: {} | undefined;
            source: "MANUAL" | "DYNAMIC";
            cattle_id: string;
        }[];
        missing_cattle_ids: string[];
    }>;
    previewFit(farmId: string, dto: PreviewPlanFitDto): Promise<{
        requirement: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
        };
        requirement_full: import("../../domain/plan-nutrition").PlanRequirement;
        delta_pct: {
            dm: number | null;
            cp: number | null;
            me: number | null;
        };
        fit: {
            severity: import("../../domain/program-fit").FitSeverity;
            estimated: boolean;
            dm: {
                delta_pct: number | null;
                severity: import("../../domain/program-fit").FitSeverity;
            };
            cp: {
                delta_pct: number | null;
                severity: import("../../domain/program-fit").FitSeverity;
            };
            me: {
                delta_pct: number | null;
                severity: import("../../domain/program-fit").FitSeverity;
            };
        };
        nutrients: import("../../domain/plan-nutrition").NutrientRow[];
        inputs: unknown;
        flags: string[];
        dynamic_requirements?: unknown;
        manual?: {} | undefined;
        source: "MANUAL" | "DYNAMIC";
        lines: {
            line_id: string;
            line_type: import("@prisma/client").$Enums.FeedPlanLineType;
            feed_item_id: string | null;
            concentration_id: string | null;
            name: string;
            kg_per_day: number;
            density: {
                dm_pct: number;
                cp_pct: number;
                me_mj_per_kg_dm: number;
            } | null;
            source: {
                source_type: "FEED_ITEM" | "FEED_STOCK";
                feed_item_id: string | null;
                feed_stock_id: string | null;
            } | null;
            stock_ok: boolean;
            nutrition: import("../../domain/nutrition-profile").NutritionValues | null;
            supply: {
                as_fed_kg: number;
                dm_kg: number | null;
                cp_kg: number | null;
                me_mj: number | null;
            };
        }[];
        supply: {
            as_fed_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
        };
        supply_complete: boolean;
    }>;
    create(farmId: string, userId: string, dto: CreateFeedPlanDto): Promise<{
        id: string;
        name: string;
        kind: import("@prisma/client").$Enums.FeedPlanKind;
        notes: string | null;
        made_for_cattle_id: string | null;
        made_for_animal_group_id: string | null;
        reference_requirement: import("@prisma/client/runtime/client").JsonValue;
        is_active: boolean;
        applied_to: {
            cattle_ids: string[];
            group_ids: string[];
            herd: boolean;
        };
        lines: {
            id: string;
            line_type: import("@prisma/client").$Enums.FeedPlanLineType;
            feed_item_id: string | null;
            concentration_id: string | null;
            name: string | null;
            recipe_kind: string | null;
            kg_per_day: number;
            sort_order: number;
        }[];
        total_kg_per_day: number;
        created_at: Date;
        updated_at: Date;
    }>;
    update(farmId: string, userId: string, id: string, dto: UpdateFeedPlanDto): Promise<{
        id: string;
        name: string;
        kind: import("@prisma/client").$Enums.FeedPlanKind;
        notes: string | null;
        made_for_cattle_id: string | null;
        made_for_animal_group_id: string | null;
        reference_requirement: import("@prisma/client/runtime/client").JsonValue;
        is_active: boolean;
        applied_to: {
            cattle_ids: string[];
            group_ids: string[];
            herd: boolean;
        };
        lines: {
            id: string;
            line_type: import("@prisma/client").$Enums.FeedPlanLineType;
            feed_item_id: string | null;
            concentration_id: string | null;
            name: string | null;
            recipe_kind: string | null;
            kg_per_day: number;
            sort_order: number;
        }[];
        total_kg_per_day: number;
        created_at: Date;
        updated_at: Date;
    }>;
    archive(farmId: string, userId: string, id: string, query: ArchiveFeedPlanQueryDto): Promise<{
        id: string;
        archived: boolean;
        removed_assignments: number;
    }>;
    apply(farmId: string, userId: string, id: string, dto: ApplyFeedPlanDto): Promise<{
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
}
