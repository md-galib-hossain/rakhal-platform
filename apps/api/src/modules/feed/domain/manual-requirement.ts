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
  /**
   * MILESTONE 28b (RAKHAL-463, D14–D17): the rest of the profile. A v2 row has all of them; a v1 row has none
   * (`null`/absent), and a missing value falls back to the v1 rule. CP %, energy density, NEL and Ca:P are
   * derived from these, never typed.
   */
  ndfKg?: number | null;
  ndfMaxKg?: number | null;
  adfKg?: number | null;
  fatKg?: number | null;
  tdnKg?: number | null;
  calciumKg?: number | null;
  phosphorusKg?: number | null;
  rdpPct?: number | null;
  rupPct?: number | null;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** A stored value wins; a missing one (v1 row) falls back to the v1 rule. */
const stored = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);

export function requirementsFromManual(
  manual: ManualRequirementValues,
  settings: RequirementSettings,
): Requirements {
  const { dmKg, cpKg, meMj } = manual;
  const calciumKg = stored(manual.calciumKg);
  const phosphorusKg = stored(manual.phosphorusKg);
  return {
    dmKg: round(dmKg),
    cpKg: round(cpKg),
    meMj: round(meMj),
    ndfKg: stored(manual.ndfKg) ?? round(settings.ndfMinShareOfIntake * dmKg),
    ndfMaxKg:
      stored(manual.ndfMaxKg) ?? round(settings.ndfMaxShareOfIntake * dmKg),
    fatKg: stored(manual.fatKg) ?? round(settings.fatShareOfIntake * dmKg),
    adfKg: stored(manual.adfKg) ?? round(settings.adfShareOfIntake * dmKg),
    tdnKg: stored(manual.tdnKg) ?? round(settings.tdnShareOfIntake * dmKg),
    cpPctOfDm: round(dmKg > 0 ? (cpKg / dmKg) * 100 : 0),
    energyDensityMjPerKgDm: round(dmKg > 0 ? meMj / dmKg : 0),
    neMcal: round((meMj / MJ_PER_MCAL) * settings.netEnergyEfficiency),
    // A v1 row has no Ca/P (they need the cow's body weight and milk, which a manual requirement never reads,
    // D3) so they stay `null` = not judged. A v2 row carries them.
    calciumKg,
    phosphorusKg,
    rdpPct: stored(manual.rdpPct) ?? settings.degradableProteinShare,
    rupPct: stored(manual.rupPct) ?? settings.undegradableProteinShare,
    // Derived from the typed Ca and P when both are usable, else the farm's target.
    caPRatioTarget:
      calciumKg !== null && phosphorusKg !== null && phosphorusKg > 0
        ? round(calciumKg / phosphorusKg)
        : settings.calciumToPhosphorusTarget,
    breakdown: null,
  };
}

export interface ManualValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ManualValidation {
  /** Hard rules: the value cannot be saved (HTTP 400). */
  errors: ManualValidationIssue[];
  /** Soft rules: saved anyway, shown to the manager so they can double-check an unusual figure. */
  warnings: ManualValidationIssue[];
}

/**
 * MILESTONE 28b D19 + the v1 rules (D11), in one pure place so the service and the tests share it. Optional
 * profile fields are only checked when supplied. Percent-of-DM soft ranges are proposals, tuned by the
 * farm's own calculated values later.
 */
export function validateManualValues(
  v: ManualRequirementValues,
  weightKg?: number | null,
): ManualValidation {
  const errors: ManualValidationIssue[] = [];
  const warnings: ManualValidationIssue[] = [];
  const err = (field: string, code: string, message: string) =>
    errors.push({ field, code, message });
  const warn = (field: string, code: string, message: string) =>
    warnings.push({ field, code, message });
  const has = (n: number | null | undefined): n is number =>
    n !== null && n !== undefined;

  const { dmKg, cpKg, meMj } = v;
  if (!(dmKg >= 0.5 && dmKg <= 40))
    err('dmKg', 'dm_range', 'Dry matter must be between 0.5 and 40 kg.');
  if (!(cpKg > 0)) err('cpKg', 'cp_positive', 'Protein must be above 0.');
  else if (cpKg >= dmKg)
    err('cpKg', 'cp_below_dm', 'Protein must be less than dry matter.');
  if (!(meMj >= 5 && meMj <= 400))
    err('meMj', 'me_range', 'Energy must be between 5 and 400 MJ.');

  // Mass fields: positive, and each smaller than the dry matter it is part of.
  const mass: Array<[keyof ManualRequirementValues, string]> = [
    ['ndfKg', 'NDF'],
    ['ndfMaxKg', 'NDF maximum'],
    ['adfKg', 'ADF'],
    ['fatKg', 'Fat'],
    ['tdnKg', 'TDN'],
  ];
  for (const [field, label] of mass) {
    const n = v[field];
    if (!has(n)) continue;
    if (!(n > 0)) err(field, 'positive', `${label} must be above 0.`);
    else if (dmKg > 0 && n >= dmKg)
      err(field, 'below_dm', `${label} must be less than dry matter.`);
  }
  for (const [field, label] of [
    ['calciumKg', 'Calcium'],
    ['phosphorusKg', 'Phosphorus'],
  ] as const) {
    const n = v[field];
    if (has(n) && !(n >= 0))
      err(field, 'non_negative', `${label} cannot be negative.`);
  }
  if (
    has(v.calciumKg) &&
    has(v.phosphorusKg) &&
    v.calciumKg + v.phosphorusKg >= dmKg
  )
    err(
      'calciumKg',
      'minerals_below_dm',
      'Calcium and phosphorus together must be less than dry matter.',
    );
  if (has(v.ndfKg) && has(v.ndfMaxKg) && v.ndfMaxKg < v.ndfKg)
    err('ndfMaxKg', 'ndf_max_below_min', 'NDF maximum must not be below NDF.');
  for (const [field, label] of [
    ['rdpPct', 'RDP'],
    ['rupPct', 'RUP'],
  ] as const) {
    const n = v[field];
    if (has(n) && !(n >= 0 && n <= 100))
      err(field, 'pct_range', `${label} must be between 0 and 100 %.`);
  }

  // Soft rules — v1 first (codes unchanged so the frontend keeps working), then the profile.
  if (has(weightKg) && weightKg > 0 && dmKg > 0) {
    const pct = (dmKg / weightKg) * 100;
    if (pct < 1.5 || pct > 4.5)
      warn(
        'dmKg',
        'dm_body_weight',
        `Dry matter is ${pct.toFixed(1)} % of body weight; cows usually eat 1.5–4.5 %.`,
      );
  }
  if (dmKg > 0 && cpKg > 0) {
    const cpPct = (cpKg / dmKg) * 100;
    if (cpPct < 8 || cpPct > 22)
      warn(
        'cpKg',
        'cp_share',
        `Crude protein is ${cpPct.toFixed(1)} % of dry matter; a diet is usually 8–22 %.`,
      );
    const density = meMj / dmKg;
    if (density < 7 || density > 13)
      warn(
        'meMj',
        'energy_density',
        `Energy is ${density.toFixed(1)} MJ per kg of dry matter; a diet is usually 7–13.`,
      );
  }
  const share = (
    field: keyof ManualRequirementValues,
    code: string,
    label: string,
    lo: number,
    hi: number,
  ) => {
    const n = v[field];
    if (!has(n) || !(n > 0) || !(dmKg > 0)) return;
    const pct = (n / dmKg) * 100;
    if (pct < lo || pct > hi)
      warn(
        field,
        code,
        `${label} is ${pct.toFixed(1)} % of dry matter; a diet is usually ${lo}–${hi} %.`,
      );
  };
  share('ndfKg', 'ndf_share', 'NDF', 20, 55);
  share('adfKg', 'adf_share', 'ADF', 15, 35);
  share('fatKg', 'fat_share', 'Fat', 1, 8);
  share('tdnKg', 'tdn_share', 'TDN', 50, 80);
  if (has(v.calciumKg) && has(v.phosphorusKg) && v.phosphorusKg > 0) {
    const ratio = v.calciumKg / v.phosphorusKg;
    if (ratio < 1 || ratio > 3)
      warn(
        'calciumKg',
        'ca_p_ratio',
        `Calcium to phosphorus is ${ratio.toFixed(1)} : 1; usually 1–3 : 1.`,
      );
  }
  if (
    has(v.rdpPct) &&
    has(v.rupPct) &&
    Math.abs(v.rdpPct + v.rupPct - 100) > 0.5
  )
    warn('rdpPct', 'protein_split', 'RDP and RUP should add up to 100 %.');

  return { errors, warnings };
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
