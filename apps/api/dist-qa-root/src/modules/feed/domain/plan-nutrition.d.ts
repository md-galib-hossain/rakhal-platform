import { NutritionValues } from './nutrition-profile';
import { FitBands, FitSeverity } from './program-fit';
export interface PlanLineNutrition {
    kgPerDay: number;
    profile: NutritionValues | null;
}
export type SupplyKey = 'dm' | 'cp' | 'me' | 'fat' | 'ndf' | 'adf' | 'tdn' | 'calcium' | 'phosphorus' | 'starch' | 'rdp' | 'rup';
export interface NutrientSupply {
    value: number;
    measured: boolean;
}
export interface PlanRequirement {
    dm_kg: number;
    cp_kg: number;
    me_mj: number;
    fat_kg: number;
    ndf_kg: number;
    ndf_max_kg: number;
    adf_kg: number;
    tdn_kg: number;
    calcium_kg: number | null;
    phosphorus_kg: number | null;
    rdp_pct: number;
    rup_pct: number;
    ca_p_ratio_target: number;
}
export type NutrientRowKey = 'dm' | 'cp' | 'me' | 'fat' | 'ndf' | 'adf' | 'tdn' | 'calcium' | 'phosphorus' | 'ca_p_ratio' | 'rdp_pct' | 'rup_pct' | 'starch';
export type NutrientSeverity = FitSeverity | 'unknown';
export interface NutrientRow {
    key: NutrientRowKey;
    unit: 'kg' | 'MJ' | '% of CP' | ': 1';
    supply: number | null;
    requirement: number | null;
    max: number | null;
    delta_pct: number | null;
    severity: NutrientSeverity;
    measured: boolean;
}
export declare function computeNutrientSupply(lines: PlanLineNutrition[]): Record<SupplyKey, NutrientSupply>;
export declare function buildNutrientRows(supply: Record<SupplyKey, NutrientSupply>, req: PlanRequirement, bands: FitBands): NutrientRow[];
