import { FeedConcentrationKind, NutritionSource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FeedLotResolver } from './feed-lot-resolver.service';
import { NutritionProfileService } from './nutrition-profile.service';
export interface StockNutritionSnapshot {
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct: number;
    ndfPct: number;
    rdpPct: number;
    rupPct: number;
    starchPct: number;
    adfPct: number;
    calciumPct: number;
    phosphorusPct: number;
    tdnPct: number;
}
export declare class FeedStockService {
    private readonly prisma;
    private readonly profiles;
    private readonly resolver;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, profiles: NutritionProfileService, resolver: FeedLotResolver);
    produceFromConcentration(farmId: string, userId: string, params: {
        concentrationId: string;
        version: number;
        qtyKg: number;
        costTk: number;
        nutrition: StockNutritionSnapshot;
        kind: FeedConcentrationKind;
    }, tx?: Prisma.TransactionClient): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    assertSufficientStock(farmId: string, requests: {
        stockId: string;
        quantity: number;
    }[]): Promise<void>;
    decrementForDistribution(farmId: string, userId: string, opts: {
        stockId: string;
        quantity: number;
        distributionId?: string;
    }, tx?: Prisma.TransactionClient): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    updateNutrition(farmId: string, userId: string, id: string, patch: Partial<StockNutritionSnapshot> & {
        nutritionSource?: NutritionSource;
        sourceRef?: string | null;
    }): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    list(farmId: string, includeArchived?: boolean): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }[]>;
    archive(farmId: string, id: string): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    removeMany(farmId: string, ids: string[]): Promise<{
        deleted: number;
    }>;
    get(farmId: string, id: string): Promise<{
        movements: {
            id: string;
            change_kg: number;
            reason: import("@prisma/client").$Enums.FeedStockMovementReason;
            distribution_id: string | null;
            created_at: Date;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    private mapStock;
}
