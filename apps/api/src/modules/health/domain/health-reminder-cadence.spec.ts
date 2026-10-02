import {
  farmDaysUntil,
  OVERDUE_MAX_DAYS,
  reminderFor,
  stageForDaysUntil,
  STAGE_EVENT_KEY,
} from './health-reminder-cadence';

describe('health-reminder-cadence', () => {
  describe('stageForDaysUntil', () => {
    it.each([
      [7, 'T_MINUS_7'],
      [3, 'T_MINUS_3'],
      [1, 'T_MINUS_1'],
      [0, 'DAY_OF'],
    ])('%i days away is %s', (days, stage) => {
      expect(stageForDaysUntil(days)).toBe(stage);
    });

    it.each([2, 4, 5, 6, 8, 30])('%i days away sends nothing', (days) => {
      expect(stageForDaysUntil(days)).toBeNull();
    });
  });

  describe('reminderFor', () => {
    it('returns the stage with its days-until on a cadence day', () => {
      expect(reminderFor(3)).toEqual({
        kind: 'stage',
        stage: 'T_MINUS_3',
        daysUntil: 3,
      });
      expect(reminderFor(0)).toEqual({
        kind: 'stage',
        stage: 'DAY_OF',
        daysUntil: 0,
      });
    });

    it('returns null between cadence days (no back-fill, no daily chatter)', () => {
      expect(reminderFor(2)).toBeNull();
      expect(reminderFor(6)).toBeNull();
    });

    it('nags daily once overdue, up to the cap, then stops', () => {
      expect(reminderFor(-1)).toEqual({ kind: 'overdue', daysOverdue: 1 });
      expect(reminderFor(-OVERDUE_MAX_DAYS)).toEqual({
        kind: 'overdue',
        daysOverdue: OVERDUE_MAX_DAYS,
      });
      expect(reminderFor(-(OVERDUE_MAX_DAYS + 1))).toBeNull();
    });
  });

  describe('STAGE_EVENT_KEY', () => {
    it('keeps T-7/T-3 on one event and gives T-1 / day-of their own (SMS-eligible) events', () => {
      expect(STAGE_EVENT_KEY.T_MINUS_7).toBe(STAGE_EVENT_KEY.T_MINUS_3);
      expect(STAGE_EVENT_KEY.T_MINUS_1).toBe('health_task_due_tomorrow');
      expect(STAGE_EVENT_KEY.DAY_OF).toBe('health_task_due_today');
    });
  });

  describe('farmDaysUntil', () => {
    // 2026-10-01 20:00Z is 2026-10-02 02:00 in Asia/Dhaka (+06:00) — the farm is already on the 2nd.
    const now = new Date('2026-10-01T20:00:00Z');

    it('counts on the farm calendar day, not the UTC day', () => {
      // due 2026-10-02 23:30 Dhaka = 2026-10-02 17:30Z → "today" for a Dhaka farm
      expect(
        farmDaysUntil(new Date('2026-10-02T17:30:00Z'), 'Asia/Dhaka', now),
      ).toBe(0);
      // the same two instants seen from UTC: one day apart
      expect(farmDaysUntil(new Date('2026-10-02T17:30:00Z'), 'UTC', now)).toBe(
        1,
      );
    });

    it('is negative once the farm day has passed', () => {
      expect(
        farmDaysUntil(new Date('2026-10-01T03:00:00Z'), 'Asia/Dhaka', now),
      ).toBe(-1);
    });

    it('counts a week ahead', () => {
      expect(
        farmDaysUntil(new Date('2026-10-09T05:00:00Z'), 'Asia/Dhaka', now),
      ).toBe(7);
    });
  });
});
