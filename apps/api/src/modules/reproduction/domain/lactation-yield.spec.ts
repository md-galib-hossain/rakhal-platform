import { MilkDisposition } from '@prisma/client';
import {
  averageDailyYield,
  sumYieldForDay,
  totalsByDisposition,
  YieldEntry,
} from './lactation-yield';

describe('lactation-yield', () => {
  const day = (iso: string) => new Date(iso);

  const entries: YieldEntry[] = [
    {
      logDate: day('2026-08-01T00:00:00.000Z'),
      yieldL: 10,
      disposition: MilkDisposition.SALEABLE,
    },
    {
      logDate: day('2026-08-01T12:00:00.000Z'),
      yieldL: 5,
      disposition: MilkDisposition.WITHHELD,
    },
    {
      logDate: day('2026-08-02T00:00:00.000Z'),
      yieldL: 8,
      disposition: MilkDisposition.SALEABLE,
    },
    {
      logDate: day('2026-08-03T00:00:00.000Z'),
      yieldL: 3,
      disposition: MilkDisposition.COLOSTRUM,
    },
  ];

  describe('sumYieldForDay', () => {
    it('sums only entries on the same UTC day, combining multiple entries', () => {
      expect(sumYieldForDay(entries, day('2026-08-01T23:00:00.000Z'))).toBe(15);
    });

    it('returns 0 for a day with no entries', () => {
      expect(sumYieldForDay(entries, day('2026-08-10T00:00:00.000Z'))).toBe(0);
    });
  });

  describe('averageDailyYield', () => {
    it('divides by the full window when the lactation is older than the window', () => {
      // window = 3 days (08-01..08-03): total 26L / 3 = 8.67
      expect(
        averageDailyYield(entries, {
          referenceDate: day('2026-08-03T00:00:00.000Z'),
          windowDays: 3,
          lactationStart: day('2026-07-01T00:00:00.000Z'),
        }),
      ).toBeCloseTo(8.67, 2);
    });

    it('clamps the divisor to elapsed lactation days when younger than the window', () => {
      // lactation started 08-01 (day 0), reference 08-02 (day 1) -> elapsed = 2 days
      // requested window = 30 days but only 2 elapsed: total (15+8)=23 / 2 = 11.5
      expect(
        averageDailyYield(entries, {
          referenceDate: day('2026-08-02T00:00:00.000Z'),
          windowDays: 30,
          lactationStart: day('2026-08-01T00:00:00.000Z'),
        }),
      ).toBe(11.5);
    });

    it('counts a missing day as zero yield, pulling the average down', () => {
      // window 08-01..08-04 (4 days), 08-04 has no entries
      expect(
        averageDailyYield(entries, {
          referenceDate: day('2026-08-04T00:00:00.000Z'),
          windowDays: 4,
          lactationStart: day('2026-07-01T00:00:00.000Z'),
        }),
      ).toBe(6.5); // (15+8+3+0)/4
    });
  });

  describe('totalsByDisposition', () => {
    it('splits totals by disposition and sums produced across all of them', () => {
      const totals = totalsByDisposition(entries);
      expect(totals).toEqual({
        produced: 26,
        saleable: 18,
        withheld: 5,
        colostrum: 3,
        calfFeed: 0,
        discarded: 0,
        householdUse: 0,
      });
    });

    it('returns all zeros for an empty entry list', () => {
      expect(totalsByDisposition([])).toEqual({
        produced: 0,
        saleable: 0,
        withheld: 0,
        colostrum: 0,
        calfFeed: 0,
        discarded: 0,
        householdUse: 0,
      });
    });
  });
});
