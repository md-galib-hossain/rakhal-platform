import {
  InvalidDateError,
  InvalidPresetError,
  InvalidRangeError,
  InvalidTimezoneError,
  PeriodError,
} from './errors';
import {
  closedPeriodFor,
  detectPeriodKind,
  enumerateDays,
  previousEquivalentPeriod,
  resolvePreset,
  scheduledRunInstant,
} from './period-resolver';

const DHAKA = 'Asia/Dhaka';
const NY = 'America/New_York';
const at = (iso: string) => new Date(iso);
const hours = (p: { start: string; end: string }) =>
  (Date.parse(p.end) - Date.parse(p.start)) / 3_600_000;

describe('resolvePreset', () => {
  it('Dhaka this_week is Mon-Sun, [start,end) at local midnights', () => {
    const p = resolvePreset('this_week', at('2026-10-23T10:00:00Z'), DHAKA);
    expect(p.startDate).toBe('2026-10-19');
    expect(p.endDate).toBe('2026-10-25');
    expect(p.start).toBe('2026-10-18T18:00:00.000Z');
    expect(p.end).toBe('2026-10-25T18:00:00.000Z');
    expect(p.label).toBe('2026-W43');
    expect(p.timezone).toBe(DHAKA);
  });

  it('uses the local date when it differs from the UTC date', () => {
    // 20:00Z on the 22nd is 02:00 on the 23rd in Dhaka.
    const p = resolvePreset('today', at('2026-10-22T20:00:00Z'), DHAKA);
    expect(p.startDate).toBe('2026-10-23');
    expect(p.start).toBe('2026-10-22T18:00:00.000Z');
    expect(hours(p)).toBe(24);
    // New York is still on the 22nd at that instant.
    expect(
      resolvePreset('today', at('2026-10-22T20:00:00Z'), NY).startDate,
    ).toBe('2026-10-22');
  });

  it('Monday boundary flips exactly at local midnight', () => {
    const sun = resolvePreset('this_week', at('2026-10-25T17:59:59Z'), DHAKA);
    const mon = resolvePreset('this_week', at('2026-10-25T18:00:00Z'), DHAKA);
    expect(sun.startDate).toBe('2026-10-19');
    expect(mon.startDate).toBe('2026-10-26');
    expect(mon.endDate).toBe('2026-11-01');
  });

  it('this_month and this_year', () => {
    const m = resolvePreset('this_month', at('2026-10-23T10:00:00Z'), DHAKA);
    expect([m.startDate, m.endDate, m.label]).toEqual([
      '2026-10-01',
      '2026-10-31',
      'October 2026',
    ]);
    const y = resolvePreset('this_year', at('2026-10-23T10:00:00Z'), DHAKA);
    expect([y.startDate, y.endDate, y.label]).toEqual([
      '2026-01-01',
      '2026-12-31',
      '2026',
    ]);
    expect(y.start).toBe('2025-12-31T18:00:00.000Z');
  });

  it('year boundary: Jan 1 2026 belongs to ISO week 2026-W01 (Dec 29 - Jan 4)', () => {
    const p = resolvePreset('this_week', at('2026-01-01T03:00:00Z'), DHAKA);
    expect(p.startDate).toBe('2025-12-29');
    expect(p.endDate).toBe('2026-01-04');
    expect(p.label).toBe('2026-W01');
  });

  it('New York spring-forward day is 23h and its week is 167h', () => {
    const day = resolvePreset('today', at('2026-03-08T15:00:00Z'), NY);
    expect(day.start).toBe('2026-03-08T05:00:00.000Z');
    expect(day.end).toBe('2026-03-09T04:00:00.000Z');
    expect(hours(day)).toBe(23);
    const wk = resolvePreset('this_week', at('2026-03-08T15:00:00Z'), NY);
    expect(wk.startDate).toBe('2026-03-02');
    expect(hours(wk)).toBe(167);
  });

  it('New York fall-back day is 25h and its week is 169h', () => {
    const day = resolvePreset('today', at('2026-11-01T15:00:00Z'), NY);
    expect(day.start).toBe('2026-11-01T04:00:00.000Z');
    expect(day.end).toBe('2026-11-02T05:00:00.000Z');
    expect(hours(day)).toBe(25);
    const wk = resolvePreset('this_week', at('2026-11-01T15:00:00Z'), NY);
    expect(wk.startDate).toBe('2026-10-26');
    expect(hours(wk)).toBe(169);
  });

  it('adjacent periods leave no gap or overlap across DST', () => {
    const a = resolvePreset('this_week', at('2026-03-08T15:00:00Z'), NY);
    const b = resolvePreset('this_week', at('2026-03-10T15:00:00Z'), NY);
    expect(a.end).toBe(b.start);
  });

  describe('custom', () => {
    it('accepts a single day and a range', () => {
      const one = resolvePreset('custom', at('2026-10-23T00:00:00Z'), DHAKA, {
        from: '2026-10-10',
        to: '2026-10-10',
      });
      expect(one.label).toBe('2026-10-10');
      const r = resolvePreset('custom', at('2026-10-23T00:00:00Z'), DHAKA, {
        from: '2026-10-10',
        to: '2026-10-14',
      });
      expect(r.startDate).toBe('2026-10-10');
      expect(r.end).toBe('2026-10-14T18:00:00.000Z');
    });

    it('rejects bad input with typed errors', () => {
      const now = at('2026-10-23T00:00:00Z');
      expect(() =>
        resolvePreset('custom', now, DHAKA, {
          from: '2026-10-12',
          to: '2026-10-11',
        }),
      ).toThrow(InvalidRangeError);
      expect(() =>
        resolvePreset('custom', now, DHAKA, {
          from: '2026-02-30',
          to: '2026-03-01',
        }),
      ).toThrow(InvalidDateError);
      expect(() =>
        resolvePreset('custom', now, DHAKA, {
          from: '10/10/2026',
          to: '2026-10-11',
        }),
      ).toThrow(InvalidDateError);
      expect(() => resolvePreset('custom', now, DHAKA)).toThrow(
        InvalidPresetError,
      );
    });
  });

  it('rejects an invalid timezone', () => {
    expect(() =>
      resolvePreset('today', at('2026-10-23T00:00:00Z'), 'Mars/Base'),
    ).toThrow(InvalidTimezoneError);
    expect(() =>
      resolvePreset('today', at('2026-10-23T00:00:00Z'), ''),
    ).toThrow(PeriodError);
  });
});

describe('closedPeriodFor', () => {
  it('WEEKLY: last fully closed Mon-Sun week', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-10-23T10:00:00Z'), DHAKA);
    expect([p.startDate, p.endDate]).toEqual(['2026-10-12', '2026-10-18']);
  });

  it('WEEKLY at Monday 00:00 local closes the week that just ended', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-10-25T18:00:00Z'), DHAKA);
    expect([p.startDate, p.endDate]).toEqual(['2026-10-19', '2026-10-25']);
    const before = closedPeriodFor('WEEKLY', at('2026-10-25T17:59:59Z'), DHAKA);
    expect(before.startDate).toBe('2026-10-12');
  });

  it('WEEKLY across the New York spring-forward week', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-03-10T12:00:00Z'), NY);
    expect([p.startDate, p.endDate]).toEqual(['2026-03-02', '2026-03-08']);
    expect(hours(p)).toBe(167);
  });

  it('WEEKLY across a year boundary', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-01-01T03:00:00Z'), DHAKA);
    expect([p.startDate, p.endDate, p.label]).toEqual([
      '2025-12-22',
      '2025-12-28',
      '2025-W52',
    ]);
  });

  it('MONTHLY: previous calendar month, Jan -> Dec, leap Feb', () => {
    const jan = closedPeriodFor('MONTHLY', at('2026-01-01T03:00:00Z'), DHAKA);
    expect([jan.startDate, jan.endDate, jan.label]).toEqual([
      '2025-12-01',
      '2025-12-31',
      'December 2025',
    ]);
    const leap = closedPeriodFor('MONTHLY', at('2028-03-05T10:00:00Z'), DHAKA);
    expect([leap.startDate, leap.endDate]).toEqual([
      '2028-02-01',
      '2028-02-29',
    ]);
    const plain = closedPeriodFor('MONTHLY', at('2026-03-05T10:00:00Z'), DHAKA);
    expect(plain.endDate).toBe('2026-02-28');
  });

  it('MONTHLY uses local month: 20:00Z on Oct 31 is already Nov 1 in Dhaka', () => {
    const p = closedPeriodFor('MONTHLY', at('2026-10-31T20:00:00Z'), DHAKA);
    expect(p.label).toBe('October 2026');
  });

  it('rejects an invalid timezone', () => {
    expect(() =>
      closedPeriodFor('WEEKLY', at('2026-10-23T10:00:00Z'), 'Nope/Zone'),
    ).toThrow(InvalidTimezoneError);
  });
});

describe('previousEquivalentPeriod', () => {
  const NOW = at('2026-10-23T10:00:00Z');

  it('today -> yesterday, not partial', () => {
    const r = previousEquivalentPeriod(resolvePreset('today', NOW, DHAKA), NOW);
    expect(r.kind).toBe('day');
    expect(r.previous.startDate).toBe('2026-10-22');
    expect(r.partial).toBe(false);
  });

  it('closed week -> previous week; closed month -> previous month', () => {
    const wk = closedPeriodFor('WEEKLY', NOW, DHAKA);
    const pw = previousEquivalentPeriod(wk, NOW);
    expect([pw.previous.startDate, pw.previous.endDate, pw.partial]).toEqual([
      '2026-10-05',
      '2026-10-11',
      false,
    ]);
    const mo = closedPeriodFor('MONTHLY', NOW, DHAKA);
    const pm = previousEquivalentPeriod(mo, NOW);
    expect([pm.previous.startDate, pm.previous.endDate]).toEqual([
      '2026-08-01',
      '2026-08-31',
    ]);
  });

  it('month: Jan -> Dec, March -> Feb (leap and non-leap)', () => {
    const jan = resolvePreset('this_month', at('2027-02-10T10:00:00Z'), DHAKA);
    // Feb 2027 -> Jan 2027 (closed comparison uses explicit later now)
    const later = at('2027-06-01T00:00:00Z');
    const r = previousEquivalentPeriod(
      resolvePreset('custom', later, DHAKA, {
        from: '2027-01-01',
        to: '2027-01-31',
      }),
      later,
    );
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2026-12-01',
      '2026-12-31',
    ]);
    expect(jan.label).toBe('February 2027');
    const mar = previousEquivalentPeriod(
      resolvePreset('custom', later, DHAKA, {
        from: '2028-03-01',
        to: '2028-03-31',
      }),
      later,
    );
    expect(mar.previous.endDate).toBe('2028-02-29');
    const marPlain = previousEquivalentPeriod(
      resolvePreset('custom', later, DHAKA, {
        from: '2027-03-01',
        to: '2027-03-31',
      }),
      later,
    );
    expect(marPlain.previous.endDate).toBe('2027-02-28');
  });

  it('year -> previous year', () => {
    const later = at('2028-06-01T00:00:00Z');
    const r = previousEquivalentPeriod(
      resolvePreset('custom', later, DHAKA, {
        from: '2027-01-01',
        to: '2027-12-31',
      }),
      later,
    );
    expect(r.kind).toBe('year');
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2026-01-01',
      '2026-12-31',
    ]);
  });

  it('custom -> same-length window immediately before', () => {
    const p = resolvePreset('custom', NOW, DHAKA, {
      from: '2026-10-10',
      to: '2026-10-14',
    });
    const r = previousEquivalentPeriod(p, NOW);
    expect(r.kind).toBe('custom');
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2026-10-05',
      '2026-10-09',
    ]);
    expect(r.previous.end).toBe(p.start);
    expect(r.partial).toBe(false);
  });

  it('in-progress week: partial, same elapsed span', () => {
    const wed = at('2026-10-21T10:00:00Z');
    const r = previousEquivalentPeriod(
      resolvePreset('this_week', wed, DHAKA),
      wed,
    );
    expect(r.partial).toBe(true);
    expect([r.current.startDate, r.current.endDate]).toEqual([
      '2026-10-19',
      '2026-10-21',
    ]);
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2026-10-12',
      '2026-10-14',
    ]);
  });

  it('in-progress month: previous capped at its own length (31 Mar vs Feb)', () => {
    const now = at('2026-03-31T06:00:00Z');
    const r = previousEquivalentPeriod(
      resolvePreset('this_month', now, DHAKA),
      now,
    );
    expect(r.partial).toBe(true);
    expect(r.current.endDate).toBe('2026-03-31');
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2026-02-01',
      '2026-02-28',
    ]);
  });

  it('in-progress year (Jan 1 -> Dec): one elapsed day vs Jan 1 of last year', () => {
    const now = at('2026-01-01T03:00:00Z');
    const r = previousEquivalentPeriod(
      resolvePreset('this_year', now, DHAKA),
      now,
    );
    expect(r.partial).toBe(true);
    expect([r.previous.startDate, r.previous.endDate]).toEqual([
      '2025-01-01',
      '2025-01-01',
    ]);
  });

  it('a period that ended is not partial even if kind is week', () => {
    const wk = closedPeriodFor('WEEKLY', NOW, DHAKA);
    expect(previousEquivalentPeriod(wk, NOW).partial).toBe(false);
  });

  it('New York previous week across spring-forward has no gap', () => {
    const now = at('2026-03-20T12:00:00Z');
    const cur = closedPeriodFor('WEEKLY', now, NY); // Mar 9-15
    const prev = previousEquivalentPeriod(cur, now).previous; // Mar 2-8
    expect(prev.startDate).toBe('2026-03-02');
    expect(prev.end).toBe(cur.start);
  });
});

describe('detectPeriodKind', () => {
  it('classifies shapes', () => {
    const now = at('2026-10-23T10:00:00Z');
    expect(detectPeriodKind(resolvePreset('today', now, DHAKA))).toBe('day');
    expect(detectPeriodKind(resolvePreset('this_week', now, DHAKA))).toBe(
      'week',
    );
    expect(detectPeriodKind(resolvePreset('this_month', now, DHAKA))).toBe(
      'month',
    );
    expect(detectPeriodKind(resolvePreset('this_year', now, DHAKA))).toBe(
      'year',
    );
    expect(
      detectPeriodKind(
        resolvePreset('custom', now, DHAKA, {
          from: '2026-10-02',
          to: '2026-10-09',
        }),
      ),
    ).toBe('custom');
  });
});

describe('scheduledRunInstant', () => {
  it('Dhaka: 00:00 local the day after the period ends', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-10-23T10:00:00Z'), DHAKA);
    expect(scheduledRunInstant(p, DHAKA).toISOString()).toBe(
      '2026-10-18T18:00:00.000Z',
    );
  });

  it('month-end: leap February run is Mar 1 00:00 local', () => {
    const p = closedPeriodFor('MONTHLY', at('2028-03-05T10:00:00Z'), DHAKA);
    expect(scheduledRunInstant(p, DHAKA).toISOString()).toBe(
      '2028-02-29T18:00:00.000Z',
    );
  });

  it('month-end Dec 31 rolls into next year', () => {
    const p = closedPeriodFor('MONTHLY', at('2026-01-01T03:00:00Z'), DHAKA);
    expect(scheduledRunInstant(p, DHAKA).toISOString()).toBe(
      '2025-12-31T18:00:00.000Z',
    );
  });

  it('New York DST: spring-forward week runs at EDT midnight', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-03-10T12:00:00Z'), NY);
    expect(scheduledRunInstant(p, NY).toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });

  it('New York DST: October month run is Nov 1 00:00 EDT (before fall-back)', () => {
    const p = closedPeriodFor('MONTHLY', at('2026-11-05T12:00:00Z'), NY);
    expect(scheduledRunInstant(p, NY).toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });

  it('New York DST: week ending on fall-back Sunday runs Mon 00:00 EST', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-11-03T12:00:00Z'), NY);
    expect(p.endDate).toBe('2026-11-01');
    expect(scheduledRunInstant(p, NY).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('rejects an invalid timezone', () => {
    const p = closedPeriodFor('WEEKLY', at('2026-10-23T10:00:00Z'), DHAKA);
    expect(() => scheduledRunInstant(p, 'Bad/Zone')).toThrow(
      InvalidTimezoneError,
    );
  });
});

describe('enumerateDays', () => {
  it('lists every farm-local day inclusive', () => {
    const wk = resolvePreset('this_week', at('2026-10-23T10:00:00Z'), DHAKA);
    expect(enumerateDays(wk)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('counts 29 days in leap February and 365/366 in years', () => {
    const now = at('2028-02-10T10:00:00Z');
    expect(
      enumerateDays(
        closedPeriodFor('MONTHLY', at('2028-03-05T00:00:00Z'), DHAKA),
      ),
    ).toHaveLength(29);
    expect(enumerateDays(resolvePreset('this_year', now, DHAKA))).toHaveLength(
      366,
    );
    expect(
      enumerateDays(
        resolvePreset('this_year', at('2026-06-01T00:00:00Z'), DHAKA),
      ),
    ).toHaveLength(365);
  });

  it('DST days still count as one calendar day each', () => {
    const wk = resolvePreset('this_week', at('2026-03-08T15:00:00Z'), NY);
    expect(enumerateDays(wk)).toHaveLength(7);
  });
});
