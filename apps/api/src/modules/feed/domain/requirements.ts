/**
 * Dairy-cow daily nutritional requirements (PRD §12.4, RAKHAL-081). Pure
 * function — no framework/Prisma. Uses **simplified NRC/INRA-derived** formulas
 * (maintenance + production) suitable for an MVP ration planner; a full ration
 * balancer (NRC 2001 / INRA 2018 with all adjustments) is deferred (TECH_DEBT).
 *
 * All outputs are per cow per day. `cpKg`/`ndfKg`/`fatKg` are kg of the nutrient;
 * `meMj` is metabolizable energy in MJ; `dmKg` is dry-matter intake.
 */

export interface RequirementsInput {
  /** Body weight (kg). */
  weightKg: number;
  /** Target daily milk yield (litres). */
  milkTargetL: number;
  /** Milk fat % (optional; lightly adjusts energy). Defaults to 4.0. */
  milkFatPct?: number;
}

export interface Requirements {
  dmKg: number;
  cpKg: number;
  meMj: number;
  ndfKg: number;
  fatKg: number;
}

// --- simplified NRC/INRA-derived constants (documented for review) ---
const MAINT_DMI_FRACTION = 0.025; // DM intake for maintenance ≈ 2.5% of body weight
const DMI_PER_LITRE = 0.1; // + ~0.10 kg DM per litre of milk
const ME_MAINT_PER_KG075 = 0.49; // maintenance ME (MJ) per kg^0.75 metabolic weight
const ME_PER_LITRE_AT_4PCT = 5.0; // production ME (MJ) per litre at 4% fat
const ME_PER_FAT_POINT = 0.25; // ± MJ/L per 1% fat above/below 4%
const CP_MAINT_G_PER_KG075 = 3.8; // maintenance crude protein (g) per kg^0.75
const CP_G_PER_LITRE = 85; // production crude protein (g) per litre
const NDF_FRACTION_OF_DMI = 0.3; // minimum NDF ≈ 30% of dry-matter intake
const FAT_FRACTION_OF_DMI = 0.04; // dietary fat target ≈ 4% of dry-matter intake

const round = (v: number) => Math.round(v * 100) / 100;

export function computeRequirements(input: RequirementsInput): Requirements {
  const bw = Math.max(0, input.weightKg);
  const milk = Math.max(0, input.milkTargetL);
  const fat = input.milkFatPct ?? 4.0;
  const metabolicWeight = Math.pow(bw, 0.75);

  const dmKg = MAINT_DMI_FRACTION * bw + DMI_PER_LITRE * milk;

  const mePerLitre = ME_PER_LITRE_AT_4PCT + (fat - 4) * ME_PER_FAT_POINT;
  const meMj = ME_MAINT_PER_KG075 * metabolicWeight + mePerLitre * milk;

  const cpGrams =
    CP_MAINT_G_PER_KG075 * metabolicWeight + CP_G_PER_LITRE * milk;
  const cpKg = cpGrams / 1000;

  const ndfKg = NDF_FRACTION_OF_DMI * dmKg;
  const fatKg = FAT_FRACTION_OF_DMI * dmKg;

  return {
    dmKg: round(dmKg),
    cpKg: round(cpKg),
    meMj: round(meMj),
    ndfKg: round(ndfKg),
    fatKg: round(fatKg),
  };
}
