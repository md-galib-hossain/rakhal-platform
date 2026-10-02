import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { HealthReminderService } from './health-reminder.service';

// 2026-10-01 11:00 in Asia/Dhaka (+06:00)
const NOW = new Date('2026-10-01T05:00:00Z');
/** A step due at 11:00 Dhaka on the given `YYYY-MM-DD`. */
const at = (ymd: string) => new Date(`${ymd}T05:00:00Z`);

interface TaskOpts {
  id: string;
  cattleId?: string;
  due: string;
  /** preventive round */
  application?: string;
  /** curative case */
  caseId?: string;
  animal?: string;
  plan?: string;
}

const task = (o: TaskOpts) => ({
  id: o.id,
  cattleId: o.cattleId ?? `c-${o.id}`,
  title: 'Dose',
  dueDateTime: at(o.due),
  healthCaseId: o.caseId ?? null,
  cattle: { name: o.animal ?? null, tagNumber: `TAG-${o.id}` },
  healthCase: o.caseId
    ? { healthPlan: { name: o.plan ?? 'Mastitis protocol' } }
    : null,
  planEnrollment: o.application
    ? {
        planApplicationId: o.application,
        healthPlan: { name: o.plan ?? 'FMD booster' },
      }
    : null,
  healthPlan: null,
});

describe('HealthReminderService', () => {
  let findMany: jest.Mock;
  let notify: jest.Mock;
  let service: HealthReminderService;

  beforeEach(() => {
    findMany = jest.fn();
    notify = jest.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
    const logger = {
      setContext: () => ({ error: jest.fn(), info: jest.fn() }),
    } as unknown as LoggerService;
    service = new HealthReminderService(
      { healthTask: { findMany } } as unknown as PrismaService,
      { notifyOwnersAndManagers: notify } as unknown as NotificationService,
      {
        timezone: jest.fn().mockResolvedValue('Asia/Dhaka'),
      } as unknown as FarmClockService,
      logger,
    );
  });

  it('sends ONE grouped notification for a round, not one per animal', async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) =>
        task({ id: `t${i}`, due: '2026-10-04', application: 'A1' }),
      ),
    );

    const sent = await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 'farm-1',
        eventKey: 'health_task_reminder',
        dedupeKey: 'health_task:app:A1:2026-10-04:T_MINUS_3',
        link: '/healthcare?healthTab=schedule&date=2026-10-04',
        params: {
          label: 'FMD booster',
          count: 12,
          date: '2026-10-04',
          days: 3,
        },
      }),
    );
    expect(sent).toBe(2); // the mock reports two recipients created
  });

  it.each([
    ['2026-10-08', 'health_task_reminder', 'T_MINUS_7'],
    ['2026-10-04', 'health_task_reminder', 'T_MINUS_3'],
    ['2026-10-02', 'health_task_due_tomorrow', 'T_MINUS_1'],
    ['2026-10-01', 'health_task_due_today', 'DAY_OF'],
  ])('due %s → %s (%s)', async (due, eventKey, stage) => {
    findMany.mockResolvedValue([task({ id: 't', due, application: 'A1' })]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey,
        dedupeKey: `health_task:app:A1:${due}:${stage}`,
      }),
    );
  });

  it('sends nothing on a non-cadence day (no back-fill, no daily chatter)', async () => {
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-10-06', application: 'A1' }), // 5 days
      task({ id: 'b', due: '2026-10-03', application: 'A1' }), // 2 days
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps separate rounds and separate due days as separate notifications', async () => {
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-10-04', application: 'A1' }),
      task({ id: 'b', due: '2026-10-04', application: 'A2', plan: 'Deworm' }),
      task({ id: 'c', due: '2026-10-02', application: 'A1' }),
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledTimes(3);
  });

  it('counts distinct animals when one animal has two steps due the same day', async () => {
    findMany.mockResolvedValue([
      task({
        id: 'a',
        cattleId: 'cow-1',
        due: '2026-10-04',
        application: 'A1',
      }),
      task({
        id: 'b',
        cattleId: 'cow-1',
        due: '2026-10-04',
        application: 'A1',
      }),
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ count: 1 }) as unknown,
      }),
    );
  });

  it('names the animal for a curative case and keys the group on the case', async () => {
    findMany.mockResolvedValue([
      task({ id: 't', due: '2026-10-02', caseId: 'case-9', animal: 'Lokkhi' }),
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'health_task_due_tomorrow',
        dedupeKey: 'health_task:case:case-9:2026-10-02:T_MINUS_1',
        params: expect.objectContaining({
          label: 'Mastitis protocol · Lokkhi',
          count: 1,
        }) as unknown,
      }),
    );
  });

  it('nags daily for overdue steps — one per round, keyed on today, worst days-overdue reported', async () => {
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-09-29', application: 'A1' }), // 2 days overdue
      task({ id: 'b', due: '2026-09-30', application: 'A1' }), // 1 day overdue
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'health_task_overdue',
        dedupeKey: 'health_task_overdue:app:A1:2026-10-01',
        link: '/healthcare?healthTab=schedule&bucket=overdue',
        params: {
          label: 'FMD booster',
          count: 2,
          date: '2026-09-29',
          days: 2,
        },
      }),
    );
  });

  it('stops nagging for a step more than 30 days overdue', async () => {
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-08-25', application: 'A1' }), // 37 days
    ]);

    await service.sweepFarm('farm-1', NOW);

    expect(notify).not.toHaveBeenCalled();
  });

  it('a reschedule re-arms: the same step on a new date gets a new dedupe key', async () => {
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-10-04', application: 'A1' }),
    ]);
    await service.sweepFarm('farm-1', NOW);
    const first = (notify.mock.calls[0] as [{ dedupeKey: string }])[0]
      .dedupeKey;

    notify.mockClear();
    findMany.mockResolvedValue([
      task({ id: 'a', due: '2026-10-08', application: 'A1' }),
    ]);
    await service.sweepFarm('farm-1', NOW);
    const second = (notify.mock.calls[0] as [{ dedupeKey: string }])[0]
      .dedupeKey;

    expect(second).not.toBe(first);
  });

  it('only reads open steps of animals still in the active herd', async () => {
    findMany.mockResolvedValue([]);

    await service.sweepFarm('farm-1', NOW);

    const where = (
      findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({
      farmId: 'farm-1',
      deletedAt: null,
      status: { in: ['PENDING', 'RESCHEDULED', 'OVERDUE'] },
      cattle: { herdStatus: 'ACTIVE', deletedAt: null },
    });
    expect(where.OR).toHaveLength(2); // open case OR active enrollment
  });

  it('sweepAll visits each farm once and one failing farm does not stop the rest', async () => {
    findMany
      .mockResolvedValueOnce([{ farmId: 'farm-1' }, { farmId: 'farm-2' }]) // distinct farms
      .mockRejectedValueOnce(new Error('boom')) // farm-1
      .mockResolvedValueOnce([
        task({ id: 't', due: '2026-10-02', application: 'A9' }),
      ]); // farm-2

    const sent = await service.sweepAll(NOW);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ farmId: 'farm-2' }),
    );
    expect(sent).toBe(2);
  });
});
