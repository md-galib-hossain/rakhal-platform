import {
  calendarDaysBetween,
  preExpiryStageFor,
  winbackStageFor,
} from './renewal-cadence';

describe('renewal cadence', () => {
  it('maps pre-expiry day counts to stages (only on exact cadence days)', () => {
    expect(preExpiryStageFor(7)).toBe('T_MINUS_7');
    expect(preExpiryStageFor(3)).toBe('T_MINUS_3');
    expect(preExpiryStageFor(1)).toBe('T_MINUS_1');
    expect(preExpiryStageFor(0)).toBe('EXPIRY_DAY');
    expect(preExpiryStageFor(5)).toBeNull();
    expect(preExpiryStageFor(2)).toBeNull();
  });

  it('maps post-expiry day counts to capped win-back stages', () => {
    expect(winbackStageFor(3)).toBe('WINBACK_3');
    expect(winbackStageFor(7)).toBe('WINBACK_7');
    expect(winbackStageFor(30)).toBe('WINBACK_30');
    expect(winbackStageFor(1)).toBeNull();
    expect(winbackStageFor(45)).toBeNull(); // capped — no nudges past T+30
  });

  it('counts whole calendar days regardless of time of day', () => {
    const noon = new Date('2026-07-05T12:00:00Z');
    const nextEve = new Date('2026-07-06T23:00:00Z');
    expect(calendarDaysBetween(noon, nextEve)).toBe(1);
    const sameDay = new Date('2026-07-05T02:00:00Z');
    expect(calendarDaysBetween(noon, sameDay)).toBe(0);
    const weekOut = new Date('2026-07-12T00:00:00Z');
    expect(calendarDaysBetween(noon, weekOut)).toBe(7);
  });
});
