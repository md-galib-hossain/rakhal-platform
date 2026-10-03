import { applyTimeOfDay } from './protocol-time';

describe('applyTimeOfDay', () => {
  const due = new Date('2026-10-05T00:00:00.000Z');

  it('returns the date unchanged without a time', () => {
    expect(applyTimeOfDay(due, undefined, 'Asia/Dhaka')).toBe(due);
    expect(applyTimeOfDay(due, null, 'Asia/Dhaka')).toBe(due);
  });

  it('applies a farm-local time (Dhaka is UTC+6)', () => {
    // 2026-10-05T00:00Z is 06:00 on 5 Oct in Dhaka, so 08:30 local = 02:30Z
    expect(applyTimeOfDay(due, '08:30', 'Asia/Dhaka').toISOString()).toBe(
      '2026-10-05T02:30:00.000Z',
    );
  });

  it('works for UTC', () => {
    expect(applyTimeOfDay(due, '23:15', 'UTC').toISOString()).toBe(
      '2026-10-05T23:15:00.000Z',
    );
  });
});
