import { MilkSession } from '@prisma/client';
import {
  aggregateMilk,
  evaluateSuddenDrops,
  rankCows,
  type MilkRow,
} from './milk-aggregation';

const M = MilkSession.MORNING;
const E = MilkSession.EVENING;
const row = (
  cattleId: string,
  ymd: string,
  yieldL: number,
  session: MilkSession = M,
  extra: Partial<MilkRow> = {},
): MilkRow => ({
  cattleId,
  logDate: new Date(`${ymd}T00:00:00.000Z`),
  session,
  yieldL,
  disposition: 'SALEABLE',
  submitted: true,
  ...extra,
});
const days = (from: number, to: number): string[] =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`,
  );

describe('aggregateMilk', () => {
  it('normal: totals, avg per recorded cow-day, series, dispositions', () => {
    const a = aggregateMilk({
      rows: [
        row('a', '2026-10-05', 10),
        row('a', '2026-10-05', 6, E),
        row('a', '2026-10-06', 8),
        row('b', '2026-10-05', 4, M, { disposition: 'WITHHELD' }),
      ],
      cattleIds: ['a', 'b'],
      days: days(5, 11),
    });
    expect(a.totalYieldL).toBe(28);
    expect(a.recordedCowDays).toBe(3); // a:05, a:06, b:05
    expect(a.expectedCowDays).toBe(14);
    expect(a.avgDailyYieldPerRecordedCowDayL).toBe(9.33);
    expect(a.cowsWithData).toBe(2);
    expect(a.daily[0]).toEqual({
      date: '2026-10-05',
      yieldL: 20,
      cowsRecorded: 2,
    });
    expect(a.daily[1].yieldL).toBe(8);
    expect(a.daily[2].yieldL).toBeNull(); // missing, not 0
    expect(a.dispositionTotalsL).toEqual({ SALEABLE: 24, WITHHELD: 4 });
    expect(a.perCow[0]).toMatchObject({
      cattleId: 'a',
      totalYieldL: 24,
      recordedDays: 2,
      expectedDays: 7,
      avgPerRecordedDayL: 12,
    });
  });

  it('includes first and last day of the period, excludes days outside', () => {
    const a = aggregateMilk({
      rows: [
        row('a', '2026-10-04', 99), // day before
        row('a', '2026-10-05', 1), // first
        row('a', '2026-10-11', 2), // last
        row('a', '2026-10-12', 99), // day after
      ],
      cattleIds: ['a'],
      days: days(5, 11),
    });
    expect(a.totalYieldL).toBe(3);
    expect(a.recordedCowDays).toBe(2);
  });

  it('uses the stored UTC date of logDate as the farm-local day (no timezone shift)', () => {
    // farm-local 2026-10-05 stored at UTC midnight must land on 10-05 even if the farm is UTC+6.
    const a = aggregateMilk({
      rows: [row('a', '2026-10-05', 5)],
      cattleIds: ['a'],
      days: ['2026-10-05'],
    });
    expect(a.daily[0].yieldL).toBe(5);
  });

  it('explicit zero is a value; no row is missing', () => {
    const a = aggregateMilk({
      rows: [row('a', '2026-10-05', 0)],
      cattleIds: ['a'],
      days: days(5, 6),
    });
    expect(a.totalYieldL).toBe(0);
    expect(a.recordedCowDays).toBe(1);
    expect(a.avgDailyYieldPerRecordedCowDayL).toBe(0);
    expect(a.daily[0].yieldL).toBe(0);
    expect(a.daily[1].yieldL).toBeNull();
  });

  it('excludes drafts and rows of cows out of scope', () => {
    const a = aggregateMilk({
      rows: [
        row('a', '2026-10-05', 10, M, { submitted: false }),
        row('x', '2026-10-05', 50),
      ],
      cattleIds: ['a'],
      days: days(5, 5),
    });
    expect(a.totalYieldL).toBeNull();
    expect(a.avgDailyYieldPerRecordedCowDayL).toBeNull();
    expect(a.cowsWithoutData).toEqual(['a']);
  });

  it('no cows: no division by zero', () => {
    const a = aggregateMilk({ rows: [], cattleIds: [], days: days(5, 11) });
    expect(a.expectedCowDays).toBe(0);
    expect(a.totalYieldL).toBeNull();
    expect(a.avgDailyYieldPerRecordedCowDayL).toBeNull();
  });

  it('single cow ranks as top only', () => {
    const a = aggregateMilk({
      rows: [row('a', '2026-10-05', 7)],
      cattleIds: ['a'],
      days: days(5, 5),
    });
    const r = rankCows(a.perCow);
    expect(r.top.map((c) => c.cattleId)).toEqual(['a']);
    expect(r.bottom).toEqual([]);
  });
});

describe('rankCows', () => {
  const cows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({
    cattleId: id,
    totalYieldL: 0,
    recordedDays: 1,
    expectedDays: 1,
    avgPerRecordedDayL: (i + 1) * 10,
  }));
  it('top 5 desc, bottom takes the rest lowest first, no overlap', () => {
    const r = rankCows(cows);
    expect(r.top.map((c) => c.cattleId)).toEqual(['g', 'f', 'e', 'd', 'c']);
    expect(r.bottom.map((c) => c.cattleId)).toEqual(['a', 'b']);
  });
});

describe('evaluateSuddenDrops', () => {
  const sessions = [M, E];
  const full = (cow: string, ymd: string, m: number, e: number): MilkRow[] => [
    row(cow, ymd, m, M),
    row(cow, ymd, e, E),
  ];
  const base = (): MilkRow[] => days(1, 7).flatMap((d) => full('a', d, 10, 10)); // 20 L/day
  const run = (rows: MilkRow[]) =>
    evaluateSuddenDrops({
      rows,
      cattleIds: ['a'],
      evaluatedDate: '2026-10-08',
      expectedSessions: sessions,
      dropThresholdPct: 30,
    });

  it('fires when complete data shows a drop >= threshold', () => {
    const r = run([...base(), ...full('a', '2026-10-08', 8, 6)]); // 14 vs 20 = 30%
    expect(r.evaluatedCows).toBe(1);
    expect(r.findings).toEqual([{ cattleId: 'a', dropPct: 30 }]);
  });

  it('does not fire below threshold', () => {
    const r = run([...base(), ...full('a', '2026-10-08', 9, 9)]); // 10%
    expect(r.evaluatedCows).toBe(1);
    expect(r.findings).toEqual([]);
  });

  it('decline with an incomplete evaluated day produces NO finding', () => {
    const r = run([...base(), row('a', '2026-10-08', 2, M)]);
    expect(r.evaluatedCows).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it('decline with an incomplete or missing baseline day produces NO finding', () => {
    const missingDay = base().filter(
      (x) => x.logDate.toISOString().slice(0, 10) !== '2026-10-03',
    );
    expect(
      run([...missingDay, ...full('a', '2026-10-08', 1, 1)]).findings,
    ).toEqual([]);
    const halfDay = base().filter(
      (x) =>
        !(
          x.logDate.toISOString().slice(0, 10) === '2026-10-03' &&
          x.session === E
        ),
    );
    const r = run([...halfDay, ...full('a', '2026-10-08', 1, 1)]);
    expect(r.evaluatedCows).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it('ignores draft rows (a draft cannot complete a day)', () => {
    const rows = base().map((x) =>
      x.session === E && x.logDate.getUTCDate() === 4
        ? { ...x, submitted: false }
        : x,
    );
    expect(run([...rows, ...full('a', '2026-10-08', 1, 1)]).evaluatedCows).toBe(
      0,
    );
  });

  it('no evaluated date (no expected days) yields nothing', () => {
    const r = evaluateSuddenDrops({
      rows: [],
      cattleIds: ['a'],
      evaluatedDate: null,
      expectedSessions: sessions,
      dropThresholdPct: 30,
    });
    expect(r).toEqual({ evaluatedCows: 0, findings: [] });
  });
});
