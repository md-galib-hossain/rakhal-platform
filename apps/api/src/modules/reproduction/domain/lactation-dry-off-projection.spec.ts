import {
  computeDryOffProjection,
  computeStandardized305DayYield,
} from './lactation-dry-off-projection';

describe('computeDryOffProjection', () => {
  it('pregnant: recommendedDryOffAt = expectedCalvingDate - dryPeriodDays, no management estimate attached', () => {
    const result = computeDryOffProjection({
      isPregnant: true,
      expectedCalvingDate: new Date('2027-01-01T00:00:00.000Z'),
      dryPeriodDays: 60,
    });

    expect(result.recommendedDryOffAt).toEqual(
      new Date('2026-11-02T00:00:00.000Z'),
    );
    expect(result.managementEstimateDimRange).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('not pregnant + no prior lactation history: falls back to the documented 270-330 day range, labeled LOW confidence with an explicit reason', () => {
    const result = computeDryOffProjection({
      isPregnant: false,
      previousLactationLengthsDays: [],
    });

    expect(result.recommendedDryOffAt).toBeNull();
    expect(result.managementEstimateDimRange).toEqual([270, 330]);
    expect(result.confidence).toBe('LOW');
    expect(result.reason).toEqual(expect.stringContaining('Not pregnant'));
    expect(result.reason).toEqual(
      expect.stringContaining('no completed prior lactation'),
    );
  });

  it('not pregnant + prior lactation history: derives a [min,max] range from her own recorded lactation lengths', () => {
    const result = computeDryOffProjection({
      isPregnant: false,
      previousLactationLengthsDays: [290, 310, 305],
    });

    expect(result.recommendedDryOffAt).toBeNull();
    expect(result.managementEstimateDimRange).toEqual([290, 310]);
    expect(result.confidence).toBe('LOW');
    expect(result.reason).toEqual(
      expect.stringContaining('3 prior lactation(s)'),
    );
  });

  it('not pregnant + a single/identical-value prior lactation: pads the range instead of returning a zero-width point', () => {
    const result = computeDryOffProjection({
      isPregnant: false,
      previousLactationLengthsDays: [300],
    });

    expect(result.managementEstimateDimRange).toEqual([285, 315]);
  });

  it('honors a custom fallbackRangeDays when supplied', () => {
    const result = computeDryOffProjection({
      isPregnant: false,
      previousLactationLengthsDays: [],
      fallbackRangeDays: [250, 320],
    });

    expect(result.managementEstimateDimRange).toEqual([250, 320]);
  });
});

describe('computeStandardized305DayYield', () => {
  it('returns null below the configured minimum DIM threshold', () => {
    expect(
      computeStandardized305DayYield({
        producedToDateL: 300,
        daysInMilk: 29,
        minDimThreshold: 30,
      }),
    ).toBeNull();
  });

  it('returns null at daysInMilk <= 0', () => {
    expect(
      computeStandardized305DayYield({
        producedToDateL: 0,
        daysInMilk: 0,
        minDimThreshold: 30,
      }),
    ).toBeNull();
  });

  it('projects a linear-ratio 305-day-equivalent yield at/above the threshold', () => {
    // 10 L/day average over 30 recorded days -> 10 * 305
    expect(
      computeStandardized305DayYield({
        producedToDateL: 300,
        daysInMilk: 30,
        minDimThreshold: 30,
      }),
    ).toBe(3050);
  });
});
