import { FeedPlanLine, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateFeedPlanDto, FeedPlanFitQueryDto, ListFeedPlansQueryDto, PreviewPlanFitDto, UpdateFeedPlanDto } from '../../presentation/dto/feed-plan.dto';
import { FeedLotResolver } from './feed-lot-resolver.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedPlanAssignmentService } from './feed-plan-assignment.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { PlanRequirement } from '../../domain/plan-nutrition';
import { NutritionValues } from '../../domain/nutrition-profile';
export declare class FeedPlanService {
    private readonly prisma;
    private readonly requirements;
    private readonly lotResolver;
    private readonly assignments;
    private readonly programs;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, requirements: FeedRequirementsService, lotResolver: FeedLotResolver, assignments: FeedPlanAssignmentService, programs: FeedPlanResolverService);
    create(farmId: string, userId: string, dto: CreateFeedPlanDto): Promise<{
        id: string;
        name: string;
        kind: import("@prisma/client").$Enums.FeedPlanKind;
        notes: string | null;
        made_for_cattle_id: string | null;
        made_for_animal_group_id: string | null;
        reference_requirement: Prisma.JsonValue;
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
        reference_requirement: Prisma.JsonValue;
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
    list(farmId: string, query: ListFeedPlansQueryDto): Promise<{
        items: {
            id: string;
            name: string;
            kind: import("@prisma/client").$Enums.FeedPlanKind;
            notes: string | null;
            made_for_cattle_id: string | null;
            made_for_animal_group_id: string | null;
            reference_requirement: Prisma.JsonValue;
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
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    get(farmId: string, id: string): Promise<{
        id: string;
        name: string;
        kind: import("@prisma/client").$Enums.FeedPlanKind;
        notes: string | null;
        made_for_cattle_id: string | null;
        made_for_animal_group_id: string | null;
        reference_requirement: Prisma.JsonValue;
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
    archive(farmId: string, userId: string, id: string, removeAssignments?: boolean): Promise<{
        id: string;
        archived: boolean;
        removed_assignments: number;
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
            nutrition: NutritionValues | null;
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
            requirement_full: PlanRequirement;
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
        requirement_full: PlanRequirement;
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
            nutrition: NutritionValues | null;
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
    private fitBuilder;
    programForCattle(farmId: string, cattleId: string): Promise<{
        program: null;
    } | {
        program: {
            assignment_id: string;
            plan_id: string;
            plan_name: string;
            kind: import("@prisma/client").$Enums.FeedPlanKind;
            via: import("./feed-plan-resolver.service").ProgramVia;
            group_id: string | null;
            conflict: boolean;
            lines: {
                line_id: string;
                line_type: import("@prisma/client").$Enums.FeedPlanLineType;
                name: string;
                kg_per_day: number;
                source: {
                    source_type: "FEED_ITEM" | "FEED_STOCK";
                    feed_item_id: string | null;
                    feed_stock_id: string | null;
                } | null;
                density: {
                    dm_pct: number;
                    cp_pct: number;
                    me_mj_per_kg_dm: number;
                } | null;
                stock_ok: boolean;
            }[];
        };
    }>;
    resolveSupply(farmId: string, plan: {
        lines: FeedPlanLine[];
    }): Promise<{
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
        nutrition: NutritionValues | null;
        supply: {
            as_fed_kg: number;
            dm_kg: number | null;
            cp_kg: number | null;
            me_mj: number | null;
        };
    }[]>;
    private findActive;
    private lineRows;
    private toLineDto;
    private validateLines;
    private namesFor;
    private assertMadeFor;
    private captureReference;
    private mapConflict;
    private mapPlan;
}
