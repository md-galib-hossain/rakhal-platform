import { NutritionSource } from '@prisma/client';
export declare class NutritionInputDto {
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct?: number | null;
    ndfPct?: number | null;
    adfPct?: number | null;
    rdpPct?: number | null;
    rupPct?: number | null;
    starchPct?: number | null;
    sugarsPct?: number | null;
    calciumPct?: number | null;
    phosphorusPct?: number | null;
    tdnPct?: number | null;
    nutritionSource?: NutritionSource;
    sourceRef?: string;
    note?: string;
}
