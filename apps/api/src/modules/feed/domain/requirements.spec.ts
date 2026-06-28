import { computeRequirements } from './requirements';

describe('computeRequirements', () => {
  it('computes sane requirements for a 450 kg cow at 20 L/day', () => {
    const r = computeRequirements({ weightKg: 450, milkTargetL: 20 });
    // DM = 0.025*450 + 0.1*20 = 11.25 + 2 = 13.25
    expect(r.dmKg).toBeCloseTo(13.25, 2);
    // NDF = 0.30 * DM, Fat = 0.04 * DM
    expect(r.ndfKg).toBeCloseTo(3.98, 1);
    expect(r.fatKg).toBeCloseTo(0.53, 1);
    // Energy + protein in plausible lactating-cow ranges
    expect(r.meMj).toBeGreaterThan(120);
    expect(r.meMj).toBeLessThan(180);
    expect(r.cpKg).toBeGreaterThan(1.5);
    expect(r.cpKg).toBeLessThan(2.6);
  });

  it('rises with milk yield (more milk → more DM, energy, protein)', () => {
    const low = computeRequirements({ weightKg: 450, milkTargetL: 5 });
    const high = computeRequirements({ weightKg: 450, milkTargetL: 30 });
    expect(high.dmKg).toBeGreaterThan(low.dmKg);
    expect(high.meMj).toBeGreaterThan(low.meMj);
    expect(high.cpKg).toBeGreaterThan(low.cpKg);
  });

  it('higher milk fat raises energy demand', () => {
    const base = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      milkFatPct: 4,
    });
    const fatty = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      milkFatPct: 5,
    });
    expect(fatty.meMj).toBeGreaterThan(base.meMj);
  });

  it('a dry cow (0 L) still needs maintenance', () => {
    const r = computeRequirements({ weightKg: 450, milkTargetL: 0 });
    expect(r.dmKg).toBeCloseTo(11.25, 2);
    expect(r.meMj).toBeGreaterThan(0);
  });
});
