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
 *
 * v3 (2026-09-08, RAKHAL-408) moves every tuning number out into
 * `requirement-settings.ts` so Rakhal Admin can retune the model and a farm can override
 * it without a redeploy. The equation *shape* below is unchanged and the defaults are
 * byte-identical, so this refactor moved no output. `settings` is optional and defaults to
 * the built-ins, which keeps every pure call site and unit test working untouched.
 */

import {
  DEFAULT_REQUIREMENT_SETTINGS,
  RequirementSettings,
} from './requirement-settings';

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

/** Unit conversion, not a nutritional assumption — deliberately not a tunable setting. */
const MJ_PER_MCAL = 4.184;

const round = (v: number) => Math.round(v * 100) / 100;

function pregnancyDmPctBw(
  gestationDays: number | undefined,
  settings: RequirementSettings,
): number {
  if (gestationDays == null || gestationDays <= 0) return 0;
  const stages = settings.pregnancyIntakeStages;
  const stage = stages.find((s) => gestationDays <= s.untilDay);
  return stage
    ? stage.percentOfBodyWeight
    : stages[stages.length - 1].percentOfBodyWeight;
}

/** Fraction (0-1) of the full-term peak ME/CP pregnancy addend, ramped quadratically
 * across the whole gestation so it is continuous from day 1 (replaces v1's day-190 cliff). */
function gestationCurveFraction(
  gestationDays: number | undefined,
  settings: RequirementSettings,
): number {
  if (gestationDays == null || gestationDays <= 0) return 0;
  const clamped = Math.min(gestationDays, settings.pregnancyLengthDays);
  return Math.pow(clamped / settings.pregnancyLengthDays, 2);
}

function bcsMeMultiplier(
  bcs: number | undefined,
  settings: RequirementSettings,
): number {
  if (bcs == null) return 1;
  // below target → positive → higher requirement
  const deviationQuarters = (settings.targetBodyCondition - bcs) / 0.25;
  return Math.max(
    0,
    1 + deviationQuarters * settings.energyAdjustPerBodyConditionStep,
  );
}

function bcsDmAdjustmentKg(
  bcs: number | undefined,
  settings: RequirementSettings,
): number {
  if (bcs == null) return 0;
  // below target → positive → more DM
  return (
    (settings.targetBodyCondition - bcs) *
    settings.intakeAdjustPerBodyConditionPoint
  );
}

/**
 * @param settings the farm's resolved tuning numbers. Defaults to the built-in launch
 *   defaults so pure callers and unit tests need not thread them; production callers
 *   pass what `RequirementSettingsService.resolve(farmId)` returned.
 */
export function computeRequirements(
  input: RequirementsInput,
  settings: RequirementSettings = DEFAULT_REQUIREMENT_SETTINGS,
): Requirements {
  const bw = Math.max(0, input.weightKg);
  const milk = Math.max(0, input.milkTargetL);
  const fat = input.milkFatPct ?? 4.0;
  const dim = input.dim ?? settings.defaultDaysInMilk;
  const animalType = input.animalType ?? 'COW';
  const metabolicWeight = Math.pow(bw, 0.75);

  // --- DMI: NRC-2001 lactation curve vs pregnancy-stage table vs heifer growth, take the max ---
  const fcm4 = 0.4 * milk + (15 * (milk * fat)) / 100;
  const lactationCurve =
    1 -
    Math.exp(
      -settings.intakeCurveSteepness * (dim / 7 + settings.intakeCurveOffset),
    );
  const dmLactation =
    (settings.intakeFromMilkFactor * fcm4 +
      settings.intakeFromBodyWeightFactor * metabolicWeight) *
    lactationCurve;
  const dmPregnancy = pregnancyDmPctBw(input.gestationDays, settings) * bw;
  const dmHeiferGrowth =
    animalType === 'HEIFER' ? settings.heiferIntakePercentOfBodyWeight * bw : 0;
  const bcsAdjustmentKg = bcsDmAdjustmentKg(input.bcs, settings);
  const dmKg = Math.max(
    0,
    Math.max(dmLactation, dmPregnancy, dmHeiferGrowth) + bcsAdjustmentKg,
  );

  // --- Energy ---
  const gestationFraction = gestationCurveFraction(
    input.gestationDays,
    settings,
  );
  const mePerLitre =
    settings.energyPerLitreMilk + (fat - 4) * settings.energyPerMilkFatPercent;
  const meMaintenance =
    settings.maintenanceEnergyPerMetabolicKg *
    metabolicWeight *
    bcsMeMultiplier(input.bcs, settings);
  const meMilk = mePerLitre * milk;
  const mePregnancy = settings.pregnancyPeakEnergy * gestationFraction;
  const meHeiferGrowth =
    animalType === 'HEIFER' ? settings.heiferGrowthEnergy : 0;
  const meMj = meMaintenance + meMilk + mePregnancy + meHeiferGrowth;

  // --- Protein ---
  const cpMaintenanceKg =
    (settings.maintenanceProteinPerMetabolicKg * metabolicWeight) / 1000;
  const cpMilkKg = (settings.proteinPerLitreMilk * milk) / 1000;
  const cpPregnancyKg = settings.pregnancyPeakProtein * gestationFraction;
  const cpHeiferGrowthKg =
    animalType === 'HEIFER' ? settings.heiferGrowthProtein : 0;
  const cpKg = cpMaintenanceKg + cpMilkKg + cpPregnancyKg + cpHeiferGrowthKg;

  // --- Fibre / fat ---
  const ndfKg = settings.ndfMinShareOfIntake * dmKg;
  const ndfMaxKg = settings.ndfMaxShareOfIntake * dmKg;
  const fatKg = settings.fatShareOfIntake * dmKg;
  const adfKg = settings.adfShareOfIntake * dmKg;

  // --- Diet-density / minerals ---
  const tdnKg = settings.tdnShareOfIntake * dmKg;
  const calciumKg =
    (settings.calciumPerBodyWeightKg * bw +
      settings.calciumPerLitreMilk * milk) /
    1000;
  const phosphorusKg =
    (settings.phosphorusPerBodyWeightKg * bw +
      settings.phosphorusPerLitreMilk * milk) /
    1000;
  const cpPctOfDm = dmKg > 0 ? (cpKg / dmKg) * 100 : 0;
  const energyDensityMjPerKgDm = dmKg > 0 ? meMj / dmKg : 0;
  const neMcal = (meMj / MJ_PER_MCAL) * settings.netEnergyEfficiency;

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
    rdpPct: settings.degradableProteinShare,
    rupPct: settings.undegradableProteinShare,
    ndfMaxKg: round(ndfMaxKg),
    caPRatioTarget: settings.calciumToPhosphorusTarget,
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
