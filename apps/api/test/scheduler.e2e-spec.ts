import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SchedulerService } from '../src/modules/scheduler/application/services/scheduler.service';
import { FarmClockService } from '../src/common/farm-time/farm-clock.service';
import { localDateIso } from '../src/common/farm-time/farm-time';
import { HealthService } from '../src/modules/health/application/services/health.service';
import { NotificationScheduler } from '../src/modules/notification/application/services/notification-scheduler.service';
import { OverdueNagService } from '../src/modules/scheduler/application/services/overdue-nag.service';
import {
  AuthedUser,
  createNotificationV2Harness,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  type NotificationV2Harness,
  type TestContext,
  type ThrowawayOwner,
} from './utils/e2e';

/**
 * Scheduled-job runner (RAKHAL-095) e2e. Seeds an overdue receivable + a
 * soon-due pregnancy, runs the daily sweeps via the app context, and asserts the
 * time-based notifications land in the Owner's feed — and that a second run is
 * **deduped** (no double-notify).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Scheduler sweeps (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;
  let scheduler: SchedulerService;
  let ownerUserId: string;
  const reference = `REC-E2E-${Date.now()}`;
  const payableReference = `PAY-E2E-${Date.now()}`;
  let pregnancyId: string | null = null;
  let breedingEventId: string | null = null;
  let semenTankId: string | null = null;
  let saleId = '';
  let expenseId = '';

  const day = 24 * 60 * 60 * 1000;

  // The demo DB's shared task backlog can push a single-recipient event's row
  // past the feed API's page size (pre-existing "scheduler" flake documented
  // in docs/IN_FLIGHT.md) — query Prisma directly so title assertions aren't
  // dependent on pagination/ordering against that backlog.
  const ownerNotifTitles = async (): Promise<string[]> => {
    const rows = await prisma.notification.findMany({
      where: { userId: ownerUserId },
      select: { title: true },
    });
    return rows.map((n) => n.title);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
    scheduler = ctx.app.get(SchedulerService);
    ownerUserId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });

    // Overdue receivable (due yesterday, unpaid). RAKHAL-498: V2 `Sale` + `Receivable` (V1 `FinanceReceivable` was
    // dropped in RAKHAL-354, so this fixture could not run any more).
    const sale = await prisma.sale.create({
      data: {
        farmId: owner.farmId,
        saleNumber: reference,
        saleDate: new Date(Date.now() - 5 * day),
        subtotal: 5000,
        totalAmount: 5000,
        status: 'CONFIRMED',
        createdById: ownerUserId,
      },
    });
    saleId = sale.id;
    await prisma.receivable.create({
      data: {
        farmId: owner.farmId,
        saleId: sale.id,
        totalAmount: 5000,
        dueDate: new Date(Date.now() - day),
      },
    });

    // Pregnancy due to calve in 2 days, on a cow that has none yet.
    const withPreg = await prisma.pregnancy.findMany({
      select: { cattleId: true },
    });
    const taken = new Set(withPreg.map((p) => p.cattleId));
    const cow = (
      await prisma.cattle.findMany({
        where: { farmId: owner.farmId, herdStatus: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })
    ).find((c) => !taken.has(c.id));
    if (cow) {
      const preg = await prisma.pregnancy.create({
        data: {
          cattleId: cow.id,
          conceptionDate: new Date(Date.now() - 280 * day),
          expectedCalvingDate: new Date(Date.now() + 2 * day),
          status: 'ACTIVE',
        },
      });
      pregnancyId = preg.id;
    }

    // Payable due in 2 days (PRD §20.2 supplier_payment_due_soon).
    // RAKHAL-498: V2 `Expense` + `Payable` (display name comes from `expense.description`).
    const expense = await prisma.expense.create({
      data: {
        farmId: owner.farmId,
        category: 'UTILITIES',
        description: payableReference,
        amount: 3000,
        expenseDate: new Date(),
        createdById: ownerUserId,
      },
    });
    expenseId = expense.id;
    await prisma.payable.create({
      data: {
        farmId: owner.farmId,
        expenseId: expense.id,
        totalAmount: 3000,
        dueDate: new Date(Date.now() + 2 * day),
      },
    });

    // Breeding event whose pregnancy-check date is already due (pregnancy_check_due).
    const bredCow = (
      await prisma.cattle.findMany({
        where: { farmId: owner.farmId, herdStatus: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })
    ).find((c) => !taken.has(c.id) && c.id !== cow?.id);
    if (bredCow) {
      const breeding = await prisma.breedingEvent.create({
        data: {
          cattleId: bredCow.id,
          breedingDate: new Date(Date.now() - 22 * day),
          breedingMethod: 'AI',
          breedingNumber: 1,
          expectedPregnancyCheckDate: new Date(Date.now() - day),
          status: 'PENDING_CHECK',
        },
      });
      breedingEventId = breeding.id;
    }

    // Semen tank with low LN2 (semen_tank_low_ln2).
    const semenTank = await prisma.semenTank.create({
      data: {
        farmId: owner.farmId,
        name: 'E2E Low Tank',
        strawCapacity: 100,
        ln2LevelPct: 15,
        createdBy: ownerUserId,
      },
    });
    semenTankId = semenTank.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.receivable.deleteMany({ where: { saleId } });
    await prisma.sale.deleteMany({ where: { id: saleId } });
    await prisma.payable.deleteMany({ where: { expenseId } });
    await prisma.expense.deleteMany({ where: { id: expenseId } });
    if (pregnancyId) {
      await prisma.pregnancy.deleteMany({ where: { id: pregnancyId } });
    }
    if (breedingEventId) {
      await prisma.breedingEvent.deleteMany({ where: { id: breedingEventId } });
    }
    if (semenTankId) {
      await prisma.semenTank.deleteMany({ where: { id: semenTankId } });
    }
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
    await ctx.app.close();
  });

  it('runDailySweeps emits the time-based alerts to the owner', async () => {
    const result = await scheduler.runDailySweeps();
    expect(result.payment_overdue).toBeGreaterThanOrEqual(1);
    expect(result.supplier_payment_due_soon).toBeGreaterThanOrEqual(1);
    expect(result.semen_tank_low_ln2).toBeGreaterThanOrEqual(1);
    // RAKHAL-498: the two notification-v2 entries are registered and healthy (-1 would mean the sweep threw).
    expect(result.notification_schedule_reconcile).toBeGreaterThanOrEqual(0);
    expect(result.overdue_nag).toBeGreaterThanOrEqual(0);
    expect(result.health_cycle_repeat).toBeGreaterThanOrEqual(0);
    // RAKHAL-499: the old reminder sweeps are gone for good.
    for (const gone of [
      'follow_up_and_reminder_due',
      'health_task_reminders',
      'calving_expected_3_days',
      'cow_expected_in_heat',
      'pregnancy_check_due',
      'dry_off_due_14_days',
    ]) {
      expect(result).not.toHaveProperty(gone);
    }

    // RAKHAL-107: the demo owner defaults to Bangla, so sweep-emitted titles
    // are localized (`notification.payment_overdue.title`).
    const titles = await ownerNotifTitles();
    expect(titles).toContain('পরিশোধের মেয়াদ পার হয়ে গেছে');
    expect(titles).toContain('সরবরাহকারীর পরিশোধ শীঘ্রই');
    expect(titles).toContain('সিমেন ট্যাংকের LN2 কম');
  }, 120_000);

  it('a second run on the same day is deduped (no new notifications)', async () => {
    const before = (await ownerNotifTitles()).length;
    await scheduler.runDailySweeps();
    const after = (await ownerNotifTitles()).length;
    expect(after).toBe(before);
  }, 120_000);
});

/**
 * RAKHAL-498 (NV2-B07): the two new daily entries (`notification_schedule_reconcile`, `overdue_nag`) and the
 * task_overdue / overdue_nag disjointness guard. Throwaway farm so counts are exact; the harness gives an in-memory queue
 * and a fake clock. The sweeps read real "now" (not the fake clock), so tasks are
 * seeded relative to `Date.now()`.
 */
describe('Scheduler v2 entries (RAKHAL-498)', () => {
  const day = 24 * 60 * 60 * 1000;
  const RULE = 'BREEDING_TO_PREG_CHECK';
  let ctx: TestContext;
  let prisma: PrismaService;
  let h: NotificationV2Harness;
  let scheduler: SchedulerService;
  let nag: OverdueNagService;
  let owner: ThrowawayOwner;
  let farmId: string;
  let tz: string;
  let planIds: string[] = [];
  let seq = 0;

  const keysOf = async (prefix: string) =>
    (
      await prisma.notification.findMany({
        where: { farmId, dedupeKey: { startsWith: prefix } },
        select: { dedupeKey: true },
      })
    ).map((n) => n.dedupeKey as string);

  async function makeCow() {
    const c = await prisma.cattle.create({
      data: {
        farm: { connect: { id: farmId } },
        creator: { connect: { id: owner.userId } },
        tagNumber: `NV2B07-${Date.now()}-${seq++}`,
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
      },
    });
    return c.id;
  }

  async function makeTask(
    name: string,
    ageDays: number,
    extra: { ruleKey?: string; cattleId?: string } = {},
  ) {
    const t = await prisma.task.create({
      data: {
        farmId,
        reference: `T-B07-${Date.now()}-${seq++}`,
        name,
        dueAt: new Date(Date.now() - ageDays * day),
        createdBy: owner.userId,
        ruleKey: extra.ruleKey ?? null,
        relatedCattleId: extra.cattleId ?? null,
      },
    });
    return t.id;
  }

  beforeAll(async () => {
    h = createNotificationV2Harness(new Date());
    ctx = await createTestApp({ configure: h.configure });
    prisma = ctx.app.get(PrismaService);
    scheduler = ctx.app.get(SchedulerService);
    nag = ctx.app.get(OverdueNagService);
    owner = await createThrowawayOwner(ctx, prisma, 'NV2 B07 farm');
    farmId = owner.farmId;
    tz = await ctx.app.get(FarmClockService).timezone(farmId);
  }, 60_000);

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.notificationSchedule.deleteMany({ where: { farmId } });
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
    await prisma.healthTask.deleteMany({ where: { farmId } });
    await prisma.planEnrollment.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.planApplication.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthCase.deleteMany({ where: { farmId } });
    await prisma.healthPlanStep.deleteMany({
      where: { healthPlanId: { in: planIds } },
    });
    await prisma.healthPlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.cattle.deleteMany({ where: { farmId } });
    await deleteThrowawayOwner(prisma, owner);
    await ctx.app.close();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.notification.deleteMany({ where: { farmId } });
    await prisma.task.deleteMany({ where: { farmId } });
  });

  it('reconcile runs with purge and nothing double-notifies', async () => {
    const cow = await makeCow();
    const ruleTask = await makeTask('Preg check', 3, {
      ruleKey: RULE,
      cattleId: cow,
    });
    const plain = await makeTask('Fix gate', 3);
    const reconcile = jest
      .spyOn(ctx.app.get(NotificationScheduler), 'reconcile')
      .mockResolvedValue({ enqueued: 2, removed: 1, advanced: 0, purged: 0 });

    const result = await scheduler.runDailySweeps();
    expect(reconcile).toHaveBeenCalledWith(expect.any(Date), { purge: true });
    expect(result.notification_schedule_reconcile).toBe(3);
    expect(result.overdue_nag).toBeGreaterThanOrEqual(1);
    expect(result.health_cycle_repeat).toBeGreaterThanOrEqual(0);

    // task_overdue owns the plain task, overdue_nag owns the rule group: disjoint, never both.
    const taskOverdue = await keysOf('task_overdue:');
    expect(taskOverdue.some((k) => k.includes(plain))).toBe(true);
    expect(taskOverdue.some((k) => k.includes(ruleTask))).toBe(false);
    const nags = await keysOf('ov:');
    expect(nags).toHaveLength(1);
    expect(nags[0]).toMatch(
      new RegExp(`^ov:TASK:rule:${RULE}:\\d{4}-\\d{2}-\\d{2}:`),
    );
  }, 120_000);

  it('rule tasks: one nag per group per day, never per animal, stops at 30 days', async () => {
    for (let i = 0; i < 3; i++) {
      await makeTask('Preg check', 3, {
        ruleKey: RULE,
        cattleId: await makeCow(),
      });
    }
    await makeTask('Plain overdue', 3); // never nagged here (task_overdue owns it)
    await makeTask('At the cap', 30, { ruleKey: 'CAP_30' });
    await makeTask('Past the cap', 31, { ruleKey: 'CAP_31' });

    // `sweepAll` is global (every farm in the shared dev DB), so assert on this farm's rows, not its return value.
    // 1 recipient (the owner) x 2 groups: the 3-animal BREEDING group and CAP_30.
    await nag.sweepAll();
    const keys = await keysOf('ov:');
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => k.includes(RULE))).toBe(true);
    expect(keys.some((k) => k.includes('CAP_30'))).toBe(true);
    expect(keys.some((k) => k.includes('CAP_31'))).toBe(false);

    // Same farm day again: deduped.
    await nag.sweepAll();
    expect(await keysOf('ov:')).toHaveLength(2);
    // Tomorrow: BREEDING (now 4 days) nags again; CAP_30 (now 31 days) has stopped.
    await nag.sweepAll(new Date(Date.now() + day));
    const next = await keysOf('ov:');
    expect(next).toHaveLength(3);
    expect(next.filter((k) => k.includes('CAP_30'))).toHaveLength(1);
    expect(next.filter((k) => k.includes(RULE))).toHaveLength(2);
  }, 120_000);

  it('health steps: one nag per round and per case, never per animal', async () => {
    const step = (title: string) => ({
      create: [{ dayNumber: 1, title, actionType: 'OBSERVATION' as const }],
    });
    const round = await prisma.healthPlan.create({
      data: {
        farmId,
        name: 'B07 FMD',
        category: 'VACCINATION',
        planType: 'PREVENTION',
        createdBy: owner.userId,
        steps: step('FMD booster'),
      },
    });
    const curative = await prisma.healthPlan.create({
      data: {
        farmId,
        name: 'B07 Mastitis',
        category: 'TREATMENT',
        planType: 'MEDICAL',
        createdBy: owner.userId,
        steps: step('Check udder'),
      },
    });
    planIds = [round.id, curative.id];
    const startDate = localDateIso(tz, new Date(Date.now() - 3 * day));
    const health = ctx.app.get(HealthService);
    await health.applyPlanToAnimals(farmId, owner.userId, round.id, {
      cattleIds: [await makeCow(), await makeCow(), await makeCow()],
      startDate,
    });
    await health.applyPlanToAnimals(farmId, owner.userId, curative.id, {
      cattleIds: [await makeCow()],
      startDate,
    });

    await nag.sweepAll();
    const keys = await keysOf('ov:HEALTH_STEP:');
    expect(keys.filter((k) => k.includes(':round:'))).toHaveLength(1);
    expect(keys.filter((k) => k.includes(':case:'))).toHaveLength(1);
    await nag.sweepAll();
    expect(await keysOf('ov:HEALTH_STEP:')).toHaveLength(2);
  }, 120_000);
});
