import { derivePregnancyStage, PregnancyStageInput } from './pregnancy-stage';

describe('derivePregnancyStage', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Wide close-up window pushed far away so early/mid/late boundary tests
  // aren't accidentally swallowed by the CLOSE_UP override.
  const farSettings = {
    earlyDays: 90,
    midDays: 180,
    closeUpWindowDays: 21,
    gestationDays: 280,
  };

  const base: PregnancyStageInput = {
    now,
    conceptionDate: null,
    farmSettings: farSettings,
  };

  it('returns null when the cow has no active pregnancy', () => {
    expect(derivePregnancyStage(base)).toBeNull();
  });

  it('returns EARLY at day 0', () => {
    expect(derivePregnancyStage({ ...base, conceptionDate: daysAgo(0) })).toBe(
      'EARLY',
    );
  });

  it('returns EARLY at the earlyDays boundary (inclusive)', () => {
    expect(derivePregnancyStage({ ...base, conceptionDate: daysAgo(90) })).toBe(
      'EARLY',
    );
  });

  it('returns MID one day past the earlyDays boundary', () => {
    expect(derivePregnancyStage({ ...base, conceptionDate: daysAgo(91) })).toBe(
      'MID',
    );
  });

  it('returns MID at the midDays boundary (inclusive)', () => {
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(180) }),
    ).toBe('MID');
  });

  it('returns LATE one day past the midDays boundary', () => {
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(181) }),
    ).toBe('LATE');
  });

  it('returns LATE up to just outside the close-up window', () => {
    // gestationDays=280, closeUpWindowDays=21 -> close-up starts at day 259.
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(258) }),
    ).toBe('LATE');
  });

  it('returns CLOSE_UP exactly at the close-up window boundary (inclusive)', () => {
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(259) }),
    ).toBe('CLOSE_UP');
  });

  it('returns CLOSE_UP right up to the expected calving date', () => {
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(280) }),
    ).toBe('CLOSE_UP');
  });

  it('returns CLOSE_UP even past the projected expected calving date (overdue)', () => {
    expect(
      derivePregnancyStage({ ...base, conceptionDate: daysAgo(300) }),
    ).toBe('CLOSE_UP');
  });

  it('CLOSE_UP overrides an early elapsed-days bucket for a short configured gestation', () => {
    // A cow that conceived only 10 days ago would normally read EARLY, but a
    // short gestationDays + wide closeUpWindowDays can still put "now" inside
    // the close-up window.
    expect(
      derivePregnancyStage({
        now,
        conceptionDate: daysAgo(10),
        farmSettings: {
          earlyDays: 90,
          midDays: 180,
          closeUpWindowDays: 5,
          gestationDays: 12,
        },
      }),
    ).toBe('CLOSE_UP');
  });

  it('respects farm-configurable earlyDays/midDays thresholds (not hardcoded)', () => {
    expect(
      derivePregnancyStage({
        now,
        conceptionDate: daysAgo(50),
        farmSettings: {
          earlyDays: 30,
          midDays: 60,
          closeUpWindowDays: 5,
          gestationDays: 280,
        },
      }),
    ).toBe('MID');
  });
});
