import { deriveLactationStage, LactationStageInput } from './lactation-stage';

describe('deriveLactationStage', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const thresholds = { freshDays: 21, earlyDays: 100, midDays: 200 };

  const base: LactationStageInput = {
    now,
    lactationStartDate: null,
    isInActiveDryPeriod: false,
    farmSettings: thresholds,
  };

  it('returns null when the cow has no active lactation and no active dry period', () => {
    expect(deriveLactationStage(base)).toBeNull();
  });

  it('returns DRY_PERIOD when inside an open dry period, regardless of lactationStartDate', () => {
    expect(
      deriveLactationStage({
        ...base,
        lactationStartDate: daysAgo(10),
        isInActiveDryPeriod: true,
      }),
    ).toBe('DRY_PERIOD');
  });

  it('returns FRESH at day 0', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(0) }),
    ).toBe('FRESH');
  });

  it('returns FRESH at the freshDays boundary (inclusive)', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(21) }),
    ).toBe('FRESH');
  });

  it('returns EARLY one day past the freshDays boundary', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(22) }),
    ).toBe('EARLY');
  });

  it('returns EARLY at the earlyDays boundary (inclusive)', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(100) }),
    ).toBe('EARLY');
  });

  it('returns MID one day past the earlyDays boundary', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(101) }),
    ).toBe('MID');
  });

  it('returns MID at the midDays boundary (inclusive)', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(200) }),
    ).toBe('MID');
  });

  it('returns LATE one day past the midDays boundary', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(201) }),
    ).toBe('LATE');
  });

  it('returns LATE far beyond the midDays boundary', () => {
    expect(
      deriveLactationStage({ ...base, lactationStartDate: daysAgo(400) }),
    ).toBe('LATE');
  });

  it('respects farm-configurable thresholds (not hardcoded)', () => {
    const tightThresholds = { freshDays: 5, earlyDays: 10, midDays: 15 };
    expect(
      deriveLactationStage({
        ...base,
        lactationStartDate: daysAgo(6),
        farmSettings: tightThresholds,
      }),
    ).toBe('EARLY');
  });
});
