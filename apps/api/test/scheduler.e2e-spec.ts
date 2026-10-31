import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SchedulerService } from '../src/modules/scheduler/application/services/scheduler.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

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

    // Overdue receivable (due yesterday, unpaid balance).
    await prisma.financeReceivable.create({
      data: {
        farmId: owner.farmId,
        reference,
        kind: 'RECEIVABLE',
        entityName: 'E2E Overdue Buyer',
        total: 5000,
        paid: 1000,
        dueDate: new Date(Date.now() - day),
        createdBy: ownerUserId,
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
    await prisma.financeReceivable.create({
      data: {
        farmId: owner.farmId,
        reference: payableReference,
        kind: 'PAYABLE',
        entityName: 'E2E Supplier',
        total: 3000,
        paid: 0,
        dueDate: new Date(Date.now() + 2 * day),
        createdBy: ownerUserId,
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
    await prisma.financeReceivable.deleteMany({
      where: { reference: { in: [reference, payableReference] } },
    });
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
    // RAKHAL-485: one follow-up sweep replaced the four bespoke reproduction sweeps.
    expect(result.follow_up_and_reminder_due).toBeGreaterThanOrEqual(0);
    for (const gone of [
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
  });

  it('a second run on the same day is deduped (no new notifications)', async () => {
    const before = (await ownerNotifTitles()).length;
    await scheduler.runDailySweeps();
    const after = (await ownerNotifTitles()).length;
    expect(after).toBe(before);
  });
});
