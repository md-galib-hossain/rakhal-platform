import request from 'supertest';
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
  let pregnancyId: string | null = null;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const day = 24 * 60 * 60 * 1000;

  const ownerNotifTitles = async (): Promise<string[]> => {
    const feed = await request(server())
      .get(api('/notifications?per_page=100'))
      .set(...auth(owner))
      .expect(200);
    return (feed.body.data.notifications as Array<{ title: string }>).map(
      (n) => n.title,
    );
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
        where: { farmId: owner.farmId, isActive: true },
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
  }, 30_000);

  afterAll(async () => {
    await prisma.financeReceivable.deleteMany({ where: { reference } });
    if (pregnancyId) {
      await prisma.pregnancy.deleteMany({ where: { id: pregnancyId } });
    }
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
    await ctx.app.close();
  });

  it('runDailySweeps emits the time-based alerts to the owner', async () => {
    const result = await scheduler.runDailySweeps();
    expect(result.payment_overdue).toBeGreaterThanOrEqual(1);
    if (pregnancyId) {
      expect(result.calving_expected_3_days).toBeGreaterThanOrEqual(1);
    }

    const titles = await ownerNotifTitles();
    expect(titles).toContain('Payment Overdue');
    if (pregnancyId) expect(titles).toContain('Calving Expected in 3 Days');
  });

  it('a second run on the same day is deduped (no new notifications)', async () => {
    const before = (await ownerNotifTitles()).length;
    await scheduler.runDailySweeps();
    const after = (await ownerNotifTitles()).length;
    expect(after).toBe(before);
  });
});
