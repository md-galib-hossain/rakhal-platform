import { computeMilkPrice } from './milk-price';

describe('computeMilkPrice', () => {
  const base = {
    volumeL: 183,
    basePricePerLitre: 55,
    baseFatPct: 3.5,
    fatBonusPer01Pct: 0.5,
    sccThreshold: 200_000,
    sccPenaltyPer100k: 1.0,
  };

  it('computes base amount with no quality data', () => {
    const r = computeMilkPrice({ ...base, fatPct: null, scc: null });
    expect(r.base).toBe(10065);
    expect(r.fatBonus).toBe(0);
    expect(r.sccPenalty).toBe(0);
    expect(r.total).toBe(10065);
  });

  it('adds a fat bonus above the base fat%', () => {
    // (4.0 - 3.5)/0.1 = 5 increments × 0.5 × 100L = 250
    const r = computeMilkPrice({
      ...base,
      volumeL: 100,
      fatPct: 4.0,
      scc: null,
    });
    expect(r.fatBonus).toBe(250);
    expect(r.total).toBe(100 * 55 + 250);
  });

  it('subtracts an SCC penalty above the threshold and never rewards', () => {
    // (400k - 200k)/100k = 2 × 1.0 × 100L = 200 penalty; low fat → no bonus
    const r = computeMilkPrice({
      ...base,
      volumeL: 100,
      fatPct: 3.0,
      scc: 400_000,
    });
    expect(r.fatBonus).toBe(0);
    expect(r.sccPenalty).toBe(200);
    expect(r.total).toBe(100 * 55 - 200);
  });
});
