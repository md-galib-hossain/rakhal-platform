import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { FeedDrawPlan, FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { LogDistributionDto } from '../../presentation/dto/log-distribution.dto';
import { PatchRefusalDto } from '../../presentation/dto/patch-refusal.dto';
import { FeedEfficiencyQueryDto, ListDistributionQueryDto } from '../../presentation/dto/list-distribution-query.dto';
import { FeedStockService } from './feed-stock.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedLotResolver } from './feed-lot-resolver.service';
export declare class FeedDistributionService {
    private readonly prisma;
    private readonly feedStock;
    private readonly planResolver;
    private readonly feedRequirements;
    private readonly lotResolver;
    private readonly feedItems;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, feedStock: FeedStockService, planResolver: FeedPlanResolverService, feedRequirements: FeedRequirementsService, lotResolver: FeedLotResolver, feedItems: FeedItemService, clock: FarmClockService);
    create(farmId: string, userId: string, dto: LogDistributionDto): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    computeFeedItemUsage(farmId: string, feedItemId: string, quantityKg: number, tx?: Prisma.TransactionClient, pinBatchId?: string): Promise<{
        plan: FeedDrawPlan;
        feedItem: {
            name: string;
            farmId: string;
            supplier: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            notes: string | null;
            createdBy: string;
            unitId: string;
            lowStockThreshold: number;
            feedClass: import("@prisma/client").$Enums.FeedClass;
            feedSubType: import("@prisma/client").$Enums.FeedSubType | null;
            ingredientId: string | null;
            defaultNutritionProfileId: string | null;
            kgPerUnit: number | null;
        } & {
            unit: import("@prisma/client").Unit;
            batches: ({
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                notes: string | null;
                createdBy: string;
                purchaseDate: Date;
                batchCode: string | null;
                currentStock: number;
                costPerUnit: number;
                feedItemId: string;
                nutritionProfileId: string;
            } & {
                nutritionProfile: import("@prisma/client").NutritionProfile;
            })[];
        };
        ingredientId: string;
        ingredientName: string;
        pricePerKg: number;
    }>;
    list(farmId: string, query: ListDistributionQueryDto): Promise<{
        items: {
            id: string;
            concentration_id: string | null;
            cattle_id: string | null;
            distributed_at: Date;
            total_actual_kg: number;
            total_actual_cost: number;
            created_at: Date;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    get(farmId: string, id: string): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    patchRefusal(farmId: string, id: string, dto: PatchRefusalDto): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    efficiency(farmId: string, query: FeedEfficiencyQueryDto): Promise<{
        distributions: number;
        planned_kg: number;
        actual_kg: number;
        refusal_kg: number;
        consumed_kg: number;
        planned_cost: number;
        actual_cost: number;
        adherence_pct: number | null;
        refusal_pct: number | null;
        litres_produced: number;
        feed_cost_per_litre: number | null;
        cattle_id: string;
        cattle_name: string;
        period: string;
    }>;
    getDmiComparison(farmId: string, cattleId: string, date?: string): Promise<{
        expected_dmi_kg: number;
        actual_dmi_kg: number | null;
        delta_pct: number | null;
        match_level: string | null;
        program: {
            plan_id: string;
            plan_name: string;
            via: import("./feed-plan-resolver.service").ProgramVia;
            conflict: boolean;
        } | null;
    }>;
    getFarmFeedCostSummary(farmId: string, days?: number): Promise<{
        days: number;
        total_cost: number;
        cost_per_cow_per_day: number | null;
        cost_per_litre: number | null;
        headcount: number;
        total_litres: number;
        trend: {
            date: string;
            total_cost: number;
        }[];
    }>;
    private readonly EFFICIENCY_DISTRIBUTION_SELECT;
    private summarizeEfficiency;
    private planFeedItemDraws;
    getEffectiveNutrition(farmId: string, ingredientId: string): Promise<import("../../domain/ingredient-resolver").EffectiveIngredient | null>;
    private effectiveMap;
    private ingredientNames;
    private mapDistribution;
    private mapSummary;
    private dayStart;
    private dateRange;
    private monthRange;
}
