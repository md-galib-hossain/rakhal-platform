import { zonedToUtc } from '../../../common/farm-time/farm-time';
import {
  addDaysYmd,
  addMonthsClampedYmd,
  advanceSeries,
  anchorForIndex,
  anchorFromEntity,
  applyJitter,
  computeFireAt,
  endOfDayKey,
  eventKeyForBand,
  firstLiveAnchor,
  isAnchorInFuture,
  jitterSeconds,
  localParts,
  normalizeLeads,
  SERIES_MAX_ANCHORS,
  SYSTEM_JITTER_SECONDS,
  validateLeads,
  validateRepeat,
} from './schedule-math';

const DHAKA = 'Asia/Dhaka';
const NY = 'America/New_York';
const iso = (d: Date | null | undefined) => d?.toISOString();
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

describe('zonedToUtc', () => {
  it('converts a plain wall time (Dhaka is UTC+6, no DST)', () => {
    expect(iso(zonedToUtc(DHAKA, '2026-11-10', '08:00'))).toBe(
      '2026-11-10T02:00:00.000Z',
    );
  });

  it('uses the zone offset in effect on that date (New York summer vs winter)', () => {
    expect(iso(zonedToUtc(NY, '2026-07-01', '09:00'))).toBe(
      '2026-07-01T13:00:00.000Z',
    );
    expect(iso(zonedToUtc(NY, '2026-01-15', '09:00'))).toBe(
      '2026-01-15T14:00:00.000Z',
    );
  });

  it('moves a nonexistent local time (spring-forward gap) to the first valid minute after it', () => {
    // 2026-03-08 02:30 does not exist in New York; 03:00 EDT = 07:00Z is the first valid minute.
    expect(iso(zonedToUtc(NY, '2026-03-08', '02:30'))).toBe(
      '2026-03-08T07:00:00.000Z',
    );
  });

  it('takes the first occurrence of an ambiguous local time (fall-back overlap)', () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT = 05:30Z.
    expect(iso(zonedToUtc(NY, '2026-11-01', '01:30'))).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('falls back to the default zone for an invalid timezone', () => {
    expect(iso(zonedToUtc('Not/AZone', '2026-11-10', '08:00'))).toBe(
      '2026-11-10T02:00:00.000Z',
    );
  });
});

describe('calendar helpers', () => {
  it('addDaysYmd crosses month/year/leap boundaries and goes negative', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addMonthsClampedYmd clamps to month end and does not drift (always from the base)', () => {
    expect(addMonthsClampedYmd('2027-01-31', 0)).toBe('2027-01-31');
    expect(addMonthsClampedYmd('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsClampedYmd('2027-01-31', 2)).toBe('2027-03-31');
    expect(addMonthsClampedYmd('2028-01-31', 1)).toBe('2028-02-29'); // leap
    expect(addMonthsClampedYmd('2026-12-31', 2)).toBe('2027-02-28'); // year rollover
    expect(addMonthsClampedYmd('2026-11-30', 12)).toBe('2027-11-30');
  });

  it('localParts reads the farm wall clock', () => {
    expect(localParts(new Date('2026-11-10T19:30:00Z'), DHAKA)).toEqual({
      ymd: '2026-11-11',
      hm: '01:30',
    });
  });
});

describe('computeFireAt', () => {
  it('allDay: sendTime farm-local, N whole days before the anchor day', () => {
    const anchorAt = day('2026-11-20');
    const fire = (leadMinutes: number) =>
      iso(
        computeFireAt({
          anchorAt,
          allDay: true,
          sendTime: '08:00',
          leadMinutes,
          timezone: DHAKA,
        }),
      );
    expect(fire(10080)).toBe('2026-11-13T02:00:00.000Z');
    expect(fire(1440)).toBe('2026-11-19T02:00:00.000Z');
    expect(fire(0)).toBe('2026-11-20T02:00:00.000Z');
  });

  it('allDay: defaults to 08:00 farm-local and honours a custom sendTime', () => {
    const anchorAt = day('2026-11-20');
    expect(
      iso(
        computeFireAt({
          anchorAt,
          allDay: true,
          leadMinutes: 0,
          timezone: DHAKA,
        }),
      ),
    ).toBe('2026-11-20T02:00:00.000Z');
    expect(
      iso(
        computeFireAt({
          anchorAt,
          allDay: true,
          sendTime: '18:30',
          leadMinutes: 0,
          timezone: DHAKA,
        }),
      ),
    ).toBe('2026-11-20T12:30:00.000Z');
  });

  it('timed: anchor instant minus the lead in minutes', () => {
    const anchorAt = new Date('2026-11-10T04:30:00Z');
    const fire = (leadMinutes: number) =>
      iso(
        computeFireAt({
          anchorAt,
          allDay: false,
          leadMinutes,
          timezone: DHAKA,
        }),
      );
    expect(fire(0)).toBe('2026-11-10T04:30:00.000Z');
    expect(fire(60)).toBe('2026-11-10T03:30:00.000Z');
    expect(fire(1440)).toBe('2026-11-09T04:30:00.000Z');
  });

  it('allDay lead days are calendar days, not 24h blocks, across a DST change', () => {
    const anchorAt = day('2026-03-09');
    const args = { anchorAt, allDay: true, sendTime: '08:00', timezone: NY };
    // 1 day before = Mar 8 08:00 EDT (after the 02:00 spring-forward) = 12:00Z.
    expect(iso(computeFireAt({ ...args, leadMinutes: 1440 }))).toBe(
      '2026-03-08T12:00:00.000Z',
    );
    // 7 days before = Mar 2 08:00 EST = 13:00Z.
    expect(iso(computeFireAt({ ...args, leadMinutes: 10080 }))).toBe(
      '2026-03-02T13:00:00.000Z',
    );
  });

  it('allDay sendTime inside the DST gap moves forward to the next valid minute', () => {
    expect(
      iso(
        computeFireAt({
          anchorAt: day('2026-03-09'),
          allDay: true,
          sendTime: '02:30',
          leadMinutes: 1440,
          timezone: NY,
        }),
      ),
    ).toBe('2026-03-08T07:00:00.000Z');
  });
});

describe('leads', () => {
  it('validates count, range, integrality and whole days for allDay', () => {
    expect(validateLeads([], true)).toBe('LEADS_EMPTY');
    expect(
      validateLeads(
        [0, 1, 2, 3, 4].map((n) => n * 1440),
        true,
      ),
    ).toBe('LEADS_TOO_MANY');
    expect(validateLeads([-1], false)).toBe('LEAD_NEGATIVE');
    expect(validateLeads([90 * 1440 + 1], false)).toBe('LEAD_TOO_LONG');
    expect(validateLeads([1.5], false)).toBe('LEAD_NOT_INTEGER');
    expect(validateLeads([90], true)).toBe('LEAD_NOT_WHOLE_DAYS');
    expect(validateLeads([90], false)).toBeNull();
    expect(validateLeads([10080, 1440, 0], true)).toBeNull();
    expect(validateLeads([90 * 1440], true)).toBeNull();
  });

  it('normalizes: de-duplicated, sorted descending', () => {
    expect(normalizeLeads([0, 1440, 0, 10080])).toEqual([10080, 1440, 0]);
  });
});

describe('anchorFromEntity (BEFORE / AFTER an entity)', () => {
  it('allDay: subtracts for BEFORE, adds for AFTER, in calendar days', () => {
    const entityAt = day('2026-11-20');
    const base = { entityAt, allDay: true, timezone: DHAKA };
    expect(
      iso(
        anchorFromEntity({ ...base, trigger: 'BEFORE_EVENT', offsetDays: 7 }),
      ),
    ).toBe('2026-11-13T00:00:00.000Z');
    expect(
      iso(anchorFromEntity({ ...base, trigger: 'AFTER_EVENT', offsetDays: 3 })),
    ).toBe('2026-11-23T00:00:00.000Z');
    expect(
      iso(anchorFromEntity({ ...base, trigger: 'AFTER_EVENT', offsetDays: 0 })),
    ).toBe('2026-11-20T00:00:00.000Z');
  });

  it('timed: keeps the farm wall-clock time', () => {
    // 16:00 Dhaka, 2 days before
    expect(
      iso(
        anchorFromEntity({
          trigger: 'BEFORE_EVENT',
          entityAt: new Date('2026-11-20T10:00:00Z'),
          offsetDays: 2,
          allDay: false,
          timezone: DHAKA,
        }),
      ),
    ).toBe('2026-11-18T10:00:00.000Z');
    // 09:00 EDT on Mar 9, 2 days before = 09:00 EST on Mar 7 = 14:00Z
    expect(
      iso(
        anchorFromEntity({
          trigger: 'BEFORE_EVENT',
          entityAt: new Date('2026-03-09T13:00:00Z'),
          offsetDays: 2,
          allDay: false,
          timezone: NY,
        }),
      ),
    ).toBe('2026-03-07T14:00:00.000Z');
  });

  it('isAnchorInFuture rejects a moment that has passed', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    expect(isAnchorInFuture(new Date('2026-11-09T23:59:59Z'), now)).toBe(false);
    expect(isAnchorInFuture(new Date('2026-11-10T00:00:00Z'), now)).toBe(false);
    expect(isAnchorInFuture(new Date('2026-11-10T00:00:01Z'), now)).toBe(true);
  });
});

describe('anchorForIndex (repeat series from the base)', () => {
  const series = (over: object = {}) => ({
    baseAnchorAt: day('2026-11-02'), // a Monday
    allDay: true,
    repeat: 'WEEKLY' as const,
    repeatInterval: null,
    repeatEndDate: null,
    timezone: DHAKA,
    ...over,
  });
  const ymd = (d: Date | null) => d?.toISOString().slice(0, 10);

  it('NONE has only anchor 0', () => {
    expect(ymd(anchorForIndex(series({ repeat: 'NONE' }), 0))).toBe(
      '2026-11-02',
    );
    expect(anchorForIndex(series({ repeat: 'NONE' }), 1)).toBeNull();
  });

  it('WEEKLY keeps the weekday', () => {
    expect(ymd(anchorForIndex(series(), 3))).toBe('2026-11-23');
  });

  it('EVERY_N_DAYS is base + k * N calendar days; needs an interval', () => {
    const s = series({ repeat: 'EVERY_N_DAYS', repeatInterval: 10 });
    expect(ymd(anchorForIndex(s, 4))).toBe('2026-12-12');
    expect(
      anchorForIndex(series({ repeat: 'EVERY_N_DAYS', repeatInterval: 0 }), 1),
    ).toBeNull();
  });

  it('MONTHLY clamps at month end and returns to the 31st (no drift)', () => {
    const s = series({ repeat: 'MONTHLY', baseAnchorAt: day('2027-01-31') });
    expect([0, 1, 2, 3].map((k) => ymd(anchorForIndex(s, k)))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });

  it('end date is inclusive', () => {
    const s = series({ repeatEndDate: endOfDayKey('2026-11-16') });
    expect(ymd(anchorForIndex(s, 2))).toBe('2026-11-16');
    expect(anchorForIndex(s, 3)).toBeNull();
  });

  it('caps the series at 400 anchors (indexes 0..399)', () => {
    const s = series({ repeat: 'EVERY_N_DAYS', repeatInterval: 1 });
    expect(anchorForIndex(s, SERIES_MAX_ANCHORS - 1)).not.toBeNull();
    expect(anchorForIndex(s, SERIES_MAX_ANCHORS)).toBeNull();
    expect(anchorForIndex(s, -1)).toBeNull();
  });

  it('timed series keeps the farm wall-clock time across a DST change', () => {
    const s = series({
      allDay: false,
      timezone: NY,
      baseAnchorAt: new Date('2026-03-07T14:00:00Z'), // 09:00 EST
    });
    expect(iso(anchorForIndex(s, 1))).toBe('2026-03-14T13:00:00.000Z'); // 09:00 EDT
  });
});

describe('live occurrences and series advance', () => {
  const series = {
    baseAnchorAt: day('2026-11-02'),
    allDay: true,
    sendTime: '08:00',
    leadMinutes: [0],
    repeat: 'WEEKLY' as const,
    repeatInterval: null,
    repeatEndDate: null,
    timezone: DHAKA,
  };

  it('starts a past series at its first anchor that still has a live occurrence', () => {
    const start = firstLiveAnchor(series, 0, new Date('2026-11-10T00:00:00Z'));
    expect(start?.seriesIndex).toBe(2);
    expect(iso(start?.anchorAt)).toBe('2026-11-16T00:00:00.000Z');
    expect(start?.occurrences.map((o) => iso(o.fireAt))).toEqual([
      '2026-11-16T02:00:00.000Z',
    ]);
  });

  it('drops past leads silently but keeps the live ones of the same anchor', () => {
    const start = firstLiveAnchor(
      { ...series, repeat: 'NONE', leadMinutes: [10080, 1440, 0] },
      0,
      new Date('2026-11-01T01:00:00Z'), // the 7-day lead (26 Oct) is gone; 1 Nov 08:00 Dhaka is not
    );
    expect(start?.occurrences.map((o) => o.leadMinutes)).toEqual([1440, 0]);
  });

  it('a one-off schedule entirely in the past yields null', () => {
    expect(
      firstLiveAnchor(
        { ...series, repeat: 'NONE' },
        0,
        new Date('2026-12-01T00:00:00Z'),
      ),
    ).toBeNull();
  });

  it('advanceSeries moves to the next anchor and ends at the end date', () => {
    const now = new Date('2026-11-02T03:00:00Z');
    expect(advanceSeries(series, 0, now)?.seriesIndex).toBe(1);
    const ending = { ...series, repeatEndDate: endOfDayKey('2026-11-09') };
    expect(advanceSeries(ending, 0, now)?.seriesIndex).toBe(1);
    expect(advanceSeries(ending, 1, now)).toBeNull();
    expect(advanceSeries({ ...series, repeat: 'NONE' }, 0, now)).toBeNull();
  });

  it('advanceSeries stops at the 400 cap', () => {
    const daily = {
      ...series,
      repeat: 'EVERY_N_DAYS' as const,
      repeatInterval: 1,
    };
    const now = new Date('2026-11-02T03:00:00Z');
    expect(advanceSeries(daily, 398, now)?.seriesIndex).toBe(399);
    expect(advanceSeries(daily, 399, now)).toBeNull();
  });
});

describe('validateRepeat', () => {
  it('requires a 1..365 interval for EVERY_N_DAYS', () => {
    const base = { repeat: 'EVERY_N_DAYS' as const, startYmd: '2026-11-10' };
    expect(validateRepeat(base)).toBe('REPEAT_INTERVAL_REQUIRED');
    expect(validateRepeat({ ...base, repeatInterval: 0 })).toBe(
      'REPEAT_INTERVAL_OUT_OF_RANGE',
    );
    expect(validateRepeat({ ...base, repeatInterval: 366 })).toBe(
      'REPEAT_INTERVAL_OUT_OF_RANGE',
    );
    expect(validateRepeat({ ...base, repeatInterval: 365 })).toBeNull();
  });

  it('checks the end date', () => {
    const base = { repeat: 'WEEKLY' as const, startYmd: '2026-11-10' };
    expect(validateRepeat({ ...base, endDateYmd: '2026-11-09' })).toBe(
      'REPEAT_END_BEFORE_START',
    );
    expect(validateRepeat({ ...base, endDateYmd: 'soon' })).toBe(
      'REPEAT_END_INVALID',
    );
    expect(validateRepeat({ ...base, endDateYmd: '2026-11-10' })).toBeNull();
    expect(
      validateRepeat({ repeat: 'NONE', startYmd: '2026-11-10' }),
    ).toBeNull();
  });
});

describe('event key by band and jitter', () => {
  it('maps origin + lead to the catalogue key', () => {
    expect(eventKeyForBand('USER', 1440)).toBe('custom_reminder');
    expect(eventKeyForBand('USER', 0)).toBe('custom_reminder');
    expect(eventKeyForBand('SYSTEM', 1440)).toBe('scheduled_upcoming');
    expect(eventKeyForBand('SYSTEM', 0)).toBe('scheduled_due');
  });

  it('jitter is deterministic and bounded; only SYSTEM occurrences get it', () => {
    expect(jitterSeconds('abc')).toBe(jitterSeconds('abc'));
    for (const id of ['a', 'b', 'cl9x1', 'occ-0001', 'zzzzzzzz']) {
      const j = jitterSeconds(id);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(SYSTEM_JITTER_SECONDS);
    }
    const fireAt = new Date('2026-11-10T02:00:00Z');
    expect(applyJitter(fireAt, 'x', 'USER')).toBe(fireAt);
    expect(applyJitter(fireAt, 'x', 'SYSTEM').getTime()).toBe(
      fireAt.getTime() + jitterSeconds('x') * 1000,
    );
  });
});
