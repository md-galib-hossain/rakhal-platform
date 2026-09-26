import {
  MJ_PER_MCAL,
  type AnimalType,
  type Requirements,
} from './requirements';
import type { RequirementSettings } from './requirement-settings';

/**
 * Manual requirement override (MILESTONE 28, PRD §12.17, ADR-028). Pure: no framework, no Prisma.
 *
 * A manual cow's requirement is DM/CP/ME typed by hand. Everything else is either derived from those three,
 * a fixed share of the manual DM (the farm's settings, same formulas as `computeRequirements`), a farm
 * constant, or **not set** (`null`) because it would need the cow's live weight and milk.
 */

export interface ManualRequirementValues {
  dmKg: number;
  cpKg: number;
  meMj: number;
}

const round = (v: number) => Math.round(v * 100) / 100;

export function requirementsFromManual(
  manual: ManualRequirementValues,
  settings: RequirementSettings,
): Requirements {
  const { dmKg, cpKg, meMj } = manual;
  return {
    dmKg: round(dmKg),
    cpKg: round(cpKg),
    meMj: round(meMj),
    ndfKg: round(settings.ndfMinShareOfIntake * dmKg),
    ndfMaxKg: round(settings.ndfMaxShareOfIntake * dmKg),
    fatKg: round(settings.fatShareOfIntake * dmKg),
    adfKg: round(settings.adfShareOfIntake * dmKg),
    tdnKg: round(settings.tdnShareOfIntake * dmKg),
    cpPctOfDm: round(dmKg > 0 ? (cpKg / dmKg) * 100 : 0),
    energyDensityMjPerKgDm: round(dmKg > 0 ? meMj / dmKg : 0),
    neMcal: round((meMj / MJ_PER_MCAL) * settings.netEnergyEfficiency),
    // Need the cow's body weight and milk, which a manual requirement never reads (D3).
    calciumKg: null,
    phosphorusKg: null,
    rdpPct: settings.degradableProteinShare,
    rupPct: settings.undegradableProteinShare,
    caPRatioTarget: settings.calciumToPhosphorusTarget,
    breakdown: null,
  };
}

/** What the engine said when a manual row was set (`CattleRequirementOverride.dynamicSnapshot`). */
export interface ManualDynamicSnapshot {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  animal_type: AnimalType;
  inputs?: Record<string, unknown>;
}

export interface ManualStaleness {
  stale: boolean;
  drift: { dm_pct: number; cp_pct: number; me_pct: number };
  animal_type_changed: boolean;
}

/** Percent change of `now` vs `then`. A snapshot of 0 has no base: any positive value counts as a full change. */
function driftPct(then: number, now: number): number {
  if (then > 0) return round((Math.abs(now - then) / then) * 100);
  return now > 0 ? 100 : 0;
}

/**
 * D6: a manual requirement is stale when the cow's *calculated* need moved more than `driftPctLimit` on DM, CP
 * or ME since the values were set, or her animal type changed. A warning only — nothing reverts.
 */
export function isManualStale(
  snapshot: ManualDynamicSnapshot,
  dynamicNow: { dmKg: number; cpKg: number; meMj: number },
  animalTypeNow: AnimalType,
  driftPctLimit: number,
): ManualStaleness {
  const drift = {
    dm_pct: driftPct(snapshot.dm_kg, dynamicNow.dmKg),
    cp_pct: driftPct(snapshot.cp_kg, dynamicNow.cpKg),
    me_pct: driftPct(snapshot.me_mj, dynamicNow.meMj),
  };
  const animalTypeChanged = snapshot.animal_type !== animalTypeNow;
  const stale =
    animalTypeChanged ||
    drift.dm_pct > driftPctLimit ||
    drift.cp_pct > driftPctLimit ||
    drift.me_pct > driftPctLimit;
  return { stale, drift, animal_type_changed: animalTypeChanged };
}
