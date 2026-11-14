import { dropPct, isAnomaly } from './milk-anomaly';

describe('milk-anomaly domain', () => {
  describe('isAnomaly', () => {
    it('flags a session below 70% of the 7-day average', () => {
      expect(isAnomaly(4.2, 9.1)).toBe(true); // 46% of avg
      expect(isAnomaly(6.4, 9.1)).toBe(false); // 70.3% of avg
    });

    it('never flags without a positive average', () => {
      expect(isAnomaly(0, 0)).toBe(false);
      expect(isAnomaly(5, null)).toBe(false);
    });
  });

  describe('dropPct', () => {
    it('computes the percentage drop vs the average', () => {
      expect(dropPct(4.2, 9.1)).toBe(54);
      expect(dropPct(9.1, 9.1)).toBe(0);
    });

    it('returns null without a positive average and clamps at 0', () => {
      expect(dropPct(5, null)).toBeNull();
      expect(dropPct(12, 9.1)).toBe(0);
    });
  });
});
