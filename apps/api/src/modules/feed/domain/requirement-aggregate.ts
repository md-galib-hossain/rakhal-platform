import type { Requirements, RequirementsBreakdown } from './requirements';

/**
 * Herd requirement from per-cow results (MILESTONE 28 D9, closes RD-110). Pure.
 *
 * The engine is non-linear (`bw^0.75`, the DIM curve), so a herd's need is the sum of each cow's resolved
 * requirement, not one engine call on the herd's average inputs. A `null` (a manual cow's Ca/P or breakdown) is
 * skipped: the total covers only the cows that have it, and `caPHeadcount` says how many that is.
 */

const round = (v: number) => Math.round(v * 100) / 100;

const sumBreakdown = (rows: RequirementsBreakdown[]): RequirementsBreakdown => {
  const add = <K extends keyof RequirementsBreakdown>(k: K) => {
    const out: Record<string, number> = {};
    for (const r of rows)
      for (const [f, v] of Object.entries(r[k])) out[f] = (out[f] ?? 0) + v;
    return out as unknown as RequirementsBreakdown[K];
  };
  return { dm: add('dm'), me: add('me'), cp: add('cp') };
};

const scaleBreakdown = (
  b: RequirementsBreakdown,
  divisor: number,
): RequirementsBreakdown => {
  const div = <K extends keyof RequirementsBreakdown>(k: K) =>
    Object.fromEntries(
      Object.entries(b[k]).map(([f, v]) => [f, round(v / divisor)]),
    ) as unknown as RequirementsBreakdown[K];
  return { dm: div('dm'), me: div('me'), cp: div('cp') };
};

export interface AggregatedRequirements {
  /** Sum over the cows. */
  total: Requirements;
  /** Mean per cow. */
  mean: Requirements;
  /** How many cows carry Ca/P (a manual cow has none). */
  caPHeadcount: number;
}

/** `reqs` must be non-empty. */
export function aggregateRequirements(
  reqs: Requirements[],
): AggregatedRequirements {
  const n = reqs.length;
  const sum = (pick: (r: Requirements) => number) =>
    reqs.reduce((a, r) => a + pick(r), 0);
  const withCa = reqs.filter((r) => r.calciumKg != null);
  const withP = reqs.filter((r) => r.phosphorusKg != null);
  const withBreakdown = reqs.filter(
    (r): r is Requirements & { breakdown: RequirementsBreakdown } =>
      r.breakdown != null,
  );
  const first = reqs[0];

  const build = (
    divisor: number,
    caDiv: number,
    pDiv: number,
    bDiv: number,
  ): Requirements => {
    const dmKg = sum((r) => r.dmKg) / divisor;
    const cpKg = sum((r) => r.cpKg) / divisor;
    const meMj = sum((r) => r.meMj) / divisor;
    return {
      dmKg: round(dmKg),
      cpKg: round(cpKg),
      meMj: round(meMj),
      ndfKg: round(sum((r) => r.ndfKg) / divisor),
      fatKg: round(sum((r) => r.fatKg) / divisor),
      neMcal: round(sum((r) => r.neMcal) / divisor),
      energyDensityMjPerKgDm: round(dmKg > 0 ? meMj / dmKg : 0),
      cpPctOfDm: round(dmKg > 0 ? (cpKg / dmKg) * 100 : 0),
      tdnKg: round(sum((r) => r.tdnKg) / divisor),
      calciumKg:
        withCa.length > 0
          ? round(withCa.reduce((a, r) => a + (r.calciumKg ?? 0), 0) / caDiv)
          : null,
      phosphorusKg:
        withP.length > 0
          ? round(withP.reduce((a, r) => a + (r.phosphorusKg ?? 0), 0) / pDiv)
          : null,
      adfKg: round(sum((r) => r.adfKg) / divisor),
      rdpPct: first.rdpPct,
      rupPct: first.rupPct,
      ndfMaxKg: round(sum((r) => r.ndfMaxKg) / divisor),
      caPRatioTarget: first.caPRatioTarget,
      breakdown:
        withBreakdown.length > 0
          ? scaleBreakdown(
              sumBreakdown(withBreakdown.map((r) => r.breakdown)),
              bDiv,
            )
          : null,
    };
  };

  return {
    total: build(1, 1, 1, 1),
    mean: build(n, withCa.length, withP.length, withBreakdown.length),
    caPHeadcount: withCa.length,
  };
}
