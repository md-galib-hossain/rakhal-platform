/**
 * Client-side mirror of the backend's pure `formula-math.ts` (Repos/rakhal-backend
 * `src/modules/feed/domain/formula-math.ts`) — duplicated intentionally (not imported, this is a
 * separate Next.js app) so the ingredient table can show a *live* per-keystroke preview (contribution
 * per line, balance score, normalize) without a round trip per edit. The server-computed values from
 * `POST /feed/concentrations` / `POST /feed/concentrations/normalize` remain the source of truth on
 * save — this is a preview only. Kept in exact numeric lockstep with the backend: same rounding
 * (2dp), same "mean of capped DM/CP/ME ratios" balance formula, same DM-scaling normalize.
 *
 * Real gap vs the Figma ingredient table (`1065:35817`), flagged not computed at all: the mock shows
 * RDP(kg)/RUP(kg) sub-columns under Protein and STR(kg)/SUG(kg) under Energy/Fibers — but neither
 * `feed-ingredient.service.ts#listMerged`'s `nutrition` object nor the backend's own
 * `ItemContribution` type carries RDP%/RUP%/starch%/sugars% at all (only dm/cp/me/ndf/fat), so there
 * is no real number to show in those columns. Dropped entirely rather than rendering fabricated
 * zeros — this table only shows DM/CP/ME/FAT/NDF, the columns the backend actually computes.
 */

export interface EffectiveIngredientNutrition {
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number | null;
  ndfPct: number | null;
  pricePerKg: number;
}

export interface FormulaLine {
  ingredientId: string;
  amountKg: number;
}

export interface ItemContribution {
  ingredientId: string;
  amountKg: number;
  dmKg: number;
  cpKg: number;
  meMj: number;
  fatKg: number;
  ndfKg: number;
  costTk: number;
}

export interface FormulaTotals {
  dmKg: number;
  cpKg: number;
  meMj: number;
  fatKg: number;
  ndfKg: number;
  totalCostTk: number;
}

export interface Requirements {
  dmKg: number;
  cpKg: number;
  meMj: number;
  ndfKg: number;
  fatKg: number;
}

/** `GET /feed/requirements` / `feed_concentration.requirements` are snake_case (see `types.ts`'s
 * doc comment on why) — this maps them into the camelCase shape this module's pure functions use. */
export function fromApiRequirements(r: {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
}): Requirements {
  return { dmKg: r.dm_kg, cpKg: r.cp_kg, meMj: r.me_mj, ndfKg: r.ndf_kg, fatKg: r.fat_kg };
}

const round = (v: number) => Math.round(v * 100) / 100;

export function computeTotals(
  lines: FormulaLine[],
  effectiveById: Map<string, EffectiveIngredientNutrition>,
): { items: ItemContribution[]; totals: FormulaTotals } {
  const items: ItemContribution[] = [];
  const totals: FormulaTotals = { dmKg: 0, cpKg: 0, meMj: 0, fatKg: 0, ndfKg: 0, totalCostTk: 0 };

  for (const line of lines) {
    const eff = effectiveById.get(line.ingredientId);
    if (!eff) continue;
    const dm = line.amountKg * (eff.dmPct / 100);
    const item: ItemContribution = {
      ingredientId: line.ingredientId,
      amountKg: round(line.amountKg),
      dmKg: round(dm),
      cpKg: round(dm * (eff.cpPct / 100)),
      meMj: round(dm * eff.meMjPerKgDm),
      fatKg: round(dm * ((eff.fatPct ?? 0) / 100)),
      ndfKg: round(dm * ((eff.ndfPct ?? 0) / 100)),
      costTk: round(line.amountKg * eff.pricePerKg),
    };
    items.push(item);
    totals.dmKg += item.dmKg;
    totals.cpKg += item.cpKg;
    totals.meMj += item.meMj;
    totals.fatKg += item.fatKg;
    totals.ndfKg += item.ndfKg;
    totals.totalCostTk += item.costTk;
  }

  return {
    items,
    totals: {
      dmKg: round(totals.dmKg),
      cpKg: round(totals.cpKg),
      meMj: round(totals.meMj),
      fatKg: round(totals.fatKg),
      ndfKg: round(totals.ndfKg),
      totalCostTk: round(totals.totalCostTk),
    },
  };
}

export function balanceScore(totals: FormulaTotals, req: Requirements): number {
  const ratios = [
    req.dmKg > 0 ? totals.dmKg / req.dmKg : 1,
    req.cpKg > 0 ? totals.cpKg / req.cpKg : 1,
    req.meMj > 0 ? totals.meMj / req.meMj : 1,
  ].map((r) => Math.min(r, 1));
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(mean * 100);
}

export function normalize(
  lines: FormulaLine[],
  req: Requirements,
  effectiveById: Map<string, EffectiveIngredientNutrition>,
): FormulaLine[] {
  const { totals } = computeTotals(lines, effectiveById);
  if (totals.dmKg <= 0 || req.dmKg <= 0) {
    return lines.map((l) => ({ ...l, amountKg: round(l.amountKg) }));
  }
  const factor = req.dmKg / totals.dmKg;
  return lines.map((l) => ({ ingredientId: l.ingredientId, amountKg: round(l.amountKg * factor) }));
}

/** 100 → success, 70-99 → warning, below → destructive — matches the Figma sample data exactly
 * (100%→green, 98%→amber, 48%→red); this specific 70/100 split isn't specified anywhere in the
 * backend (which only returns the 0-100 number), it's this UI's own adequacy-band choice. */
export function balanceScoreBand(score: number): "success" | "warning" | "destructive" {
  if (score >= 100) return "success";
  if (score >= 70) return "warning";
  return "destructive";
}
