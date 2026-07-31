/**
 * Dairy-cow daily nutritional requirements (PRD §12.4/§12.8, RAKHAL-081/258). Pure
 * function — no framework/Prisma.
 *
 * v2 (2026-07-31, RAKHAL-258) upgrades the original simplified NRC/INRA formula to an
 * NRC-2001-grade model, per the competitor study in `docs/COMPETITIVE_FEED_ANALYSIS.md`
 * (benchmarked against sakil.dev/dairy-nutrition-calculator). All outputs remain per cow
 * per day. Coefficients are documented NRC-2001-style approximations and still need a
 * nutritionist sign-off before launch (carries forward the RD-015(a) caveat) — the
 * *shape* of the model (FCM/DIM intake, a pregnancy-stage table, a continuous pregnancy
 * curve, diet-density targets) is the point of this revision, not the exact constants.
 *
 * Backward compatibility: `dmKg`/`cpKg`/`meMj`/`ndfKg`/`fatKg` keep their v1 names and
 * units, but their *values* now come from the v2 model — callers comparing absolute
 * numbers against the old formula will see a shift (documented in the competitor-analysis
 * divergence table). All other fields are additive.
 */

export type AnimalType = 'COW' | 'HEIFER' | 'DRY';

export interface RequirementsInput {
  /** Body weight (kg). */
  weightKg: number;
  /** Target daily milk yield (litres). */
  milkTargetL: number;
  /** Milk fat % (optional; lightly adjusts energy). Defaults to 4.0. */
  milkFatPct?: number;
  /** Milk protein % (optional; currently informational only — no CP model term yet). */
  milkProteinPct?: number;
  /** Days into gestation (optional). Drives the pregnancy-stage DM table and the continuous ME/CP curve. */
  gestationDays?: number;
  /** Body Condition Score, 1.0–5.0 scale (optional). Adjusts maintenance ME and DM intake for deviation from target. */
  bcs?: number;
  /** Days in milk (optional). Feeds the NRC-2001 lactation-curve DMI term; omitted defaults to a mid-lactation curve. */
  dim?: number;
  /** Animal class (optional, defaults to COW). HEIFER adds a growth allowance; DRY/COW share the same lactation-aware DMI term (naturally ≈0 milk contribution when not milking). */
  animalType?: AnimalType;
}

export interface RequirementsBreakdown {
  dm: {
    lactation: number;
    pregnancy: number;
    heiferGrowth: number;
    bcsAdjustment: number;
  };
  me: {
    maintenance: number;
    milk: number;
    pregnancy: number;
    heiferGrowth: number;
  };
  cp: {
    maintenance: number;
    milk: number;
    pregnancy: number;
    heiferGrowth: number;
  };
}

export interface Requirements {
  dmKg: number;
  cpKg: number;
  meMj: number;
  ndfKg: number;
  fatKg: number;
  /** Net energy for lactation, Mcal/day — derived from `meMj` (approximate ME→NEL conversion). */
  neMcal: number;
  /** MJ ME per kg of dry matter — how energy-dense the ration needs to be. */
  energyDensityMjPerKgDm: number;
  /** Crude protein as % of DM — the practical diet-density target nutritionists actually formulate to. */
  cpPctOfDm: number;
  /** Total Digestible Nutrients target (kg/day). */
  tdnKg: number;
  /** Calcium target (kg/day). */
  calciumKg: number;
  /** Phosphorus target (kg/day). */
  phosphorusKg: number;
  /** Acid Detergent Fiber minimum (kg/day). */
  adfKg: number;
  /** Rumen-Degradable Protein target, % of total CP. */
  rdpPct: number;
  /** Rumen-Undegradable Protein target, % of total CP. */
  rupPct: number;
  /** NDF maximum (kg/day) — `ndfKg` remains the minimum; over-supply depresses intake. */
  ndfMaxKg: number;
  /** Target Calcium:Phosphorus ratio (mass basis). Fixed at 2.0 — compare the ration's actual ratio against this. */
  caPRatioTarget: number;
  /** Component decomposition for UI display (sakil.dev-style breakdown). */
  breakdown: RequirementsBreakdown;
}

// --- maintenance / milk energy+protein constants (unchanged from v1) ---
const ME_MAINT_PER_KG075 = 0.49; // maintenance ME (MJ) per kg^0.75 metabolic weight
const ME_PER_LITRE_AT_4PCT = 5.0; // production ME (MJ) per litre at 4% fat
const ME_PER_FAT_POINT = 0.25; // ± MJ/L per 1% fat above/below 4%
const CP_MAINT_G_PER_KG075 = 3.8; // maintenance crude protein (g) per kg^0.75
const CP_G_PER_LITRE = 85; // production crude protein (g) per litre

// --- NRC-2001 lactating DMI term: (0.372*FCM4 + 0.0968*BW^0.75) * (1 - e^(-0.192*(WOL+3.67))) ---
const DMI_FCM_COEF = 0.372;
const DMI_METABOLIC_COEF = 0.0968;
const DMI_CURVE_K = 0.192;
const DMI_CURVE_OFFSET = 3.67;
const DEFAULT_DIM_WHEN_UNKNOWN = 100; // mid-lactation curve when DIM not supplied

// --- pregnancy-stage DM table (% of body weight), sakil.dev-verified bands ---
const PREGNANCY_DM_STAGES: Array<{ maxDay: number; pctBw: number }> = [
  { maxDay: 90, pctBw: 0.02 },
  { maxDay: 180, pctBw: 0.021 },
  { maxDay: 240, pctBw: 0.022 },
  { maxDay: 285, pctBw: 0.023 },
];

// --- heifer growth allowance (documented placeholder, not a full NRC growth model) ---
const HEIFER_DMI_PCT_BW = 0.025;
const HEIFER_GROWTH_ME_MJ = 6.0;
const HEIFER_GROWTH_CP_KG = 0.15;

// --- continuous pregnancy ME/CP curve (quadratic ramp across the full ~280-day term) ---
const GESTATION_FULL_TERM_DAY = 280;
const GESTATION_PEAK_ME_MJ = 8.4;
const GESTATION_PEAK_CP_KG = 0.5;

// --- BCS deviation adjustment ---
const TARGET_BCS = 3.0; // farm's 1.0–5.0 / 0.25-step scale
const ME_ADJUST_PCT_PER_QUARTER_BCS = 0.03; // ±3% of maintenance ME per 0.25 BCS unit deviation
const DM_ADJUST_KG_PER_BCS_UNIT = 0.375; // kg DM per full BCS unit deviation (sakil guide: 0.25–0.50 kg per step)

// --- diet-density / mineral / fibre targets (documented approximations) ---
const TDN_FRACTION_OF_DMI = 0.68; // target TDN concentration, % of DM
const CA_MAINT_G_PER_KG_BW = 0.031;
const CA_G_PER_LITRE = 1.22;
const P_MAINT_G_PER_KG_BW = 0.024;
const P_G_PER_LITRE = 0.9;
const ADF_FRACTION_OF_DMI = 0.19; // minimum ADF, % of DM
const NDF_MIN_FRACTION_OF_DMI = 0.3; // minimum NDF ≈ 30% of DMI (unchanged from v1)
const NDF_MAX_FRACTION_OF_DMI = 0.4; // maximum NDF before intake-depression risk
const FAT_FRACTION_OF_DMI = 0.04; // dietary fat target ≈ 4% of dry-matter intake
const RDP_PCT_OF_CP = 62;
const RUP_PCT_OF_CP = 38;
const CA_P_RATIO_TARGET = 2.0;
const MJ_PER_MCAL = 4.184;
const NEL_EFFICIENCY = 0.62; // approximate ME→NEL conversion efficiency

const round = (v: number) => Math.round(v * 100) / 100;

function pregnancyDmPctBw(gestationDays: number | undefined): number {
  if (gestationDays == null || gestationDays <= 0) return 0;
  const stage = PREGNANCY_DM_STAGES.find((s) => gestationDays <= s.maxDay);
  return stage
    ? stage.pctBw
    : PREGNANCY_DM_STAGES[PREGNANCY_DM_STAGES.length - 1].pctBw;
}

/** Fraction (0-1) of the full-term peak ME/CP pregnancy addend, ramped quadratically
 * across the whole gestation so it is continuous from day 1 (replaces v1's day-190 cliff). */
function gestationCurveFraction(gestationDays: number | undefined): number {
  if (gestationDays == null || gestationDays <= 0) return 0;
  const clamped = Math.min(gestationDays, GESTATION_FULL_TERM_DAY);
  return Math.pow(clamped / GESTATION_FULL_TERM_DAY, 2);
}

function bcsMeMultiplier(bcs: number | undefined): number {
  if (bcs == null) return 1;
  const deviationQuarters = (TARGET_BCS - bcs) / 0.25; // below target → positive → higher requirement
  return Math.max(0, 1 + deviationQuarters * ME_ADJUST_PCT_PER_QUARTER_BCS);
}

function bcsDmAdjustmentKg(bcs: number | undefined): number {
  if (bcs == null) return 0;
  return (TARGET_BCS - bcs) * DM_ADJUST_KG_PER_BCS_UNIT; // below target → positive → more DM
}

export function computeRequirements(input: RequirementsInput): Requirements {
  const bw = Math.max(0, input.weightKg);
  const milk = Math.max(0, input.milkTargetL);
  const fat = input.milkFatPct ?? 4.0;
  const dim = input.dim ?? DEFAULT_DIM_WHEN_UNKNOWN;
  const animalType = input.animalType ?? 'COW';
  const metabolicWeight = Math.pow(bw, 0.75);

  // --- DMI: NRC-2001 lactation curve vs pregnancy-stage table vs heifer growth, take the max ---
  const fcm4 = 0.4 * milk + (15 * (milk * fat)) / 100;
  const lactationCurve =
    1 - Math.exp(-DMI_CURVE_K * (dim / 7 + DMI_CURVE_OFFSET));
  const dmLactation =
    (DMI_FCM_COEF * fcm4 + DMI_METABOLIC_COEF * metabolicWeight) *
    lactationCurve;
  const dmPregnancy = pregnancyDmPctBw(input.gestationDays) * bw;
  const dmHeiferGrowth = animalType === 'HEIFER' ? HEIFER_DMI_PCT_BW * bw : 0;
  const bcsAdjustmentKg = bcsDmAdjustmentKg(input.bcs);
  const dmKg = Math.max(
    0,
    Math.max(dmLactation, dmPregnancy, dmHeiferGrowth) + bcsAdjustmentKg,
  );

  // --- Energy ---
  const gestationFraction = gestationCurveFraction(input.gestationDays);
  const mePerLitre = ME_PER_LITRE_AT_4PCT + (fat - 4) * ME_PER_FAT_POINT;
  const meMaintenance =
    ME_MAINT_PER_KG075 * metabolicWeight * bcsMeMultiplier(input.bcs);
  const meMilk = mePerLitre * milk;
  const mePregnancy = GESTATION_PEAK_ME_MJ * gestationFraction;
  const meHeiferGrowth = animalType === 'HEIFER' ? HEIFER_GROWTH_ME_MJ : 0;
  const meMj = meMaintenance + meMilk + mePregnancy + meHeiferGrowth;

  // --- Protein ---
  const cpMaintenanceKg = (CP_MAINT_G_PER_KG075 * metabolicWeight) / 1000;
  const cpMilkKg = (CP_G_PER_LITRE * milk) / 1000;
  const cpPregnancyKg = GESTATION_PEAK_CP_KG * gestationFraction;
  const cpHeiferGrowthKg = animalType === 'HEIFER' ? HEIFER_GROWTH_CP_KG : 0;
  const cpKg = cpMaintenanceKg + cpMilkKg + cpPregnancyKg + cpHeiferGrowthKg;

  // --- Fibre / fat ---
  const ndfKg = NDF_MIN_FRACTION_OF_DMI * dmKg;
  const ndfMaxKg = NDF_MAX_FRACTION_OF_DMI * dmKg;
  const fatKg = FAT_FRACTION_OF_DMI * dmKg;
  const adfKg = ADF_FRACTION_OF_DMI * dmKg;

  // --- Diet-density / minerals ---
  const tdnKg = TDN_FRACTION_OF_DMI * dmKg;
  const calciumKg = (CA_MAINT_G_PER_KG_BW * bw + CA_G_PER_LITRE * milk) / 1000;
  const phosphorusKg = (P_MAINT_G_PER_KG_BW * bw + P_G_PER_LITRE * milk) / 1000;
  const cpPctOfDm = dmKg > 0 ? (cpKg / dmKg) * 100 : 0;
  const energyDensityMjPerKgDm = dmKg > 0 ? meMj / dmKg : 0;
  const neMcal = (meMj / MJ_PER_MCAL) * NEL_EFFICIENCY;

  return {
    dmKg: round(dmKg),
    cpKg: round(cpKg),
    meMj: round(meMj),
    ndfKg: round(ndfKg),
    fatKg: round(fatKg),
    neMcal: round(neMcal),
    energyDensityMjPerKgDm: round(energyDensityMjPerKgDm),
    cpPctOfDm: round(cpPctOfDm),
    tdnKg: round(tdnKg),
    calciumKg: round(calciumKg),
    phosphorusKg: round(phosphorusKg),
    adfKg: round(adfKg),
    rdpPct: RDP_PCT_OF_CP,
    rupPct: RUP_PCT_OF_CP,
    ndfMaxKg: round(ndfMaxKg),
    caPRatioTarget: CA_P_RATIO_TARGET,
    breakdown: {
      dm: {
        lactation: round(dmLactation),
        pregnancy: round(dmPregnancy),
        heiferGrowth: round(dmHeiferGrowth),
        bcsAdjustment: round(bcsAdjustmentKg),
      },
      me: {
        maintenance: round(meMaintenance),
        milk: round(meMilk),
        pregnancy: round(mePregnancy),
        heiferGrowth: round(meHeiferGrowth),
      },
      cp: {
        maintenance: round(cpMaintenanceKg),
        milk: round(cpMilkKg),
        pregnancy: round(cpPregnancyKg),
        heiferGrowth: round(cpHeiferGrowthKg),
      },
    },
  };
}
