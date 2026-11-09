import { EffectiveIngredient } from './ingredient-resolver';
import { Requirements } from './requirements';
export interface FormulaLine {
    ingredientId: string;
    amountKg: number;
}
export interface ItemContribution {
    ingredientId: string;
    amount_kg: number;
    dm_kg: number;
    cp_kg: number;
    me_mj: number;
    ndf_kg: number;
    fat_kg: number;
    rdp_kg: number;
    rup_kg: number;
    starch_kg: number;
    adf_kg: number;
    calcium_kg: number;
    phosphorus_kg: number;
    tdn_kg: number;
    cost_tk: number;
}
export interface FormulaTotals {
    dm_kg: number;
    cp_kg: number;
    me_mj: number;
    ndf_kg: number;
    fat_kg: number;
    rdp_kg: number;
    rup_kg: number;
    starch_kg: number;
    adf_kg: number;
    calcium_kg: number;
    phosphorus_kg: number;
    tdn_kg: number;
    total_cost_tk: number;
}
export interface FormulaComputation {
    items: ItemContribution[];
    totals: FormulaTotals;
}
export declare function computeTotals(lines: FormulaLine[], effectiveById: Map<string, EffectiveIngredient>): FormulaComputation;
export declare function balanceScore(totals: FormulaTotals, req: Requirements): number;
export declare function normalize(lines: FormulaLine[], req: Requirements, effectiveById: Map<string, EffectiveIngredient>): FormulaLine[];
