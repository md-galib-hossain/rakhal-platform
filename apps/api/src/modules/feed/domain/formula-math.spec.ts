import { EffectiveIngredient } from './ingredient-resolver';
import { balanceScore, computeTotals, normalize } from './formula-math';
import { Requirements } from './requirements';

// RAKHAL-258 added fields to `Requirements` beyond the 5 legacy ones this spec exercises;
// this stub fills them with harmless defaults so these fixtures keep compiling. Owned by
// RAKHAL-260 to update meaningfully once formula-math.ts consumes the new fields.
const reqStub = (partial: Partial<Requirements>): Requirements => ({
  dmKg: 0,
  cpKg: 0,
  meMj: 0,
  ndfKg: 0,
  fatKg: 0,
  neMcal: 0,
  energyDensityMjPerKgDm: 0,
  cpPctOfDm: 0,
  tdnKg: 0,
  calciumKg: 0,
  phosphorusKg: 0,
  adfKg: 0,
  rdpPct: 0,
  rupPct: 0,
  ndfMaxKg: 0,
  caPRatioTarget: 2.0,
  breakdown: {
    dm: { lactation: 0, pregnancy: 0, heiferGrowth: 0, bcsAdjustment: 0 },
    me: { maintenance: 0, milk: 0, pregnancy: 0, heiferGrowth: 0 },
    cp: { maintenance: 0, milk: 0, pregnancy: 0, heiferGrowth: 0 },
  },
  ...partial,
});

const eff = (
  id: string,
  partial: Partial<EffectiveIngredient>,
): EffectiveIngredient => ({
  id,
  pricePerKg: 50,
  priceSource: 'rakhal_market',
  hasNutritionOverride: false,
  dmPct: 88,
  cpPct: 17,
  meMjPerKgDm: 11.5,
  fatPct: 4,
  ndfPct: 40,
  rdpPct: 0,
  rupPct: 0,
  starchPct: 0,
  adfPct: 0,
  calciumPct: 0,
  phosphorusPct: 0,
  tdnPct: 0,
  ...partial,
});

describe('formula-math', () => {
  const byId = new Map<string, EffectiveIngredient>([
    ['a', eff('a', { dmPct: 88, cpPct: 15, meMjPerKgDm: 11, pricePerKg: 45 })],
    ['b', eff('b', { dmPct: 90, cpPct: 44, meMjPerKgDm: 12, pricePerKg: 70 })],
  ]);

  describe('computeTotals', () => {
    it('computes DM off as-fed and CP/ME off DM, plus cost', () => {
      const { items, totals } = computeTotals(
        [{ ingredientId: 'a', amountKg: 10 }],
        byId,
      );
      // DM = 10 * 0.88 = 8.8; CP = 8.8 * 0.15 = 1.32; ME = 8.8 * 11 = 96.8; cost = 10*45
      expect(items[0].dm_kg).toBeCloseTo(8.8, 2);
      expect(items[0].cp_kg).toBeCloseTo(1.32, 2);
      expect(items[0].me_mj).toBeCloseTo(96.8, 1);
      expect(items[0].cost_tk).toBe(450);
      expect(totals.dm_kg).toBeCloseTo(8.8, 2);
    });

    it('sums multiple ingredients and ignores unknown ids', () => {
      const { totals } = computeTotals(
        [
          { ingredientId: 'a', amountKg: 10 },
          { ingredientId: 'b', amountKg: 5 },
          { ingredientId: 'ghost', amountKg: 99 },
        ],
        byId,
      );
      expect(totals.total_cost_tk).toBe(10 * 45 + 5 * 70);
      expect(totals.dm_kg).toBeCloseTo(8.8 + 4.5, 2);
    });
  });

  describe('balanceScore', () => {
    const req: Requirements = reqStub({
      dmKg: 10,
      cpKg: 2,
      meMj: 100,
      ndfKg: 3,
      fatKg: 0.4,
    });
    it('is 100 when all three governing nutrients are met', () => {
      const totals = {
        dm_kg: 12,
        cp_kg: 3,
        me_mj: 120,
        ndf_kg: 4,
        fat_kg: 1,
        rdp_kg: 0,
        rup_kg: 0,
        starch_kg: 0,
        adf_kg: 0,
        calcium_kg: 0,
        phosphorus_kg: 0,
        tdn_kg: 0,
        total_cost_tk: 0,
      };
      expect(balanceScore(totals, req)).toBe(100);
    });
    it('drops proportionally on a deficit', () => {
      const totals = {
        dm_kg: 5,
        cp_kg: 2,
        me_mj: 100,
        ndf_kg: 3,
        fat_kg: 0.4,
        rdp_kg: 0,
        rup_kg: 0,
        starch_kg: 0,
        adf_kg: 0,
        calcium_kg: 0,
        phosphorus_kg: 0,
        tdn_kg: 0,
        total_cost_tk: 0,
      };
      // DM 50%, CP 100%, ME 100% → mean 83%
      expect(balanceScore(totals, req)).toBe(83);
    });
  });

  describe('normalize', () => {
    it('scales amounts so total DM hits the requirement', () => {
      const req: Requirements = reqStub({
        dmKg: 17.6,
        cpKg: 0,
        meMj: 0,
        ndfKg: 0,
        fatKg: 0,
      });
      // current DM for 10kg of "a" (88%) = 8.8 → factor 2 → 20kg
      const out = normalize([{ ingredientId: 'a', amountKg: 10 }], req, byId);
      expect(out[0].amountKg).toBeCloseTo(20, 1);
    });
  });
});
