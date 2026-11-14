import { computeLactationPersistency } from './lactation-persistency';

describe('computeLactationPersistency', () => {
  it('returns null when no peak has been recorded yet', () => {
    expect(
      computeLactationPersistency({
        currentSevenDayAvgYield: 15,
        peakMilkYield: null,
        peakDaysInMilk: null,
        currentDaysInMilk: 30,
      }),
    ).toBeNull();
  });

  it('returns null when the stored peak is non-positive (division-by-zero guard)', () => {
    expect(
      computeLactationPersistency({
        currentSevenDayAvgYield: 15,
        peakMilkYield: 0,
        peakDaysInMilk: 20,
        currentDaysInMilk: 30,
      }),
    ).toBeNull();
  });

  it('computes persistency/decline % and days-since-peak, showing every input', () => {
    // peak was 25L at DIM 40, now DIM 100 with a 20L 7-day average.
    expect(
      computeLactationPersistency({
        currentSevenDayAvgYield: 20,
        peakMilkYield: 25,
        peakDaysInMilk: 40,
        currentDaysInMilk: 100,
      }),
    ).toEqual({
      currentSevenDayAvgYield: 20,
      peakMilkYield: 25,
      peakDaysInMilk: 40,
      daysSincePeak: 60,
      persistencyPct: 80,
      declinePct: 20,
    });
  });

  it('clamps daysSincePeak to 0 when the reference day is at or before the peak day', () => {
    const result = computeLactationPersistency({
      currentSevenDayAvgYield: 25,
      peakMilkYield: 25,
      peakDaysInMilk: 40,
      currentDaysInMilk: 40,
    });
    expect(result?.daysSincePeak).toBe(0);
    expect(result?.persistencyPct).toBe(100);
    expect(result?.declinePct).toBe(0);
  });

  it('allows persistencyPct above 100 (currently exceeding a stale/low stored peak)', () => {
    const result = computeLactationPersistency({
      currentSevenDayAvgYield: 30,
      peakMilkYield: 25,
      peakDaysInMilk: 40,
      currentDaysInMilk: 45,
    });
    expect(result?.persistencyPct).toBe(120);
    expect(result?.declinePct).toBe(-20);
  });
});
