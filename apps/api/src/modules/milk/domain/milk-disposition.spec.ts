import { MilkDisposition } from '@prisma/client';
import { resolveMilkDisposition } from './milk-disposition';

describe('resolveMilkDisposition (RAKHAL-277)', () => {
  const logDate = new Date('2026-08-05T00:00:00.000Z');

  it('returns SALEABLE for a normal cow with no active lactation', () => {
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: null,
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.SALEABLE);
  });

  it('returns SALEABLE for a cow well past her colostrum window', () => {
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: new Date('2026-07-01T00:00:00.000Z'),
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.SALEABLE);
  });

  it('returns COLOSTRUM for a cow inside the farm-configured colostrum window', () => {
    // 3 days since calving, window is 5 days.
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: new Date('2026-08-02T00:00:00.000Z'),
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.COLOSTRUM);
  });

  it('treats the colostrum window as [0, windowDays) — day 0 is COLOSTRUM, the boundary day is not', () => {
    const startDate = new Date('2026-08-05T00:00:00.000Z'); // calved today
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: startDate,
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.COLOSTRUM);

    // Exactly on the boundary (day 5 of a 5-day window) — no longer colostrum.
    const boundaryLogDate = new Date('2026-08-10T00:00:00.000Z');
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: startDate,
        logDate: boundaryLogDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.SALEABLE);
  });

  it('returns WITHHELD for a cow under an active safety withdrawal, regardless of lactation', () => {
    expect(
      resolveMilkDisposition({
        isWithheld: true,
        activeLactationStartDate: null,
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.WITHHELD);
  });

  it('WITHHELD wins over COLOSTRUM when both would otherwise apply', () => {
    // Freshly calved (day 1 of a 5-day colostrum window) AND under an active
    // safety withdrawal — RAKHAL-277's documented precedence call: a withheld
    // cow's milk cannot be sold regardless of colostrum status, so WITHHELD wins.
    expect(
      resolveMilkDisposition({
        isWithheld: true,
        activeLactationStartDate: new Date('2026-08-04T00:00:00.000Z'),
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.WITHHELD);
  });

  it('ignores a future/invalid lactation start date (negative days-since-start)', () => {
    expect(
      resolveMilkDisposition({
        isWithheld: false,
        activeLactationStartDate: new Date('2026-08-06T00:00:00.000Z'),
        logDate,
        colostrumWindowDays: 5,
      }),
    ).toBe(MilkDisposition.SALEABLE);
  });
});
