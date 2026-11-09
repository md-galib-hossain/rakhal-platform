import { FeedNutrientGroup } from '@prisma/client';
export declare class UpdateCustomIngredientDto {
    name?: string;
    nutrientGroup?: FeedNutrientGroup;
    pricePerKg?: number;
    dmPct?: number;
    cpPct?: number;
    meMjPerKgDm?: number;
    fatPct?: number;
    ndfPct?: number;
    rdpPct?: number;
    rupPct?: number;
    starchPct?: number;
    adfPct?: number;
    calciumPct?: number;
    phosphorusPct?: number;
    tdnPct?: number;
}
