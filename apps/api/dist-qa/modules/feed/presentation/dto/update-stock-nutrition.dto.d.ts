import { NutritionSource } from '@prisma/client';
export declare class UpdateStockNutritionDto {
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
    nutritionSource?: NutritionSource;
    sourceRef?: string;
}
