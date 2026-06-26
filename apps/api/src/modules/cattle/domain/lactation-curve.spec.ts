import { buildLactationCurve, daysBetween, trendPct } from './lactation-curve';

describe('lactation-curve domain', () => {
  describe('buildLactationCurve', () => {
    const start = new Date('2026-01-01T00:00:00Z');

    it('maps daily yields onto the DIM axis, sorted ascending', () => {
      const curve = buildLactationCurve(start, [
        { date: new Date('2026-01-31T00:00:00Z'), totalL: 28.5 },
        { date: new Date('2026-01-01T00:00:00Z'), totalL: 18 },
        { date: new Date('2026-01-11T00:00:00Z'), totalL: 32 },
      ]);
      expect(curve).toEqual([
        { dim: 0, yield_l: 18 },
        { dim: 10, yield_l: 32 },
        { dim: 30, yield_l: 28.5 },
      ]);
    });

    it('drops days before the lactation start', () => {
      const curve = buildLactationCurve(start, [
        { date: new Date('2025-12-20T00:00:00Z'), totalL: 5 },
        { date: new Date('2026-01-05T00:00:00Z'), totalL: 20 },
      ]);
      expect(curve).toEqual([{ dim: 4, yield_l: 20 }]);
    });
  });

  describe('daysBetween', () => {
    it('counts whole days and never goes negative', () => {
      expect(
        daysBetween(
          new Date('2026-01-01T00:00:00Z'),
          new Date('2026-01-08T00:00:00Z'),
        ),
      ).toBe(7);
      expect(
        daysBetween(
          new Date('2026-01-08T00:00:00Z'),
          new Date('2026-01-01T00:00:00Z'),
        ),
      ).toBe(0);
    });
  });

  describe('trendPct', () => {
    it('computes percentage change vs the previous value', () => {
      expect(trendPct(110, 100)).toBe(10);
      expect(trendPct(90, 100)).toBe(-10);
    });

    it('returns null when there is no prior basis (and no current)', () => {
      expect(trendPct(0, 0)).toBeNull();
      expect(trendPct(50, 0)).toBe(100);
    });
  });
});
