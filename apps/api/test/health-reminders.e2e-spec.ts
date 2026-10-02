import { HerdStatus } from '@prisma/client';
import { localDateIso } from '../src/common/farm-time/farm-time';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { HealthReminderService } from '../src/modules/health/application/services/health-reminder.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-465 (MILESTONE 29) — protocol-step reminders at T-7 / T-3 / T-1 / day-of + the daily overdue nag, read
 * straight from `HealthTask` (which the Task Hub sweeps never saw). Drives `HealthReminderService.sweepAll(now)`
 * against the real DB with an injected clock — the same entry point the 5 AM cron calls.
 *
 * Isolation: the sweep is farm-wide and the demo farm's dev DB carries other agents' tasks, so every assertion
 * filters on the `dedupeKey`s of the round created here (`…:app:<this application id>:…`).
 */
describe('Health — step reminders (RAKHAL-465)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let reminders: HealthReminderService;
  let owner: AuthedUser;
  let ownerId: string;
  let managerId: string;
  let workerId: string;
  let planId: string;
  const cattleIds: string[] = [];
  const applicationIds: string[] = [];
  const DAY = 24 * 60 * 60 * 1000;
  const tag = `E2E-RAKHAL465-${Date.now()}`;
  let timezone: string;

  /** The sweep's notion of "now" — real time, so the DB's own `createdAt` ordering stays sane. */
  const now = new Date();
  const inDays = (n: number) => new Date(now.getTime() + n * DAY);
  const ymd = (d: Date) => localDateIso(timezone, d);

  async function makeCow(suffix: string, herdStatus: HerdStatus = 'ACTIVE') {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${suffix}`,
        gender: 'FEMALE',
        herdStatus,
        createdBy: ownerId,
      },
    });
    cattleIds.push(cow.id);
    return cow.id;
  }

  /** A preventive round: one application, one ACTIVE enrollment per cow, one PENDING step per enrollment. */
  async function makeRound(cows: string[], dueInDays: number) {
    const application = await prisma.planApplication.create({
      data: {
        farmId: owner.farmId,
        healthPlanId: planId,
        startDate: now,
        appliedBy: ownerId,
        animalCount: cows.length,
      },
    });
    applicationIds.push(application.id);
    const taskIds: string[] = [];
    const enrollmentIds: string[] = [];
    let n = 0;
    for (const cattleId of cows) {
      const enrollment = await prisma.planEnrollment.create({
        data: {
          farmId: owner.farmId,
          cattleId,
          healthPlanId: planId,
          planApplicationId: application.id,
          startDate: now,
          totalSteps: 1,
        },
      });
      enrollmentIds.push(enrollment.id);
      const task = await prisma.healthTask.create({
        data: {
          farmId: owner.farmId,
          cattleId,
          planEnrollmentId: enrollment.id,
          healthPlanId: planId,
          taskCode: `${tag}-${application.id.slice(-6)}-${n++}`,
          taskDate: inDays(dueInDays),
          dueDateTime: inDays(dueInDays),
          taskType: 'VACCINATION',
          title: 'FMD booster',
        },
      });
      taskIds.push(task.id);
    }
    return { applicationId: application.id, taskIds, enrollmentIds };
  }

  /** Notifications this round produced, per recipient. */
  const notificationsFor = (applicationId: string) =>
    prisma.notification.findMany({
      where: {
        farmId: owner.farmId,
        dedupeKey: { contains: `:app:${applicationId}:` },
      },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    reminders = ctx.app.get(HealthReminderService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const userId = async (email: string) =>
      (
        await prisma.user.findFirstOrThrow({
          where: { email },
          select: { id: true },
        })
      ).id;
    ownerId = await userId('owner@demo.rakhal.test');
    managerId = await userId('manager@demo.rakhal.test');
    workerId = await userId('worker@demo.rakhal.test');

    const farm = await prisma.farm.findUniqueOrThrow({
      where: { id: owner.farmId },
      select: { timezone: true },
    });
    timezone = farm.timezone;

    const plan = await prisma.healthPlan.create({
      data: {
        farmId: owner.farmId,
        name: `${tag} FMD`,
        category: 'VACCINATION',
        planType: 'PREVENTION',
        createdBy: ownerId,
      },
    });
    planId = plan.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: {
        farmId: owner.farmId,
        OR: applicationIds.map((id) => ({
          dedupeKey: { contains: `:app:${id}:` },
        })),
      },
    });
    await prisma.healthTask.deleteMany({ where: { healthPlanId: planId } });
    await prisma.planEnrollment.deleteMany({ where: { healthPlanId: planId } });
    await prisma.planApplication.deleteMany({
      where: { healthPlanId: planId },
    });
    await prisma.healthPlan.delete({ where: { id: planId } });
    await prisma.cattle.deleteMany({ where: { id: { in: cattleIds } } });
    await ctx.app.close();
  });

  it('sends ONE grouped reminder for a round at T-3 — to Owner and Manager, not the worker', async () => {
    const cows = await Promise.all(['a1', 'a2', 'a3'].map((s) => makeCow(s)));
    const { applicationId } = await makeRound(cows, 3);

    await reminders.sweepAll(now);

    const rows = await notificationsFor(applicationId);
    const key = `health_task:app:${applicationId}:${ymd(inDays(3))}:T_MINUS_3`;
    expect(rows.every((r) => r.dedupeKey === key)).toBe(true);
    // one notification per recipient, not per animal
    const recipients = rows.map((r) => r.userId);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(recipients).toEqual(expect.arrayContaining([ownerId, managerId]));
    expect(recipients).not.toContain(workerId);
    expect(rows[0].eventKey).toBe('health_task_reminder');
    expect(rows[0].link).toBe(
      `/healthcare?healthTab=schedule&date=${ymd(inDays(3))}`,
    );
    // rendered per recipient in their own language (RAKHAL-107) — assert the language-neutral parts
    expect(rows[0].message).toContain('3');
    expect(rows[0].message).toContain(ymd(inDays(3)));
  });

  it('is idempotent — re-running the same day creates nothing new', async () => {
    const cow = await makeCow('idem');
    const { applicationId } = await makeRound([cow], 1);

    await reminders.sweepAll(now);
    const first = await notificationsFor(applicationId);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0].eventKey).toBe('health_task_due_tomorrow');

    await reminders.sweepAll(now);
    const second = await notificationsFor(applicationId);
    expect(second).toHaveLength(first.length);
  });

  it('uses the day-of event for a step due today', async () => {
    const cow = await makeCow('today');
    const { applicationId } = await makeRound([cow], 0);

    await reminders.sweepAll(now);

    const rows = await notificationsFor(applicationId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].eventKey).toBe('health_task_due_today');
    expect(rows[0].dedupeKey).toContain(':DAY_OF');
  });

  it('sends nothing on a non-cadence day (5 days out) — no back-fill', async () => {
    const cow = await makeCow('gap');
    const { applicationId } = await makeRound([cow], 5);

    await reminders.sweepAll(now);

    expect(await notificationsFor(applicationId)).toHaveLength(0);
  });

  it('rescheduling re-arms: a step moved to +1 day reminds for the new date', async () => {
    const cow = await makeCow('resched');
    const { applicationId, taskIds } = await makeRound([cow], 5);
    await reminders.sweepAll(now);
    expect(await notificationsFor(applicationId)).toHaveLength(0);

    // what `HealthService.rescheduleTask` does
    await prisma.healthTask.update({
      where: { id: taskIds[0] },
      data: {
        status: 'RESCHEDULED',
        rescheduledFrom: inDays(5),
        rescheduledTo: inDays(1),
        dueDateTime: inDays(1),
        taskDate: inDays(1),
      },
    });
    await reminders.sweepAll(now);

    const rows = await notificationsFor(applicationId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].dedupeKey).toBe(
      `health_task:app:${applicationId}:${ymd(inDays(1))}:T_MINUS_1`,
    );
  });

  it('nags once a day for an overdue step, keyed on today', async () => {
    const cow = await makeCow('late');
    const { applicationId } = await makeRound([cow], -2);

    await reminders.sweepAll(now);
    await reminders.sweepAll(now); // same day again

    const rows = await notificationsFor(applicationId);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.dedupeKey))).toEqual(
      new Set([`health_task_overdue:app:${applicationId}:${ymd(now)}`]),
    );
    expect(rows[0].eventKey).toBe('health_task_overdue');
  });

  it('stops reminding once the step is completed', async () => {
    const cow = await makeCow('done');
    const { applicationId, taskIds } = await makeRound([cow], 1);
    await prisma.healthTask.update({
      where: { id: taskIds[0] },
      data: { status: 'COMPLETED', completedAt: now },
    });

    await reminders.sweepAll(now);

    expect(await notificationsFor(applicationId)).toHaveLength(0);
  });

  it('stops reminding once the enrollment is completed', async () => {
    const cow = await makeCow('enr');
    const { applicationId, enrollmentIds } = await makeRound([cow], 1);
    await prisma.planEnrollment.update({
      where: { id: enrollmentIds[0] },
      data: { status: 'COMPLETED' },
    });

    await reminders.sweepAll(now);

    expect(await notificationsFor(applicationId)).toHaveLength(0);
  });

  it('skips animals that have left the active herd', async () => {
    const sold = await makeCow('sold', 'SOLD');
    const { applicationId } = await makeRound([sold], 1);

    await reminders.sweepAll(now);

    expect(await notificationsFor(applicationId)).toHaveLength(0);
  });
});
