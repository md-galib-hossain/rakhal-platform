/**
 * Concentration-formula maths (PRD §12.4, RAKHAL-082). Pure — no framework/
 * Prisma. Given as-fed ingredient amounts and their effective nutrition,
 * computes per-item + total nutrient contributions and cost, a 0–100 balance
 * score against requirements, and a pragmatic "normalize" that scales amounts to
 * meet the dry-matter target (a full least-cost LP solver is deferred — TECH_DEBT).
 *
 * Nutrient convention (matches API §8): `dm_kg = asFed × dm% ; cp_kg/me/ndf/fat`
 * are computed **off the DM** (`cp%` etc. are per-kg-DM values).
 */
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
  cost_tk: number;
}

export interface FormulaTotals {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
  total_cost_tk: number;
}

export interface FormulaComputation {
  items: ItemContribution[];
  totals: FormulaTotals;
}

const round = (v: number) => Math.round(v * 100) / 100;

export function computeTotals(
  lines: FormulaLine[],
  effectiveById: Map<string, EffectiveIngredient>,
): FormulaComputation {
  const items: ItemContribution[] = [];
  const totals: FormulaTotals = {
    dm_kg: 0,
    cp_kg: 0,
    me_mj: 0,
    ndf_kg: 0,
    fat_kg: 0,
    total_cost_tk: 0,
  };

  for (const line of lines) {
    const eff = effectiveById.get(line.ingredientId);
    if (!eff) continue;
    const dm = line.amountKg * (eff.dmPct / 100);
    const item: ItemContribution = {
      ingredientId: line.ingredientId,
      amount_kg: round(line.amountKg),
      dm_kg: round(dm),
      cp_kg: round(dm * (eff.cpPct / 100)),
      me_mj: round(dm * eff.meMjPerKgDm),
      ndf_kg: round(dm * (eff.ndfPct / 100)),
      fat_kg: round(dm * (eff.fatPct / 100)),
      cost_tk: round(line.amountKg * eff.pricePerKg),
    };
    items.push(item);
    totals.dm_kg += item.dm_kg;
    totals.cp_kg += item.cp_kg;
    totals.me_mj += item.me_mj;
    totals.ndf_kg += item.ndf_kg;
    totals.fat_kg += item.fat_kg;
    totals.total_cost_tk += item.cost_tk;
  }

  return {
    items,
    totals: {
      dm_kg: round(totals.dm_kg),
      cp_kg: round(totals.cp_kg),
      me_mj: round(totals.me_mj),
      ndf_kg: round(totals.ndf_kg),
      fat_kg: round(totals.fat_kg),
      total_cost_tk: round(totals.total_cost_tk),
    },
  };
}

/**
 * 0–100 adequacy score across the three governing nutrients (DM, CP, ME): the
 * mean of `min(total/requirement, 1)`. Surplus is not penalised here (it just
 * caps at 100); a deficit pulls the score down proportionally.
 */
export function balanceScore(totals: FormulaTotals, req: Requirements): number {
  const ratios = [
    req.dmKg > 0 ? totals.dm_kg / req.dmKg : 1,
    req.cpKg > 0 ? totals.cp_kg / req.cpKg : 1,
    req.meMj > 0 ? totals.me_mj / req.meMj : 1,
  ].map((r) => Math.min(r, 1));
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(mean * 100);
}

/**
 * Pragmatic normalize (PRD §12.4 "Normalize to 100%"): scale every amount by a
 * single factor so total dry matter hits the requirement. A true least-cost
 * linear-programming solver (shift toward cheaper ingredients) is deferred.
 */
export function normalize(
  lines: FormulaLine[],
  req: Requirements,
  effectiveById: Map<string, EffectiveIngredient>,
): FormulaLine[] {
  const { totals } = computeTotals(lines, effectiveById);
  if (totals.dm_kg <= 0 || req.dmKg <= 0) {
    return lines.map((l) => ({ ...l, amountKg: round(l.amountKg) }));
  }
  const factor = req.dmKg / totals.dm_kg;
  return lines.map((l) => ({
    ingredientId: l.ingredientId,
    amountKg: round(l.amountKg * factor),
  }));
}
