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

  describe('late-gestation addend', () => {
    it('adds nothing before day 190', () => {
      const early = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 100,
      });
      const none = computeRequirements({ weightKg: 450, milkTargetL: 0 });
      expect(early.meMj).toBeCloseTo(none.meMj, 2);
      expect(early.cpKg).toBeCloseTo(none.cpKg, 2);
    });

    it('escalates ME/CP from day 190 toward calving at day 280', () => {
      const base = computeRequirements({ weightKg: 450, milkTargetL: 0 });
      const mid = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 235, // halfway between 190 and 280
      });
      const term = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 280,
      });
      expect(mid.meMj).toBeGreaterThan(base.meMj);
      expect(term.meMj).toBeGreaterThan(mid.meMj);
      expect(term.cpKg).toBeGreaterThan(mid.cpKg);
      // day 280 (full term) adds the full peak addend: +8.4 MJ, +0.5 kg CP
      expect(term.meMj - base.meMj).toBeCloseTo(8.4, 1);
      expect(term.cpKg - base.cpKg).toBeCloseTo(0.5, 1);
    });

    it('caps the addend beyond day 280 (does not keep escalating)', () => {
      const term = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 280,
      });
      const overdue = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 300,
      });
      expect(overdue.meMj).toBeCloseTo(term.meMj, 2);
    });
  });

  describe('BCS-deviation adjustment', () => {
    it('a cow below target BCS gets a higher maintenance requirement', () => {
      const base = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 3.0,
      });
      const thin = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 2.0,
      });
      expect(thin.meMj).toBeGreaterThan(base.meMj);
    });

    it('a cow above target BCS gets a lower maintenance requirement', () => {
      const base = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 3.0,
      });
      const heavy = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 4.0,
      });
      expect(heavy.meMj).toBeLessThan(base.meMj);
    });

    it('omitting bcs behaves identically to a target-BCS cow', () => {
      const omitted = computeRequirements({ weightKg: 450, milkTargetL: 0 });
      const atTarget = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 3.0,
      });
      expect(omitted.meMj).toBeCloseTo(atTarget.meMj, 2);
    });
  });
});
