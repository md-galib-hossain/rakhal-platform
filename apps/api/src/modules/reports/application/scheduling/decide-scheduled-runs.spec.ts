import {
  decideScheduledRuns,
  withinFinalizationWindow,
  type DecideScheduledRunsInput,
} from './decide-scheduled-runs';

const FARM = `c${'a'.repeat(24)}`;
const OLD_FARM = new Date('2020-01-01T00:00:00Z');

const base = (
  over: Partial<DecideScheduledRunsInput>,
): DecideScheduledRunsInput => ({
  farmId: FARM,
  now: new Date('2026-10-24T10:00:00Z'),
  farmTimezone: 'Asia/Dhaka',
  farmCreatedAt: OLD_FARM,
  templates: { WEEKLY: { version: 1 }, MONTHLY: { version: 1 } },
  ...over,
});

const starts = (r: ReturnType<typeof decideScheduledRuns>, type: string) =>
  r.due.filter((d) => d.type === type).map((d) => d.period.startDate);

describe('decideScheduledRuns', () => {
  it('returns the current closed period and the previous one, per type, newest first', () => {
    const r = decideScheduledRuns(base({}));
    expect(starts(r, 'WEEKLY')).toEqual(['2026-10-12', '2026-10-05']);
    expect(starts(r, 'MONTHLY')).toEqual(['2026-09-01', '2026-08-01']);
    expect(r.due[0].scheduledKey).toBe(`${FARM}:WEEKLY:2026-10-12:v1`);
  });

  it('reports the period just outside the window as a missed candidate, not as due', () => {
    const r = decideScheduledRuns(base({}));
    expect(r.missedCandidates).toEqual([
      { type: 'WEEKLY', periodStartDate: '2026-09-28' },
      { type: 'MONTHLY', periodStartDate: '2026-07-01' },
    ]);
  });

  it('skips a type with no template', () => {
    const r = decideScheduledRuns(
      base({ templates: { MONTHLY: { version: 3 } } }),
    );
    expect(starts(r, 'WEEKLY')).toEqual([]);
    expect(r.due[0].scheduledKey).toBe(`${FARM}:MONTHLY:2026-09-01:v3`);
  });

  it('skips periods that ended before the farm existed, with no missed candidate', () => {
    const r = decideScheduledRuns(
      base({ farmCreatedAt: new Date('2026-10-15T00:00:00Z') }),
    );
    expect(starts(r, 'WEEKLY')).toEqual(['2026-10-12']);
    expect(starts(r, 'MONTHLY')).toEqual([]);
    expect(r.missedCandidates).toEqual([]);
  });

  it('a brand-new farm gets nothing', () => {
    const now = new Date('2026-10-24T10:00:00Z');
    expect(decideScheduledRuns(base({ farmCreatedAt: now })).due).toEqual([]);
  });

  describe('week boundary (Asia/Dhaka, UTC+6)', () => {
    it('is due exactly at Monday 00:00 local', () => {
      const r = decideScheduledRuns(
        base({ now: new Date('2026-10-18T18:00:00Z') }),
      );
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-10-12');
    });
    it('is not due one second earlier', () => {
      const r = decideScheduledRuns(
        base({ now: new Date('2026-10-18T17:59:59Z') }),
      );
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-10-05');
    });
    it('uses the farm-local date even when the UTC date is still Sunday', () => {
      const r = decideScheduledRuns(
        base({ now: new Date('2026-10-18T20:00:00Z') }),
      );
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-10-12');
    });
  });

  describe('Pacific/Kiritimati (UTC+14)', () => {
    const tz = 'Pacific/Kiritimati';
    it('is already Monday locally while UTC is Sunday', () => {
      const r = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-10-18T10:30:00Z') }),
      );
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-10-12');
    });
    it('is not due before local midnight', () => {
      const r = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-10-18T09:59:59Z') }),
      );
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-10-05');
    });
  });

  describe('America/New_York DST', () => {
    const tz = 'America/New_York';
    it('fall-back week (ends Sun 1 Nov) is due at 05:00Z Monday, not 04:00Z', () => {
      const on = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-11-02T05:00:00Z') }),
      );
      expect(starts(on, 'WEEKLY')[0]).toBe('2026-10-26');
      const before = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-11-02T04:59:59Z') }),
      );
      expect(starts(before, 'WEEKLY')[0]).toBe('2026-10-19');
    });
    it('spring-forward week (ends Sun 8 Mar) is due at 04:00Z Monday', () => {
      const on = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-03-09T04:00:00Z') }),
      );
      expect(starts(on, 'WEEKLY')[0]).toBe('2026-03-02');
      const before = decideScheduledRuns(
        base({ farmTimezone: tz, now: new Date('2026-03-09T03:59:59Z') }),
      );
      expect(starts(before, 'WEEKLY')[0]).toBe('2026-02-23');
    });
  });

  describe('month and year ends', () => {
    it('crosses the year boundary (Jan -> previous December)', () => {
      const r = decideScheduledRuns(
        base({ now: new Date('2027-01-03T10:00:00Z') }),
      );
      expect(starts(r, 'MONTHLY')).toEqual(['2026-12-01', '2026-11-01']);
      expect(starts(r, 'WEEKLY')[0]).toBe('2026-12-21');
    });
    it('handles February (28 days) and leap February (29 days)', () => {
      const plain = decideScheduledRuns(
        base({ now: new Date('2026-03-01T10:00:00Z') }),
      );
      const p = plain.due.find((d) => d.type === 'MONTHLY')!.period;
      expect([p.startDate, p.endDate]).toEqual(['2026-02-01', '2026-02-28']);
      const leap = decideScheduledRuns(
        base({ now: new Date('2028-03-01T10:00:00Z') }),
      );
      const l = leap.due.find((d) => d.type === 'MONTHLY')!.period;
      expect([l.startDate, l.endDate]).toEqual(['2028-02-01', '2028-02-29']);
    });
    it('month is due at local midnight of the 1st, not before', () => {
      // Dhaka: 1 Nov 00:00 = 31 Oct 18:00Z
      const on = decideScheduledRuns(
        base({ now: new Date('2026-10-31T18:00:00Z') }),
      );
      expect(starts(on, 'MONTHLY')[0]).toBe('2026-10-01');
      const before = decideScheduledRuns(
        base({ now: new Date('2026-10-31T17:59:59Z') }),
      );
      expect(starts(before, 'MONTHLY')[0]).toBe('2026-09-01');
    });
  });

  it('honours a custom catch-up window', () => {
    const r = decideScheduledRuns(base({ catchUpPeriods: 3 }));
    expect(starts(r, 'WEEKLY')).toEqual([
      '2026-10-12',
      '2026-10-05',
      '2026-09-28',
    ]);
  });

  it('throws on an invalid timezone so the sweep can count a farm error', () => {
    expect(() =>
      decideScheduledRuns(base({ farmTimezone: 'Nope/Zone' })),
    ).toThrow();
  });
});

describe('withinFinalizationWindow', () => {
  const run = new Date('2026-10-19T00:00:00Z');
  it('is true before run + wait and false at/after', () => {
    expect(
      withinFinalizationWindow(new Date('2026-10-19T05:59:59Z'), run, 6),
    ).toBe(true);
    expect(
      withinFinalizationWindow(new Date('2026-10-19T06:00:00Z'), run, 6),
    ).toBe(false);
  });
  it('treats missing / invalid / non-positive waits as no waiting', () => {
    for (const w of [undefined, null, NaN, -3, 0, '6']) {
      expect(withinFinalizationWindow(run, run, w)).toBe(false);
    }
  });
});
