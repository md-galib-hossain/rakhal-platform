export type NutritionSource = 'REFERENCE' | 'MANUFACTURER' | 'LAB' | 'FARM_ESTIMATE';
export interface CatalogueIngredient {
    id: string;
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct: number | null;
    ndfPct: number | null;
    rdpPct: number | null;
    rupPct: number | null;
    starchPct: number | null;
    adfPct: number | null;
    calciumPct: number | null;
    phosphorusPct: number | null;
    tdnPct: number | null;
    currentPricePerKg: number;
    nutritionSource?: NutritionSource;
}
export interface IngredientOverride {
    customPricePerKg: number | null;
    customDmPct: number | null;
    customCpPct: number | null;
    customMeMjPerKgDm: number | null;
    customFatPct: number | null;
    customNdfPct: number | null;
    customRdpPct: number | null;
    customRupPct: number | null;
    customStarchPct: number | null;
    customAdfPct: number | null;
    customCalciumPct: number | null;
    customPhosphorusPct: number | null;
    customTdnPct: number | null;
    nutritionSource?: NutritionSource | null;
}
export type PriceSource = 'rakhal_market' | 'farm_override';
export interface EffectiveIngredient {
    id: string;
    pricePerKg: number;
    priceSource: PriceSource;
    hasNutritionOverride: boolean;
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
    nutritionSource: NutritionSource;
}
export declare function resolveEffective(ingredient: CatalogueIngredient, override?: IngredientOverride | null): EffectiveIngredient;
