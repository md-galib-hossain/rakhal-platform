/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */
import { SchedulerService } from './scheduler.service';

describe('SchedulerService.sweepTodaysTasksReady — farm-local day (RAKHAL-477)', () => {
  afterEach(() => jest.useRealTimers());

  function build(tasks: object[]) {
    const prisma = { task: { findMany: jest.fn().mockResolvedValue(tasks) } };
    const notifications = {
      notifyUsers: jest.fn().mockResolvedValue([{ id: 'n' }]),
    };
    const farmClock = { timezone: jest.fn().mockResolvedValue('Asia/Dhaka') };
    const logger = {
      setContext: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    };
    const svc = new SchedulerService(
      prisma as never,
      notifications as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      farmClock as never,
      logger as never,
    );
    return { svc, notifications };
  }

  it('counts tasks by the farm-local date, not the UTC date', async () => {
    // 2026-10-29 20:00Z = 2026-10-30 02:00 in Dhaka (UTC+6)
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T20:00:00.000Z'));
    const { svc, notifications } = build([
      // Dhaka Oct 30 09:00: today locally
      {
        farmId: 'f1',
        assignedToId: 'u1',
        dueAt: new Date('2026-10-30T03:00:00.000Z'),
      },
      // Dhaka Oct 30 01:00: today locally, though the UTC date is Oct 29
      {
        farmId: 'f1',
        assignedToId: 'u1',
        dueAt: new Date('2026-10-29T19:00:00.000Z'),
      },
      // Dhaka Oct 29 16:00: yesterday locally (the old UTC "today")
      {
        farmId: 'f1',
        assignedToId: 'u1',
        dueAt: new Date('2026-10-29T10:00:00.000Z'),
      },
    ]);
    await (
      svc as unknown as { sweepTodaysTasksReady(): Promise<number> }
    ).sweepTodaysTasksReady();
    expect(notifications.notifyUsers).toHaveBeenCalledTimes(1);
    const call = notifications.notifyUsers.mock.calls[0][0];
    expect(call.params.count).toBe(2);
    expect(call.dedupeKey).toBe('todays_tasks_ready:u1:2026-10-30');
  });
});
