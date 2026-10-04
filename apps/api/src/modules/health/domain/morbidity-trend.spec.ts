import { buildTrend, pickBucket } from './morbidity-trend';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('morbidity trend', () => {
  it('picks a bucket by span', () => {
    expect(pickBucket(30)).toBe('day');
    expect(pickBucket(90)).toBe('week');
    expect(pickBucket(365)).toBe('month');
  });

  it('zero-fills every day of a short window', () => {
    const { bucket, points } = buildTrend(
      [d('2026-10-02'), d('2026-10-02'), d('2026-10-04')],
      d('2026-10-01'),
      d('2026-10-05'),
    );
    expect(bucket).toBe('day');
    expect(points.map((p) => p.count)).toEqual([0, 2, 0, 1, 0]);
    expect(points[0].date).toBe('2026-10-01');
  });

  it('groups a 90-day window by Monday', () => {
    const { bucket, points } = buildTrend(
      [d('2026-10-04'), d('2026-10-05')], // Sunday, Monday
      d('2026-07-07'),
      d('2026-10-05'),
    );
    expect(bucket).toBe('week');
    expect(points.every((p) => new Date(p.date).getUTCDay() === 1)).toBe(true);
    expect(points[points.length - 1]).toEqual({ date: '2026-10-05', count: 1 });
    expect(points[points.length - 2].count).toBe(1);
  });

  it('groups a year by month and keeps empty months', () => {
    const { bucket, points } = buildTrend(
      [d('2026-01-15')],
      d('2025-10-06'),
      d('2026-10-05'),
    );
    expect(bucket).toBe('month');
    expect(points.find((p) => p.date === '2026-01-01')?.count).toBe(1);
    expect(points.find((p) => p.date === '2026-02-01')?.count).toBe(0);
  });
});
