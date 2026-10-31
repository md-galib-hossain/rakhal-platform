import { decideReminder, nextOccurrence } from './reminder-cadence';

describe('reminder-cadence (RAKHAL-485)', () => {
  it('sends the lead notice only on the exact lead day', () => {
    expect(decideReminder(3, 3)).toEqual({ stage: 'UPCOMING', daysUntil: 3 });
    expect(decideReminder(4, 3)).toBeNull();
    expect(decideReminder(2, 3)).toBeNull();
  });

  it('always notifies on the day, with or without a lead', () => {
    expect(decideReminder(0, null)).toEqual({
      stage: 'DUE_TODAY',
      daysUntil: 0,
    });
    expect(decideReminder(0, 5)).toEqual({ stage: 'DUE_TODAY', daysUntil: 0 });
  });

  it('nags daily when overdue, and stops after 30 days', () => {
    expect(decideReminder(-1, 1)).toEqual({ stage: 'OVERDUE', daysOverdue: 1 });
    expect(decideReminder(-30, null)).toEqual({
      stage: 'OVERDUE',
      daysOverdue: 30,
    });
    expect(decideReminder(-31, null)).toBeNull();
  });

  it('computes the next occurrence of each repeat type', () => {
    const d = new Date('2026-01-31T00:00:00.000Z');
    expect(nextOccurrence(d, 'DAILY').toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    expect(nextOccurrence(d, 'WEEKLY').toISOString()).toBe(
      '2026-02-07T00:00:00.000Z',
    );
    expect(nextOccurrence(d, 'EVERY_N_DAYS', 10).toISOString()).toBe(
      '2026-02-10T00:00:00.000Z',
    );
    expect(nextOccurrence(d, 'EVERY_N_DAYS', 0).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });
});
