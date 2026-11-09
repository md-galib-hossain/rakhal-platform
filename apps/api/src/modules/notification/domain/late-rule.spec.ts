import { evaluateLate, LATE_WINDOW_MS } from './late-rule';

describe('evaluateLate (2-hour late rule)', () => {
  const fireAt = new Date('2026-11-10T02:00:00Z');
  const after = (ms: number) => new Date(fireAt.getTime() + ms);

  it('window is two hours', () => {
    expect(LATE_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
  });

  it('fires on time and when slightly late', () => {
    expect(evaluateLate(fireAt, fireAt)).toBe('FIRE');
    expect(evaluateLate(fireAt, after(90 * 60 * 1000))).toBe('FIRE');
  });

  it('exactly two hours late still fires; one millisecond more is LATE', () => {
    expect(evaluateLate(fireAt, after(LATE_WINDOW_MS))).toBe('FIRE');
    expect(evaluateLate(fireAt, after(LATE_WINDOW_MS + 1))).toBe('LATE');
    expect(evaluateLate(fireAt, after(3 * 60 * 60 * 1000))).toBe('LATE');
  });

  it('a job that runs early (clock skew) fires', () => {
    expect(evaluateLate(fireAt, after(-5000))).toBe('FIRE');
  });
});
