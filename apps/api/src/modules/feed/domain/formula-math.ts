/**
 * Concentration-formula maths (PRD §12.4, RAKHAL-082). Pure — no framework/
 * Prisma. Given as-fed ingredient amounts and their effective nutrition,
 * computes per-item + total nutrient contributions and cost, a 0–100 balance
 * score against requirements, and a pragmatic "normalize" that scales amounts to
 * meet the dry-matter target (a full least-cost LP solver is deferred — TECH_DEBT).
 *
 * Nutrient convention (matches API §8 and `ingredient-resolver.ts`): `dm_kg =
 * asFed × dm%`; `cp_kg`/`me_mj`/`ndf_kg`/`fat_kg`/`starch_kg`/`adf_kg`/
 * `calcium_kg`/`phosphorus_kg`/`tdn_kg` are all computed **off the DM**
 * (per-kg-DM rates). `rdp_kg`/`rup_kg` are the one exception — computed off
 * `cp_kg` (they're a % of crude protein, not of DM) — keeping contribution-kg
 * and rate-% structurally distinct per-field is what prevents the classic
 * spreadsheet bug of a kg total getting mislabeled as a percentage.
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

const round = (v: number) => Math.round(v * 100) / 100;

const emptyTotals = (): FormulaTotals => ({
  dm_kg: 0,
  cp_kg: 0,
  me_mj: 0,
  ndf_kg: 0,
  fat_kg: 0,
  rdp_kg: 0,
  rup_kg: 0,
  starch_kg: 0,
  adf_kg: 0,
  calcium_kg: 0,
  phosphorus_kg: 0,
  tdn_kg: 0,
  total_cost_tk: 0,
});

export function computeTotals(
  lines: FormulaLine[],
  effectiveById: Map<string, EffectiveIngredient>,
): FormulaComputation {
  const items: ItemContribution[] = [];
  const totals = emptyTotals();

  for (const line of lines) {
    const eff = effectiveById.get(line.ingredientId);
    if (!eff) continue;
    const dm = line.amountKg * (eff.dmPct / 100);
    const cpKg = dm * (eff.cpPct / 100);
    const item: ItemContribution = {
      ingredientId: line.ingredientId,
      amount_kg: round(line.amountKg),
      dm_kg: round(dm),
      cp_kg: round(cpKg),
      me_mj: round(dm * eff.meMjPerKgDm),
      ndf_kg: round(dm * (eff.ndfPct / 100)),
      fat_kg: round(dm * (eff.fatPct / 100)),
      // RDP/RUP are % of CP, not % of DM — contribution comes off cp_kg.
      rdp_kg: round(cpKg * (eff.rdpPct / 100)),
      rup_kg: round(cpKg * (eff.rupPct / 100)),
      starch_kg: round(dm * (eff.starchPct / 100)),
      adf_kg: round(dm * (eff.adfPct / 100)),
      calcium_kg: round(dm * (eff.calciumPct / 100)),
      phosphorus_kg: round(dm * (eff.phosphorusPct / 100)),
      tdn_kg: round(dm * (eff.tdnPct / 100)),
      cost_tk: round(line.amountKg * eff.pricePerKg),
    };
    items.push(item);
    totals.dm_kg += item.dm_kg;
    totals.cp_kg += item.cp_kg;
    totals.me_mj += item.me_mj;
    totals.ndf_kg += item.ndf_kg;
    totals.fat_kg += item.fat_kg;
    totals.rdp_kg += item.rdp_kg;
    totals.rup_kg += item.rup_kg;
    totals.starch_kg += item.starch_kg;
    totals.adf_kg += item.adf_kg;
    totals.calcium_kg += item.calcium_kg;
    totals.phosphorus_kg += item.phosphorus_kg;
    totals.tdn_kg += item.tdn_kg;
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
      rdp_kg: round(totals.rdp_kg),
      rup_kg: round(totals.rup_kg),
      starch_kg: round(totals.starch_kg),
      adf_kg: round(totals.adf_kg),
      calcium_kg: round(totals.calcium_kg),
      phosphorus_kg: round(totals.phosphorus_kg),
      tdn_kg: round(totals.tdn_kg),
      total_cost_tk: round(totals.total_cost_tk),
    },
  };
}

/**
 * 0–100 adequacy score across the three governing nutrients (DM, CP, ME): the
 * mean of `min(total/requirement, 1)`. Surplus is not penalised here (it just
 * caps at 100); a deficit pulls the score down proportionally. Deliberately
 * NOT expanded to the fuller nutrient set added alongside this function (ADF/
 * RDP/RUP/Ca/P/TDN) — that's a product decision on which nutrients "govern"
 * the score, not made here.
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
