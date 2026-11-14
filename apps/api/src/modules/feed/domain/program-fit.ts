/**
 * Feeding-program fit (MILESTONE 27, RAKHAL-458, `docs/EPIC_FEED_PROGRAMS.md` §5). Pure — no
 * framework/Prisma. Compares what a program supplies to a cow per day with what she needs, per nutrient
 * (dry matter, crude protein, metabolisable energy), against the farm's tolerance bands.
 *
 * `delta = supply / requirement − 1`. Inside the band it is **ok**; up to *twice* the band it is
 * **warn**; beyond that **bad**. Below and above the requirement have their own band (protein is
 * tolerant of an excess, energy less so). Anything computed from an assumption — an estimated weight, a
 * missing milk record, a supply with no resolvable lot — marks the result `estimated`, so a caller never
 * shows a silent green off missing data.
 */

export type FitSeverity = 'ok' | 'warn' | 'bad';

/** Tolerance bands, in percent. Sourced from the farm's requirement settings (`alert*Pct`). */
export interface FitBands {
  dmBelowPct: number;
  dmAbovePct: number;
  cpBelowPct: number;
  cpAbovePct: number;
  meBelowPct: number;
  meAbovePct: number;
}

export interface NutrientAmounts {
  dmKg: number;
  cpKg: number;
  meMj: number;
}

export interface NutrientFit {
  /** `(supply / requirement − 1) × 100`, one decimal; `null` when the requirement is zero. */
  deltaPct: number | null;
  severity: FitSeverity;
}

export interface ProgramFit {
  dm: NutrientFit;
  cp: NutrientFit;
  me: NutrientFit;
  /** The worst of the three. */
  severity: FitSeverity;
  /** True when any input was an assumption (see file comment). */
  estimated: boolean;
}

const RANK: Record<FitSeverity, number> = { ok: 0, warn: 1, bad: 2 };

const round1 = (v: number) => Math.round(v * 10) / 10;

/** One nutrient. `belowPct`/`abovePct` are the allowed shortfall / excess, in percent. */
export function classifyDelta(
  supply: number,
  requirement: number,
  belowPct: number,
  abovePct: number,
): NutrientFit {
  if (!(requirement > 0)) return { deltaPct: null, severity: 'ok' };
  // Classify on the rounded delta — the number a user sees — so a value exactly on a band edge is never
  // tipped over it by float noise (110/100 − 1 is 0.10000000000000009).
  const delta = round1((supply / requirement - 1) * 100);
  let severity: FitSeverity = 'ok';
  if (delta < -belowPct) {
    severity = -delta <= belowPct * 2 ? 'warn' : 'bad';
  } else if (delta > abovePct) {
    severity = delta <= abovePct * 2 ? 'warn' : 'bad';
  }
  return { deltaPct: delta, severity };
}

export function computeProgramFit(
  supply: NutrientAmounts,
  requirement: NutrientAmounts,
  bands: FitBands,
  estimated: boolean,
): ProgramFit {
  const dm = classifyDelta(
    supply.dmKg,
    requirement.dmKg,
    bands.dmBelowPct,
    bands.dmAbovePct,
  );
  const cp = classifyDelta(
    supply.cpKg,
    requirement.cpKg,
    bands.cpBelowPct,
    bands.cpAbovePct,
  );
  const me = classifyDelta(
    supply.meMj,
    requirement.meMj,
    bands.meBelowPct,
    bands.meAbovePct,
  );
  const severity = [dm, cp, me].reduce<FitSeverity>(
    (worst, n) => (RANK[n.severity] > RANK[worst] ? n.severity : worst),
    'ok',
  );
  return { dm, cp, me, severity, estimated };
}

/** What is still needed after what she has already been fed today; never below zero. */
export function remainingRequirement(
  requirement: NutrientAmounts,
  fed: NutrientAmounts,
): NutrientAmounts {
  return {
    dmKg: Math.max(0, requirement.dmKg - fed.dmKg),
    cpKg: Math.max(0, requirement.cpKg - fed.cpKg),
    meMj: Math.max(0, requirement.meMj - fed.meMj),
  };
}

/**
 * Fit of a further feeding against the REMAINING requirement (`requirement − already fed today`).
 * A nutrient already fully met has nothing left to fit against, so any supply of it is an excess
 * (`warn`) rather than the silent "ok" `classifyDelta` gives a zero requirement.
 */
export function computeRemainingFit(
  supply: NutrientAmounts,
  requirement: NutrientAmounts,
  fed: NutrientAmounts,
  bands: FitBands,
  estimated: boolean,
): ProgramFit {
  const fit = computeProgramFit(
    supply,
    remainingRequirement(requirement, fed),
    bands,
    estimated,
  );
  const met = (s: number, r: number, f: number) => r > 0 && f >= r && s > 0;
  if (met(supply.dmKg, requirement.dmKg, fed.dmKg)) {
    fit.dm = { deltaPct: null, severity: 'warn' };
  }
  if (met(supply.cpKg, requirement.cpKg, fed.cpKg)) {
    fit.cp = { deltaPct: null, severity: 'warn' };
  }
  if (met(supply.meMj, requirement.meMj, fed.meMj)) {
    fit.me = { deltaPct: null, severity: 'warn' };
  }
  fit.severity = [fit.dm, fit.cp, fit.me].reduce<FitSeverity>(
    (worst, n) => (RANK[n.severity] > RANK[worst] ? n.severity : worst),
    'ok',
  );
  return fit;
}

/** snake_case API shape of a fit. */
export function toApiFit(f: ProgramFit) {
  const n = (x: NutrientFit) => ({
    delta_pct: x.deltaPct,
    severity: x.severity,
  });
  return {
    severity: f.severity,
    estimated: f.estimated,
    dm: n(f.dm),
    cp: n(f.cp),
    me: n(f.me),
  };
}

/** The farm's requirement settings → bands. */
export function bandsFromSettings(s: {
  alertDryMatterBelowPct: number;
  alertDryMatterAbovePct: number;
  alertProteinBelowPct: number;
  alertProteinAbovePct: number;
  alertEnergyBelowPct: number;
  alertEnergyAbovePct: number;
}): FitBands {
  return {
    dmBelowPct: s.alertDryMatterBelowPct,
    dmAbovePct: s.alertDryMatterAbovePct,
    cpBelowPct: s.alertProteinBelowPct,
    cpAbovePct: s.alertProteinAbovePct,
    meBelowPct: s.alertEnergyBelowPct,
    meAbovePct: s.alertEnergyAbovePct,
  };
}
