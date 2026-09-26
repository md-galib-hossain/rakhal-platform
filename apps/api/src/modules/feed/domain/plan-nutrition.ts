/**
 * Full nutrition check for a feed plan (MILESTONE 27 follow-up). Pure — no framework/Prisma.
 *
 * `program-fit.ts` only judges dry matter, crude protein and energy. This adds every other nutrient the lots carry —
 * fat, NDF, ADF, TDN, calcium, phosphorus, Ca:P, RDP/RUP, starch — as supply vs the cow's requirement.
 *
 * A nutrient the lot does not carry is **not measured, never zero** (ADR-026 D4): a row whose supply leaves out any
 * fed line for that reason has `measured: false` and severity `unknown` — its supply is a floor, so it must not be
 * judged (or shown as a silent 0).
 */
import { NutritionValues } from './nutrition-profile';
import { classifyDelta, FitBands, FitSeverity } from './program-fit';

export interface PlanLineNutrition {
  /** As-fed kg per head per day. */
  kgPerDay: number;
  /** The lot the line would draw; `null` when the line has no resolvable lot. */
  profile: NutritionValues | null;
}

export type SupplyKey =
  | 'dm'
  | 'cp'
  | 'me'
  | 'fat'
  | 'ndf'
  | 'adf'
  | 'tdn'
  | 'calcium'
  | 'phosphorus'
  | 'starch'
  | 'rdp'
  | 'rup';

export interface NutrientSupply {
  /** kg/day (MJ/day for `me`). */
  value: number;
  /** False when a fed line has no value for it — `value` is then a floor. */
  measured: boolean;
}

/** The cow's requirement, as `FeedRequirementsService.reqShape` presents it. */
export interface PlanRequirement {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  fat_kg: number;
  ndf_kg: number;
  ndf_max_kg: number;
  adf_kg: number;
  tdn_kg: number;
  /** `null` for a manual-requirement cow: Ca/P need her live weight and milk (MILESTONE 28 D3). */
  calcium_kg: number | null;
  phosphorus_kg: number | null;
  rdp_pct: number;
  rup_pct: number;
  ca_p_ratio_target: number;
}

export type NutrientRowKey =
  | 'dm'
  | 'cp'
  | 'me'
  | 'fat'
  | 'ndf'
  | 'adf'
  | 'tdn'
  | 'calcium'
  | 'phosphorus'
  | 'ca_p_ratio'
  | 'rdp_pct'
  | 'rup_pct'
  | 'starch';

export type NutrientSeverity = FitSeverity | 'unknown';

export interface NutrientRow {
  key: NutrientRowKey;
  unit: 'kg' | 'MJ' | '% of CP' | ': 1';
  supply: number | null;
  requirement: number | null;
  /** Upper limit where one exists (NDF: over-supply depresses intake). */
  max: number | null;
  delta_pct: number | null;
  severity: NutrientSeverity;
  measured: boolean;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Tolerance for nutrients the farm has no alert settings for: allowed shortfall / excess, in percent. */
const OTHER_BELOW_PCT = 10;
const OTHER_ABOVE_PCT = 20;
/** A minimum (NDF, ADF): any excess is fine here — NDF's ceiling is judged separately against `ndf_max_kg`. */
const NO_UPPER_LIMIT_PCT = 1e9;

const OPTIONAL_PCT: Record<
  'fat' | 'ndf' | 'adf' | 'tdn' | 'calcium' | 'phosphorus' | 'starch',
  keyof NutritionValues
> = {
  fat: 'fatPct',
  ndf: 'ndfPct',
  adf: 'adfPct',
  tdn: 'tdnPct',
  calcium: 'calciumPct',
  phosphorus: 'phosphorusPct',
  starch: 'starchPct',
};

/**
 * Σ over the fed lines of each nutrient's daily supply. Every optional nutrient is a % of dry matter except
 * RDP/RUP, which are % of crude protein.
 */
export function computeNutrientSupply(
  lines: PlanLineNutrition[],
): Record<SupplyKey, NutrientSupply> {
  const keys: SupplyKey[] = [
    'dm',
    'cp',
    'me',
    'fat',
    'ndf',
    'adf',
    'tdn',
    'calcium',
    'phosphorus',
    'starch',
    'rdp',
    'rup',
  ];
  const out = Object.fromEntries(
    keys.map((k) => [k, { value: 0, measured: true }]),
  ) as Record<SupplyKey, NutrientSupply>;

  for (const line of lines) {
    if (!(line.kgPerDay > 0)) continue;
    const p = line.profile;
    if (!p) {
      for (const k of keys) out[k].measured = false;
      continue;
    }
    const dmKg = line.kgPerDay * (p.dmPct / 100);
    const cpKg = dmKg * (p.cpPct / 100);
    out.dm.value += dmKg;
    out.cp.value += cpKg;
    out.me.value += dmKg * p.meMjPerKgDm;

    for (const [key, field] of Object.entries(OPTIONAL_PCT)) {
      const pct = p[field];
      if (pct == null) out[key as SupplyKey].measured = false;
      else out[key as SupplyKey].value += dmKg * (pct / 100);
    }
    if (p.rdpPct == null) out.rdp.measured = false;
    else out.rdp.value += cpKg * (p.rdpPct / 100);
    if (p.rupPct == null) out.rup.measured = false;
    else out.rup.value += cpKg * (p.rupPct / 100);
  }
  return out;
}

function row(
  key: NutrientRowKey,
  unit: NutrientRow['unit'],
  supply: number | null,
  requirement: number | null,
  measured: boolean,
  below: number,
  above: number,
  max: number | null = null,
  infoOnly = false,
): NutrientRow {
  if (supply == null || requirement == null || !(requirement > 0)) {
    // A missing requirement (a manual cow's Ca/P, MILESTONE 28 D10) is never judged: `unknown`, not a silent
    // green. Only a nutrient that has no requirement by design (starch) is `ok` info.
    const unjudgeable = requirement == null && !infoOnly;
    return {
      key,
      unit,
      supply: supply == null ? null : round2(supply),
      requirement: requirement == null ? null : round2(requirement),
      max,
      delta_pct: null,
      severity: measured && !unjudgeable ? 'ok' : 'unknown',
      measured,
    };
  }
  const fit = classifyDelta(supply, requirement, below, above);
  let severity: NutrientSeverity = measured ? fit.severity : 'unknown';
  // Over the NDF ceiling depresses intake — at least a warning, but never on a floor of unmeasured supply.
  if (measured && max != null && supply > max && severity === 'ok')
    severity = 'warn';
  return {
    key,
    unit,
    supply: round2(supply),
    requirement: round2(requirement),
    max,
    delta_pct: fit.deltaPct,
    severity,
    measured,
  };
}

/**
 * The full table for one cow: supply vs requirement per nutrient. Dry matter, protein and energy use the farm's own
 * tolerance bands (the same ones `computeProgramFit` uses, so the two never disagree); the rest use a fixed default
 * tolerance. Starch has no requirement, so it is shown as information only.
 */
export function buildNutrientRows(
  supply: Record<SupplyKey, NutrientSupply>,
  req: PlanRequirement,
  bands: FitBands,
): NutrientRow[] {
  const s = supply;
  const cp = s.cp.value;
  const caP =
    s.phosphorus.value > 0 ? s.calcium.value / s.phosphorus.value : null;
  const pctOfCp = (k: 'rdp' | 'rup') =>
    cp > 0 ? (s[k].value / cp) * 100 : null;

  return [
    row(
      'dm',
      'kg',
      s.dm.value,
      req.dm_kg,
      s.dm.measured,
      bands.dmBelowPct,
      bands.dmAbovePct,
    ),
    row(
      'cp',
      'kg',
      s.cp.value,
      req.cp_kg,
      s.cp.measured,
      bands.cpBelowPct,
      bands.cpAbovePct,
    ),
    row(
      'me',
      'MJ',
      s.me.value,
      req.me_mj,
      s.me.measured,
      bands.meBelowPct,
      bands.meAbovePct,
    ),
    row(
      'fat',
      'kg',
      s.fat.value,
      req.fat_kg,
      s.fat.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
    ),
    row(
      'ndf',
      'kg',
      s.ndf.value,
      req.ndf_kg,
      s.ndf.measured,
      OTHER_BELOW_PCT,
      NO_UPPER_LIMIT_PCT,
      req.ndf_max_kg > 0 ? round2(req.ndf_max_kg) : null,
    ),
    row(
      'adf',
      'kg',
      s.adf.value,
      req.adf_kg,
      s.adf.measured,
      OTHER_BELOW_PCT,
      NO_UPPER_LIMIT_PCT,
    ),
    row(
      'tdn',
      'kg',
      s.tdn.value,
      req.tdn_kg,
      s.tdn.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
    ),
    row(
      'calcium',
      'kg',
      s.calcium.value,
      req.calcium_kg,
      s.calcium.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
    ),
    row(
      'phosphorus',
      'kg',
      s.phosphorus.value,
      req.phosphorus_kg,
      s.phosphorus.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
    ),
    row(
      'ca_p_ratio',
      ': 1',
      caP,
      req.ca_p_ratio_target,
      s.calcium.measured && s.phosphorus.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
    ),
    row(
      'rdp_pct',
      '% of CP',
      pctOfCp('rdp'),
      req.rdp_pct,
      s.rdp.measured && s.cp.measured,
      OTHER_BELOW_PCT,
      OTHER_BELOW_PCT,
    ),
    row(
      'rup_pct',
      '% of CP',
      pctOfCp('rup'),
      req.rup_pct,
      s.rup.measured && s.cp.measured,
      OTHER_BELOW_PCT,
      OTHER_BELOW_PCT,
    ),
    row(
      'starch',
      'kg',
      s.starch.value,
      null,
      s.starch.measured,
      OTHER_BELOW_PCT,
      OTHER_ABOVE_PCT,
      null,
      true,
    ),
  ];
}
