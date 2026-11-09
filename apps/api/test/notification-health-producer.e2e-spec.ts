import { HealthCloseOutcome } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { HealthService } from '../src/modules/health/application/services/health.service';
import { OccurrenceProcessor } from '../src/modules/notification/application/queue/occurrence.processor';
import {
  AuthedUser,
  createNotificationV2Harness,
  createTestApp,
  loginAs,
  type NotificationV2Harness,
  type TestContext,
} from './utils/e2e';

/**
 * RAKHAL-497 (NV2-B06): health protocol steps produce notifications through the v2 engine. In-memory queue + fake
 * clock (`createNotificationV2Harness`); farm tz Asia/Dhaka (UTC+6), so 08:00 farm-local = 02:00Z (+0..179 s jitter).
 * Time starts at 2026-11-13T01:00Z. Isolation: every assertion keys on the round / case created here.
 */
describe('Health step notifications (RAKHAL-497)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let health: HealthService;
  let processor: OccurrenceProcessor;
  let h: NotificationV2Harness;
  let owner: AuthedUser;
  let ownerId: string;
  let managerId: string;
  let workerId: string;
  let roundPlanId: string;
  let casePlanId: string;
  const cattleIds: string[] = [];
  const tag = `E2E-RAKHAL497-${Date.now()}`;
  let seq = 0;

  const runDue = () =>
    h.queue.runDue(h.clock.now(), async (id) => {
      await processor.process(id);
    });
  const at = (iso: string) => h.clock.set(new Date(iso));

  async function makeCow() {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${seq++}`,
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
        createdBy: ownerId,
      },
    });
    cattleIds.push(cow.id);
    return cow.id;
  }

  const scheduleOf = (sourceKey: string) =>
    prisma.notificationSchedule.findFirst({
      where: { farmId: owner.farmId, sourceType: 'HEALTH_STEP', sourceKey },
      include: { occurrences: { orderBy: { leadMinutes: 'desc' } } },
    });

  /** Preventive round over `cows`, step 1 due on `startDate` (a farm-local day). */
  async function applyRound(cows: string[], startDate: string) {
    const res = await health.applyPlanToAnimals(
      owner.farmId,
      ownerId,
      roundPlanId,
      { cattleIds: cows, startDate },
    );
    return res.planApplicationId as string;
  }

  /** Curative case for one cow, step 1 due on `startDate`. */
  async function applyCase(cattleId: string, startDate: string) {
    await health.applyPlanToAnimals(owner.farmId, ownerId, casePlanId, {
      cattleIds: [cattleId],
      startDate,
    });
    const healthCase = await prisma.healthCase.findFirstOrThrow({
      where: { farmId: owner.farmId, cattleId, healthPlanId: casePlanId },
      orderBy: { createdAt: 'desc' },
    });
    const task = await prisma.healthTask.findFirstOrThrow({
      where: { healthCaseId: healthCase.id },
    });
    return { caseId: healthCase.id, taskId: task.id };
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date('2026-11-13T01:00:00Z'));
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    health = ctx.app.get(HealthService);
    processor = ctx.app.get(OccurrenceProcessor);
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

    const step = (title: string) => ({
      create: [{ dayNumber: 1, title, actionType: 'OBSERVATION' as const }],
    });
    roundPlanId = (
      await prisma.healthPlan.create({
        data: {
          farmId: owner.farmId,
          name: `${tag} FMD`,
          category: 'VACCINATION',
          planType: 'PREVENTION',
          createdBy: ownerId,
          steps: step('FMD booster'),
        },
      })
    ).id;
    casePlanId = (
      await prisma.healthPlan.create({
        data: {
          farmId: owner.farmId,
          name: `${tag} Mastitis`,
          category: 'TREATMENT',
          planType: 'MEDICAL',
          createdBy: ownerId,
          steps: step('Check udder'),
        },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    const planIds = [roundPlanId, casePlanId];
    const apps = await prisma.planApplication.findMany({
      where: { healthPlanId: { in: planIds } },
      select: { id: true },
    });
    const cases = await prisma.healthCase.findMany({
      where: { healthPlanId: { in: planIds } },
      select: { id: true },
    });
    const groupIds = [...apps.map((a) => a.id), ...cases.map((c) => c.id)];
    const ours = groupIds.length
      ? await prisma.notificationSchedule.findMany({
          where: {
            farmId: owner.farmId,
            sourceType: 'HEALTH_STEP',
            OR: groupIds.map((id) => ({ sourceKey: { contains: `:${id}:` } })),
          },
          select: { id: true, occurrences: { select: { id: true } } },
        })
      : [];
    await prisma.notification.deleteMany({
      where: {
        farmId: owner.farmId,
        dedupeKey: {
          in: ours.flatMap((s) =>
            s.occurrences.map((o) => `occurrence:${o.id}`),
          ),
        },
      },
    });
    await prisma.notificationSchedule.deleteMany({
      where: { id: { in: ours.map((s) => s.id) } },
    });
    await prisma.healthTask.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planEnrollment.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planApplication.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthCase.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlanStep.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.cattle.deleteMany({ where: { id: { in: cattleIds } } });
    await ctx.app.close();
  });

  beforeEach(() => {
    at('2026-11-13T01:00:00Z');
  });

  it('a preventive round of 3 animals makes ONE schedule with leads 7d / 1d / day-of, and fires ONE grouped notice', async () => {
    const cows = await Promise.all([makeCow(), makeCow(), makeCow()]);
    const appId = await applyRound(cows, '2026-11-20');

    const key = `round:${appId}:2026-11-20`;
    const s = await scheduleOf(key);
    expect(s).not.toBeNull();
    expect(s!.status).toBe('ACTIVE');
    expect(s!.audienceMode).toBe('SOURCE');
    expect(s!.allDay).toBe(true);
    expect(s!.leadMinutes).toEqual([10080, 1440, 0]);
    expect(s!.occurrences).toHaveLength(3);
    expect(
      await prisma.notificationSchedule.count({
        where: {
          farmId: owner.farmId,
          sourceType: 'HEALTH_STEP',
          sourceKey: { contains: `:${appId}:` },
        },
      }),
    ).toBe(1);

    // 7 days before 2026-11-20 = 2026-11-13 08:00 Dhaka = 02:00Z.
    at('2026-11-13T03:00:00Z');
    await runDue();

    const sevenDay = (await scheduleOf(key))!.occurrences.find(
      (o) => o.leadMinutes === 10080,
    )!;
    expect(sevenDay.status).toBe('FIRED');
    const rows = await prisma.notification.findMany({
      where: { farmId: owner.farmId, dedupeKey: `occurrence:${sevenDay.id}` },
    });
    const recipients = rows.map((r) => r.userId);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(recipients).toEqual(expect.arrayContaining([ownerId, managerId]));
    expect(recipients).not.toContain(workerId);
    expect(rows[0].eventKey).toBe('scheduled_upcoming');
    expect(rows[0].link).toBe(
      '/healthcare?healthTab=protocols&date=2026-11-20',
    );
    expect(rows[0].message).toContain('3');
    expect(rows[0].message).toContain('2026-11-20');
  });

  it('a curative case gets the day-of lead only', async () => {
    const cow = await makeCow();
    const { caseId } = await applyCase(cow, '2026-11-22');

    const s = await scheduleOf(`case:${caseId}:2026-11-22`);
    expect(s!.leadMinutes).toEqual([0]);
    expect(s!.occurrences).toHaveLength(1);
    expect(s!.occurrences[0].status).toBe('SCHEDULED');
  });

  it('rescheduling a step moves the notice to the new day', async () => {
    const cow = await makeCow();
    const { caseId, taskId } = await applyCase(cow, '2026-11-22');

    await health.rescheduleTask(owner.farmId, taskId, {
      newDueDateTime: '2026-11-24T06:00:00.000Z',
    });

    const oldS = await scheduleOf(`case:${caseId}:2026-11-22`);
    expect(oldS!.status).toBe('CANCELLED');
    expect(oldS!.occurrences.every((o) => o.status === 'CANCELLED')).toBe(true);
    const newS = await scheduleOf(`case:${caseId}:2026-11-24`);
    expect(newS!.status).toBe('ACTIVE');
    expect(newS!.anchorAt.toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(newS!.occurrences.some((o) => o.status === 'SCHEDULED')).toBe(true);
  });

  it('completing the last open step cancels the notice', async () => {
    const cow = await makeCow();
    const { caseId, taskId } = await applyCase(cow, '2026-11-22');

    await health.completeTask(owner.farmId, ownerId, taskId);

    expect((await scheduleOf(`case:${caseId}:2026-11-22`))!.status).toBe(
      'CANCELLED',
    );
  });

  it('skipping steps cancels a round notice only once no animal has an open step left', async () => {
    const [a, b] = await Promise.all([makeCow(), makeCow()]);
    const appId = await applyRound([a, b], '2026-11-21');
    const key = `round:${appId}:2026-11-21`;
    const tasks = await prisma.healthTask.findMany({
      where: { planEnrollment: { planApplicationId: appId } },
      orderBy: { id: 'asc' },
    });

    await health.skipTask(owner.farmId, tasks[0].id, {
      reason: 'sold',
    });
    expect((await scheduleOf(key))!.status).toBe('ACTIVE');

    await health.skipTask(owner.farmId, tasks[1].id, {
      reason: 'sold',
    });
    expect((await scheduleOf(key))!.status).toBe('CANCELLED');
  });

  it('closing a case cancels its notice', async () => {
    const cow = await makeCow();
    const { caseId } = await applyCase(cow, '2026-11-22');

    await health.closeCase(owner.farmId, ownerId, caseId, {
      outcome: HealthCloseOutcome.RECOVERED,
    });

    const s = await scheduleOf(`case:${caseId}:2026-11-22`);
    expect(s!.status).toBe('CANCELLED');
    expect(s!.occurrences.every((o) => o.status === 'CANCELLED')).toBe(true);
  });

  it('an animal that left the herd before the fire time cancels with ANIMALS_GONE and sends nothing', async () => {
    const cow = await makeCow();
    const appId = await applyRound([cow], '2026-11-13');
    const key = `round:${appId}:2026-11-13`;
    // 2026-11-13 08:00 Dhaka is still ahead of the 01:00Z clock, so only the day-of occurrence exists (7d / 1d are past).
    expect(
      (await scheduleOf(key))!.occurrences.map((o) => o.leadMinutes),
    ).toEqual([0]);

    await prisma.cattle.update({
      where: { id: cow },
      data: { herdStatus: 'SOLD' },
    });
    at('2026-11-13T03:00:00Z');
    await runDue();

    const occ = (await scheduleOf(key))!.occurrences[0];
    expect(occ.status).toBe('CANCELLED');
    expect(occ.reason).toBe('ANIMALS_GONE');
    expect(
      await prisma.notification.count({
        where: { farmId: owner.farmId, dedupeKey: `occurrence:${occ.id}` },
      }),
    ).toBe(0);
  });

  it('an enrollment that completed before the fire time sends nothing (ported from the old health-reminders spec)', async () => {
    const cow = await makeCow();
    const appId = await applyRound([cow], '2026-11-13');
    const key = `round:${appId}:2026-11-13`;
    await prisma.planEnrollment.updateMany({
      where: { planApplicationId: appId },
      data: { status: 'COMPLETED' },
    });
    at('2026-11-13T03:00:00Z');
    await runDue();

    const occ = (await scheduleOf(key))!.occurrences[0];
    expect(occ.status).not.toBe('FIRED');
    expect(
      await prisma.notification.count({
        where: { farmId: owner.farmId, dedupeKey: `occurrence:${occ.id}` },
      }),
    ).toBe(0);
  });
});
