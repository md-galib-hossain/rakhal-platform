import {
  InvalidRangeError,
  PeriodKindMismatchError,
  RangeTooLongError,
} from './errors';
import { previousEquivalentPeriod, resolvePreset } from './period-resolver';

const now = new Date('2026-10-20T00:00:00Z');
const tz = 'Asia/Dhaka';
const custom = (from: string, to: string) =>
  resolvePreset('custom', now, tz, { from, to });

describe('custom range span', () => {
  it('accepts exactly 366 days (2024 is a leap year)', () => {
    expect(() => custom('2024-01-01', '2024-12-31')).not.toThrow();
  });
  it('rejects 367 days with a distinct typed error', () => {
    let err: unknown;
    try {
      custom('2024-01-01', '2025-01-01');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RangeTooLongError);
    expect((err as RangeTooLongError).code).toBe('RANGE_TOO_LONG');
    expect(err).not.toBeInstanceOf(InvalidRangeError);
  });
  it('still reports an inverted range as INVALID_RANGE', () => {
    expect(() => custom('2026-10-05', '2026-10-01')).toThrow(InvalidRangeError);
  });
});

describe('previousEquivalentPeriod explicit kind', () => {
  it('rejects a calendar kind that contradicts the shape', () => {
    const week = resolvePreset('this_week', now, tz);
    let err: unknown;
    try {
      previousEquivalentPeriod(week, now, 'month');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PeriodKindMismatchError);
    expect((err as PeriodKindMismatchError).code).toBe('PERIOD_KIND_MISMATCH');
    expect(() =>
      previousEquivalentPeriod(custom('2026-10-02', '2026-10-09'), now, 'week'),
    ).toThrow(PeriodKindMismatchError);
    expect(() => previousEquivalentPeriod(week, now, 'day')).toThrow(
      PeriodKindMismatchError,
    );
  });
  it('accepts a matching kind and the custom escape hatch', () => {
    const week = resolvePreset('this_week', now, tz);
    expect(previousEquivalentPeriod(week, now, 'week').kind).toBe('week');
    expect(previousEquivalentPeriod(week, now, 'custom').kind).toBe('custom');
  });
});
