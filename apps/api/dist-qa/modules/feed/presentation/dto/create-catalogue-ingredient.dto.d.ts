import { FeedClass, FeedSubType, NutritionSource } from '@prisma/client';
export declare class CreateCatalogueIngredientDto {
    nameEn: string;
    nameBn?: string;
    feedClass: FeedClass;
    feedSubType?: FeedSubType;
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct?: number;
    ndfPct?: number;
    rdpPct?: number;
    rupPct?: number;
    starchPct?: number;
    adfPct?: number;
    calciumPct?: number;
    phosphorusPct?: number;
    tdnPct?: number;
    currentPricePerKg: number;
    nutritionSourceNote?: string;
    nutritionSource?: NutritionSource;
    sourceRef?: string;
    isAvailableBd?: boolean;
}
