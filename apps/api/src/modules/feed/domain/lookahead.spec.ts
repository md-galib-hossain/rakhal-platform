import { ASSUMED_PEAK_DIM, computeLookahead } from './lookahead';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const now = day('2026-09-25');

describe('computeLookahead', () => {
  it('lists nothing when no dates are known', () => {
    expect(computeLookahead({ now, windowDays: 14 })).toEqual([]);
  });

  it('includes an event exactly at the window edge and skips the day after', () => {
    expect(
      computeLookahead({ now, windowDays: 14, dryOffDate: day('2026-10-09') }),
    ).toEqual([{ kind: 'dry_off', in_days: 14 }]);
    expect(
      computeLookahead({ now, windowDays: 14, dryOffDate: day('2026-10-10') }),
    ).toEqual([]);
  });

  it('keeps an overdue calving and dry-off listed with negative days', () => {
    expect(
      computeLookahead({
        now,
        windowDays: 14,
        expectedCalvingDate: day('2026-09-20'),
        dryOffDate: day('2026-09-22'),
      }),
    ).toEqual([
      { kind: 'calving', in_days: -5 },
      { kind: 'dry_off', in_days: -3 },
    ]);
  });

  it('sorts the soonest event first', () => {
    const out = computeLookahead({
      now,
      windowDays: 14,
      expectedCalvingDate: day('2026-10-03'),
      dryOffDate: day('2026-09-30'),
    });
    expect(out.map((e) => e.kind)).toEqual(['dry_off', 'calving']);
  });

  it('lists the assumed peak only when it is ahead, in the window, and none is recorded', () => {
    // Started 50 days ago -> peak in 10 days.
    const start = new Date(now.getTime() - 50 * 86_400_000);
    expect(
      computeLookahead({ now, windowDays: 14, lactationStart: start }),
    ).toEqual([{ kind: 'peak_dim', in_days: ASSUMED_PEAK_DIM - 50 }]);
    // Already recorded -> behind her.
    expect(
      computeLookahead({
        now,
        windowDays: 14,
        lactationStart: start,
        peakDaysInMilk: 45,
      }),
    ).toEqual([]);
    // Peak day already passed -> not listed (unlike calving/dry-off).
    const old = new Date(now.getTime() - 90 * 86_400_000);
    expect(
      computeLookahead({ now, windowDays: 14, lactationStart: old }),
    ).toEqual([]);
    // Too far ahead.
    const fresh = new Date(now.getTime() - 10 * 86_400_000);
    expect(
      computeLookahead({ now, windowDays: 14, lactationStart: fresh }),
    ).toEqual([]);
  });

  it('ignores the time of day', () => {
    expect(
      computeLookahead({
        now: new Date('2026-09-25T23:30:00.000Z'),
        windowDays: 14,
        expectedCalvingDate: new Date('2026-09-26T00:10:00.000Z'),
      }),
    ).toEqual([{ kind: 'calving', in_days: 1 }]);
  });
});
