import { CattleGender } from '@prisma/client';
import { DAY_MS } from './calf-stage';
import { buildCalfCareSchedule } from './calf-care-schedule';

describe('calf-care-schedule domain (PRD §14.5)', () => {
  const birthDate = new Date('2026-01-01T00:00:00Z');
  const due = (days: number) => new Date(birthDate.getTime() + days * DAY_MS);

  it('schedules all 6 reminders for a female calf with correct due dates', () => {
    const schedule = buildCalfCareSchedule(birthDate, CattleGender.FEMALE);

    expect(schedule.map((s) => s.key)).toEqual([
      'neonatal_care',
      'first_deworming',
      'fmd_vaccination',
      'brucellosis_vaccination',
      'one_month_checkup',
      'three_month_booster',
    ]);
    expect(schedule.map((s) => s.dueAt.getTime())).toEqual([
      due(1).getTime(),
      due(7).getTime(),
      due(14).getTime(),
      due(21).getTime(),
      due(30).getTime(),
      due(90).getTime(),
    ]);
  });

  it('omits brucellosis for a male calf (5 reminders)', () => {
    const schedule = buildCalfCareSchedule(birthDate, CattleGender.MALE);

    expect(schedule).toHaveLength(5);
    expect(schedule.map((s) => s.key)).not.toContain('brucellosis_vaccination');
  });
});
