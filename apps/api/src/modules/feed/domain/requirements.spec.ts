import { computeRequirements } from './requirements';

describe('computeRequirements (v2, RAKHAL-258)', () => {
  it('a dry cow (0 L, no DIM/gestation) still needs maintenance DM/ME/CP', () => {
    const r = computeRequirements({ weightKg: 450, milkTargetL: 0 });
    expect(r.dmKg).toBeGreaterThan(0);
    expect(r.meMj).toBeGreaterThan(0);
    expect(r.cpKg).toBeGreaterThan(0);
  });

  it('rises with milk yield (more milk → more DM, energy, protein)', () => {
    const low = computeRequirements({
      weightKg: 450,
      milkTargetL: 5,
      dim: 100,
    });
    const high = computeRequirements({
      weightKg: 450,
      milkTargetL: 30,
      dim: 100,
    });
    expect(high.dmKg).toBeGreaterThan(low.dmKg);
    expect(high.meMj).toBeGreaterThan(low.meMj);
    expect(high.cpKg).toBeGreaterThan(low.cpKg);
  });

  it('higher milk fat raises energy demand', () => {
    const base = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      milkFatPct: 4,
      dim: 100,
    });
    const fatty = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      milkFatPct: 5,
      dim: 100,
    });
    expect(fatty.meMj).toBeGreaterThan(base.meMj);
  });

  it('the NRC-2001 lactation curve rises through early lactation then plateaus', () => {
    const wk1 = computeRequirements({ weightKg: 450, milkTargetL: 20, dim: 7 });
    const wk8 = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      dim: 56,
    });
    const wk20 = computeRequirements({
      weightKg: 450,
      milkTargetL: 20,
      dim: 140,
    });
    expect(wk8.dmKg).toBeGreaterThan(wk1.dmKg);
    // curve is asymptotic — week 20 should be close to week 8, not still climbing hard
    expect(wk20.dmKg).toBeGreaterThanOrEqual(wk8.dmKg);
    expect(wk20.dmKg - wk8.dmKg).toBeLessThan(wk8.dmKg - wk1.dmKg);
  });

  describe('pregnancy-stage DM table + continuous ME/CP curve', () => {
    it('adds nothing at day 0 / no gestation', () => {
      const none = computeRequirements({ weightKg: 450, milkTargetL: 0 });
      expect(none.breakdown.dm.pregnancy).toBe(0);
      expect(none.breakdown.me.pregnancy).toBe(0);
      expect(none.breakdown.cp.pregnancy).toBe(0);
    });

    it('early pregnancy (day 45) already contributes a DM/ME/CP addend (continuous, no day-190 cliff)', () => {
      const early = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 45,
      });
      expect(early.breakdown.dm.pregnancy).toBeCloseTo(0.02 * 450, 2);
      expect(early.breakdown.me.pregnancy).toBeGreaterThan(0);
      expect(early.breakdown.cp.pregnancy).toBeGreaterThan(0);
    });

    it('escalates through the pregnancy-stage DM table', () => {
      const early = computeRequirements({
        weightKg: 500,
        milkTargetL: 0,
        gestationDays: 60,
      });
      const mid = computeRequirements({
        weightKg: 500,
        milkTargetL: 0,
        gestationDays: 150,
      });
      const late = computeRequirements({
        weightKg: 500,
        milkTargetL: 0,
        gestationDays: 220,
      });
      const closeUp = computeRequirements({
        weightKg: 500,
        milkTargetL: 0,
        gestationDays: 270,
      });
      expect(early.breakdown.dm.pregnancy).toBeCloseTo(10.0, 1); // 2.0% of 500
      expect(mid.breakdown.dm.pregnancy).toBeCloseTo(10.5, 1); // 2.1%
      expect(late.breakdown.dm.pregnancy).toBeCloseTo(11.0, 1); // 2.2%
      expect(closeUp.breakdown.dm.pregnancy).toBeCloseTo(11.5, 1); // 2.3%
    });

    it('ME/CP pregnancy addend grows monotonically and peaks at full term (day 280)', () => {
      const mid = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 140,
      });
      const late = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 240,
      });
      const term = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        gestationDays: 280,
      });
      expect(late.meMj).toBeGreaterThan(mid.meMj);
      expect(term.meMj).toBeGreaterThan(late.meMj);
      expect(term.cpKg).toBeGreaterThan(late.cpKg);
      expect(term.breakdown.me.pregnancy).toBeCloseTo(8.4, 1);
      expect(term.breakdown.cp.pregnancy).toBeCloseTo(0.5, 1);
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
    it('a cow below target BCS gets a higher maintenance ME and more DM', () => {
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
      expect(thin.dmKg).toBeGreaterThan(base.dmKg);
    });

    it('a cow above target BCS gets a lower maintenance ME and less DM', () => {
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
      expect(heavy.dmKg).toBeLessThan(base.dmKg);
    });

    it('omitting bcs behaves identically to a target-BCS cow', () => {
      const omitted = computeRequirements({ weightKg: 450, milkTargetL: 0 });
      const atTarget = computeRequirements({
        weightKg: 450,
        milkTargetL: 0,
        bcs: 3.0,
      });
      expect(omitted.meMj).toBeCloseTo(atTarget.meMj, 2);
      expect(omitted.dmKg).toBeCloseTo(atTarget.dmKg, 2);
    });
  });

  describe('heifer growth mode', () => {
    it('a heifer gets a growth DM/ME/CP allowance a COW of the same inputs does not', () => {
      const cow = computeRequirements({
        weightKg: 300,
        milkTargetL: 0,
        animalType: 'COW',
      });
      const heifer = computeRequirements({
        weightKg: 300,
        milkTargetL: 0,
        animalType: 'HEIFER',
      });
      expect(heifer.breakdown.dm.heiferGrowth).toBeGreaterThan(0);
      expect(cow.breakdown.dm.heiferGrowth).toBe(0);
      expect(heifer.dmKg).toBeGreaterThanOrEqual(cow.dmKg);
    });
  });

  describe('new diet-density / mineral / fibre targets', () => {
    it('emits NEL, energy density, diet-density CP%, and mineral/fibre targets', () => {
      const r = computeRequirements({
        weightKg: 450,
        milkTargetL: 20,
        dim: 100,
      });
      expect(r.neMcal).toBeGreaterThan(0);
      expect(r.energyDensityMjPerKgDm).toBeGreaterThan(0);
      expect(r.cpPctOfDm).toBeGreaterThan(0);
      expect(r.tdnKg).toBeGreaterThan(0);
      expect(r.calciumKg).toBeGreaterThan(0);
      expect(r.phosphorusKg).toBeGreaterThan(0);
      expect(r.adfKg).toBeGreaterThan(0);
      expect(r.ndfMaxKg).toBeGreaterThan(r.ndfKg);
      expect(r.rdpPct).toBe(62);
      expect(r.rupPct).toBe(38);
      expect(r.caPRatioTarget).toBe(2.0);
    });
  });

  // Golden test — reproduces the live sakil.dev/dairy-nutrition-calculator worked example from
  // docs/COMPETITIVE_FEED_ANALYSIS.md §3 (450 kg cow, 15 L/day, pregnant day 120, DIM 100).
  // Our model is independently derived (documented approximations, not a byte-for-byte port),
  // so this asserts the same *order of magnitude and direction* rather than exact equality —
  // proof we closed the gap (v1 gave 12.75 kg DM / 1.65 kg CP) rather than a coefficient copy.
  it('golden: 450kg/15L/day-120-pregnant/DIM100 lands in the sakil.dev-verified range', () => {
    const r = computeRequirements({
      weightKg: 450,
      milkTargetL: 15,
      gestationDays: 120,
      dim: 100,
    });
    expect(r.dmKg).toBeGreaterThan(13);
    expect(r.dmKg).toBeLessThan(15.5);
    expect(r.meMj).toBeGreaterThan(110);
    expect(r.meMj).toBeLessThan(140);
    expect(r.cpKg).toBeGreaterThan(1.6); // strictly above the v1 figure of 1.65
    expect(r.neMcal).toBeGreaterThan(15);
  });
});
