export type NutritionSourceKind = 'REFERENCE' | 'MANUFACTURER' | 'LAB' | 'FARM_ESTIMATE';
export declare const CORE_NUTRIENT_KEYS: readonly ["dmPct", "cpPct", "meMjPerKgDm"];
export declare const OPTIONAL_NUTRIENT_KEYS: readonly ["fatPct", "ndfPct", "adfPct", "rdpPct", "rupPct", "starchPct", "sugarsPct", "calciumPct", "phosphorusPct", "tdnPct"];
export declare const NUTRIENT_KEYS: readonly ["dmPct", "cpPct", "meMjPerKgDm", "fatPct", "ndfPct", "adfPct", "rdpPct", "rupPct", "starchPct", "sugarsPct", "calciumPct", "phosphorusPct", "tdnPct"];
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export interface NutritionValues {
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
}
export declare const ME_MAX_MJ_PER_KG_DM = 40;
export declare function toNutritionValues(input: Partial<Record<NutrientKey, number | null | undefined>> & Pick<NutritionValues, 'dmPct' | 'cpPct' | 'meMjPerKgDm'>): NutritionValues;
export declare function validateNutrition(v: NutritionValues): string[];
type CatalogueNutrients = Pick<NutritionValues, 'dmPct' | 'cpPct' | 'meMjPerKgDm'> & Partial<Record<(typeof OPTIONAL_NUTRIENT_KEYS)[number], number | null>>;
type OverrideNutrients = Partial<Record<`custom${Capitalize<NutrientKey>}`, number | null | undefined>>;
export declare function mergeCatalogueNutrition(ingredient: CatalogueNutrients, override?: OverrideNutrients | null): NutritionValues;
export declare const moisturePctFromDm: (dmPct: number) => number;
export declare function blendNutrition(parts: {
    kg: number;
    values: NutritionValues;
}[]): NutritionValues;
export declare function diffNutrition(a: NutritionValues, b: NutritionValues, epsilon?: number): NutrientKey[];
export {};
