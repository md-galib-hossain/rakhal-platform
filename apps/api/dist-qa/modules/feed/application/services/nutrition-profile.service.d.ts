import { NutritionProfile, NutritionSource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { NutrientKey, NutritionValues } from '../../domain/nutrition-profile';
import { FeedLotResolver } from './feed-lot-resolver.service';
export interface CreateProfileInput {
    values: NutritionValues;
    nutritionSource?: NutritionSource;
    sourceRef?: string | null;
    note?: string | null;
    copiedFromIngredientId?: string | null;
    supersedesId?: string | null;
    trusted?: boolean;
}
export interface ReviseBatchInput {
    values: NutritionValues;
    nutritionSource?: NutritionSource;
    sourceRef?: string | null;
    note?: string | null;
    expectedUpdatedAt?: string;
    makeDefault?: boolean;
}
export declare class NutritionProfileService {
    private readonly prisma;
    private readonly resolver;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, resolver: FeedLotResolver, activityLog: ActivityLogService);
    create(farmId: string, userId: string, input: CreateProfileInput, tx?: Prisma.TransactionClient): Promise<NutritionProfile>;
    createFromIngredient(farmId: string, userId: string, ingredientId: string, tx?: Prisma.TransactionClient, supersedesId?: string): Promise<NutritionProfile>;
    get(farmId: string, id: string): Promise<NutritionProfile>;
    history(farmId: string, id: string, limit?: number): Promise<NutritionProfile[]>;
    differsFromCatalogue(farmId: string, profile: NutritionProfile): Promise<NutrientKey[] | null>;
    reviseBatch(farmId: string, userId: string, batchId: string, input: ReviseBatchInput): Promise<{
        batch: {
            id: string;
            nutritionProfileId: string;
        };
        profile: {
            farmId: string;
            id: string;
            createdAt: Date;
            createdBy: string;
            dmPct: number;
            cpPct: number;
            meMjPerKgDm: number;
            fatPct: number | null;
            ndfPct: number | null;
            adfPct: number | null;
            rdpPct: number | null;
            rupPct: number | null;
            starchPct: number | null;
            sugarsPct: number | null;
            calciumPct: number | null;
            phosphorusPct: number | null;
            tdnPct: number | null;
            nutritionSource: import("@prisma/client").$Enums.NutritionSource;
            sourceRef: string | null;
            note: string | null;
            supersedesId: string | null;
            copiedFromIngredientId: string | null;
        };
    }>;
    revertBatch(farmId: string, userId: string, batchId: string): Promise<{
        batch: {
            id: string;
            nutritionProfileId: string;
        };
        profile: {
            farmId: string;
            id: string;
            createdAt: Date;
            createdBy: string;
            dmPct: number;
            cpPct: number;
            meMjPerKgDm: number;
            fatPct: number | null;
            ndfPct: number | null;
            adfPct: number | null;
            rdpPct: number | null;
            rupPct: number | null;
            starchPct: number | null;
            sugarsPct: number | null;
            calciumPct: number | null;
            phosphorusPct: number | null;
            tdnPct: number | null;
            nutritionSource: import("@prisma/client").$Enums.NutritionSource;
            sourceRef: string | null;
            note: string | null;
            supersedesId: string | null;
            copiedFromIngredientId: string | null;
        };
    }>;
    resyncBatch(farmId: string, userId: string, batchId: string): Promise<{
        batch: {
            id: string;
            nutritionProfileId: string;
        };
        profile: {
            farmId: string;
            id: string;
            createdAt: Date;
            createdBy: string;
            dmPct: number;
            cpPct: number;
            meMjPerKgDm: number;
            fatPct: number | null;
            ndfPct: number | null;
            adfPct: number | null;
            rdpPct: number | null;
            rupPct: number | null;
            starchPct: number | null;
            sugarsPct: number | null;
            calciumPct: number | null;
            phosphorusPct: number | null;
            tdnPct: number | null;
            nutritionSource: import("@prisma/client").$Enums.NutritionSource;
            sourceRef: string | null;
            note: string | null;
            supersedesId: string | null;
            copiedFromIngredientId: string | null;
        };
    }>;
    private replaceBatchProfile;
    private audit;
}
