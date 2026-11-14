import { MilkSession } from '@prisma/client';
import { buildDailyYieldSeries, CurveEntry } from './lactation-curve';

describe('buildDailyYieldSeries', () => {
  const day = (iso: string) => new Date(iso);
  const expectedSessions = [MilkSession.MORNING, MilkSession.EVENING];

  it('builds one point per calendar day, dim 0-based from startDate', () => {
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-03T00:00:00.000Z'),
      entries: [],
      expectedSessions,
    });

    expect(series.map((p) => p.dim)).toEqual([0, 1, 2]);
    expect(series.map((p) => p.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  it('flags a day with zero recorded sessions as missing', () => {
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-01T00:00:00.000Z'),
      entries: [],
      expectedSessions,
    });
    expect(series[0].dataQuality).toBe('missing');
    expect(series[0].yieldL).toBe(0);
  });

  it('flags a day with some-but-not-all expected sessions as incomplete', () => {
    const entries: CurveEntry[] = [
      {
        logDate: day('2026-08-01T05:00:00.000Z'),
        session: MilkSession.MORNING,
        yieldL: 6,
      },
    ];
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-01T00:00:00.000Z'),
      entries,
      expectedSessions,
    });
    expect(series[0].dataQuality).toBe('incomplete');
    expect(series[0].sessionsRecorded).toBe(1);
    expect(series[0].sessionsExpected).toBe(2);
    expect(series[0].yieldL).toBe(6);
  });

  it('flags a day with all expected sessions recorded as complete and sums their yield', () => {
    const entries: CurveEntry[] = [
      {
        logDate: day('2026-08-01T05:00:00.000Z'),
        session: MilkSession.MORNING,
        yieldL: 6,
      },
      {
        logDate: day('2026-08-01T18:00:00.000Z'),
        session: MilkSession.EVENING,
        yieldL: 5.5,
      },
    ];
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-01T00:00:00.000Z'),
      entries,
      expectedSessions,
    });
    expect(series[0].dataQuality).toBe('complete');
    expect(series[0].yieldL).toBe(11.5);
  });

  it('does not double-count two entries for the same session on the same day toward sessionsRecorded', () => {
    // e.g. a corrected/re-saved MORNING entry — same session, still one distinct session recorded
    const entries: CurveEntry[] = [
      {
        logDate: day('2026-08-01T05:00:00.000Z'),
        session: MilkSession.MORNING,
        yieldL: 6,
      },
      {
        logDate: day('2026-08-01T06:00:00.000Z'),
        session: MilkSession.MORNING,
        yieldL: 1,
      },
    ];
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-01T00:00:00.000Z'),
      entries,
      expectedSessions,
    });
    expect(series[0].sessionsRecorded).toBe(1);
    expect(series[0].dataQuality).toBe('incomplete');
    expect(series[0].yieldL).toBe(7);
  });

  it('falls back to a minimum expected count of 1 when expectedSessions is empty', () => {
    const entries: CurveEntry[] = [
      {
        logDate: day('2026-08-01T05:00:00.000Z'),
        session: MilkSession.MORNING,
        yieldL: 6,
      },
    ];
    const series = buildDailyYieldSeries({
      startDate: day('2026-08-01T00:00:00.000Z'),
      endDate: day('2026-08-01T00:00:00.000Z'),
      entries,
      expectedSessions: [],
    });
    expect(series[0].sessionsExpected).toBe(1);
    expect(series[0].dataQuality).toBe('complete');
  });
});
