import {
  DEFAULT_FARM_TIMEZONE,
  dayKey,
  isValidTimezone,
  localDateIso,
  localDayStart,
} from './farm-time';

describe('farm-time', () => {
  // 2026-09-29 18:42 UTC == 2026-09-30 00:42 in Dhaka (UTC+6) — the real bug report.
  const lateEveningUtc = new Date('2026-09-29T18:42:00Z');

  it('resolves the farm-local date, not the UTC date', () => {
    expect(localDateIso('Asia/Dhaka', lateEveningUtc)).toBe('2026-09-30');
    expect(localDateIso('UTC', lateEveningUtc)).toBe('2026-09-29');
  });

  it('handles zones behind UTC', () => {
    // 02:00 UTC on the 30th is still the 29th in New York.
    expect(
      localDateIso('America/New_York', new Date('2026-09-30T02:00:00Z')),
    ).toBe('2026-09-29');
  });

  it('defaults to Asia/Dhaka and falls back to it for an invalid zone', () => {
    expect(DEFAULT_FARM_TIMEZONE).toBe('Asia/Dhaka');
    expect(localDateIso(undefined, lateEveningUtc)).toBe('2026-09-30');
    expect(localDateIso('Not/AZone', lateEveningUtc)).toBe('2026-09-30');
  });

  it('keys a day as UTC midnight of its calendar date', () => {
    expect(localDayStart('Asia/Dhaka', lateEveningUtc).toISOString()).toBe(
      '2026-09-30T00:00:00.000Z',
    );
    expect(dayKey('2026-09-30').toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(dayKey('2026-09-30T18:42:00Z').toISOString()).toBe(
      '2026-09-30T00:00:00.000Z',
    );
  });

  it('validates IANA names', () => {
    expect(isValidTimezone('Asia/Dhaka')).toBe(true);
    expect(isValidTimezone('Nope/Nowhere')).toBe(false);
  });
});
