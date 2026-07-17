/**
 * Dairy-cow daily nutritional requirements (PRD §12.4, RAKHAL-081). Pure
 * function — no framework/Prisma. Uses **simplified NRC/INRA-derived** formulas
 * (maintenance + production) suitable for an MVP ration planner; a full ration
 * balancer (NRC 2001 / INRA 2018 with all adjustments) is deferred (TECH_DEBT).
 *
 * All outputs are per cow per day. `cpKg`/`ndfKg`/`fatKg` are kg of the nutrient;
 * `meMj` is metabolizable energy in MJ; `dmKg` is dry-matter intake.
 *
 * Two additive terms (2026-07-17, user request — cow-driven requirements): a
 * **late-gestation** addend keyed off `gestationDays` and a **BCS-deviation**
 * adjustment keyed off `bcs`. Both are simplified linear stand-ins for the real
 * NRC fetal-growth-curve / body-reserve-mobilization models, documented the same
 * way as the constants above — not research-grade, a placeholder for later
 * refinement. No separate lactation-stage term: early-lactation energy demand
 * is already captured by the *measured* milk-yield input feeding the production
 * terms above — a redundant stage multiplier on top would double-count it.
 */

export interface RequirementsInput {
  /** Body weight (kg). */
  weightKg: number;
  /** Target daily milk yield (litres). */
  milkTargetL: number;
  /** Milk fat % (optional; lightly adjusts energy). Defaults to 4.0. */
  milkFatPct?: number;
  /** Days into gestation (optional). Adds a late-gestation ME/CP addend once ≥190 days. */
  gestationDays?: number;
  /** Body Condition Score, 1.0–5.0 scale (optional). Adjusts maintenance ME for deviation from target. */
  bcs?: number;
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

// --- late-gestation addend (simplified linear ramp, NOT a full fetal-growth curve) ---
const LATE_GESTATION_ONSET_DAY = 190; // last ~13 weeks of a ~280-day gestation
const LATE_GESTATION_FULL_TERM_DAY = 280;
const LATE_GESTATION_PEAK_ME_MJ = 8.4; // extra ME/day at day 280 (linear from 0 at day 190)
const LATE_GESTATION_PEAK_CP_KG = 0.5; // extra CP (kg)/day at day 280

// --- BCS-deviation adjustment (simplified linear stand-in, NOT a reserve-mobilization model) ---
const TARGET_BCS = 3.0; // farm's 1.0–5.0 / 0.25-step scale
const ME_ADJUST_PCT_PER_QUARTER_BCS = 0.03; // ±3% of maintenance ME per 0.25 BCS unit deviation

const round = (v: number) => Math.round(v * 100) / 100;

function lateGestationAddend(gestationDays: number | undefined): {
  meMj: number;
  cpKg: number;
} {
  if (gestationDays == null || gestationDays < LATE_GESTATION_ONSET_DAY) {
    return { meMj: 0, cpKg: 0 };
  }
  const span = LATE_GESTATION_FULL_TERM_DAY - LATE_GESTATION_ONSET_DAY;
  const progress =
    Math.min(gestationDays, LATE_GESTATION_FULL_TERM_DAY) -
    LATE_GESTATION_ONSET_DAY;
  const fraction = span > 0 ? progress / span : 0;
  return {
    meMj: LATE_GESTATION_PEAK_ME_MJ * fraction,
    cpKg: LATE_GESTATION_PEAK_CP_KG * fraction,
  };
}

function bcsMaintenanceMultiplier(bcs: number | undefined): number {
  if (bcs == null) return 1;
  const deviationQuarters = (TARGET_BCS - bcs) / 0.25; // below target → positive → higher requirement
  const adjust = deviationQuarters * ME_ADJUST_PCT_PER_QUARTER_BCS;
  return Math.max(0, 1 + adjust);
}

export function computeRequirements(input: RequirementsInput): Requirements {
  const bw = Math.max(0, input.weightKg);
  const milk = Math.max(0, input.milkTargetL);
  const fat = input.milkFatPct ?? 4.0;
  const metabolicWeight = Math.pow(bw, 0.75);

  const dmKg = MAINT_DMI_FRACTION * bw + DMI_PER_LITRE * milk;

  const mePerLitre = ME_PER_LITRE_AT_4PCT + (fat - 4) * ME_PER_FAT_POINT;
  const meMaintenance =
    ME_MAINT_PER_KG075 * metabolicWeight * bcsMaintenanceMultiplier(input.bcs);
  const gestation = lateGestationAddend(input.gestationDays);
  const meMj = meMaintenance + mePerLitre * milk + gestation.meMj;

  const cpGrams =
    CP_MAINT_G_PER_KG075 * metabolicWeight + CP_G_PER_LITRE * milk;
  const cpKg = cpGrams / 1000 + gestation.cpKg;

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
