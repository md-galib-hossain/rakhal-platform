import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-276 — SafetyWithdrawal silent-auto-release fix. A withdrawal past
 * its `until` date must keep blocking milk sale until an explicit,
 * audited `releaseWithdrawal` call — never as a side effect of a plain read
 * (the v1 bug this ticket exists to correct).
 *
 * NOTE: requires the `20260805150000_rakhal_276_safety_withdrawal_status`
 * migration applied (`prisma migrate deploy`) against the dev DB before this
 * can run — per this ticket's instructions, written but NOT applied here
 * (shared dev DB, one migration at a time across agents). Requires the dev
 * stack up + `pnpm seed`.
 */
describe('Health — SafetyWithdrawal release flow (RAKHAL-276)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  /**
   * RD-094: every test used to share one `cattleId`/`healthCaseId` from `beforeAll`, with no
   * per-test cleanup of the `SafetyWithdrawal` rows each test created — a later test's milk-tank
   * assertion could read `tankLocked: true` from an earlier test's still-active withdrawal on that
   * same cow, not its own. Giving each test its own cow (mirrors
   * `medicine-cross-batch-decrement.e2e-spec.ts`'s `createCow()` pattern) makes every test's tank
   * state provably its own — no shared row, nothing to leak across tests.
   */
  async function createCowWithHealthCase() {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RAKHAL276-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        productionStatus: 'MILKING',
        createdBy: ownerUserId,
      },
    });

    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cow.id,
        caseCode: `HC-E2E-RAKHAL276-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        note: 'Mastitis under antibiotic treatment',
        careType: 'CURATIVE',
        priority: 'HIGH',
        reportedBy: ownerUserId,
      },
    });

    return { cattleId: cow.id, healthCaseId: healthCase.id };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('a past-due, unreleased withdrawal still blocks milk sale (no silent auto-release on a plain GET)', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: pastDue,
        status: 'ACTIVE',
      },
    });

    // A plain read (milk log for today) must still show the cow withheld —
    // the whole point of this ticket's fix.
    const today = new Date().toISOString().slice(0, 10);
    const logRes = await request(server())
      .get(api(`/milk/log?date=${today}`))
      .set(...auth(owner));
    expect(logRes.status).toBe(200);
    const row = (
      logRes.body.data.entries as Array<{ cattleId: string; log: unknown }>
    ).find((e) => e.cattleId === cattleId);
    expect(row).toBeDefined();
    expect((row!.log as { tankLocked: boolean }).tankLocked).toBe(true);

    // ...and the read must not have mutated the row's status as a side effect.
    const reread = await prisma.safetyWithdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
    expect(reread.status).toBe('ACTIVE');
  });

  it('the daily sweep (not a read) transitions ACTIVE + past-due to READY_FOR_RELEASE', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: pastDue,
        status: 'ACTIVE',
      },
    });

    const res = await request(server())
      .post(api('/health/safety-withdrawals/refresh'))
      .set(...auth(owner));
    expect(res.status).toBe(201);

    const swept = await prisma.safetyWithdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
    expect(swept.status).toBe('READY_FOR_RELEASE');
  });

  it('releaseWithdrawal is the only path to RELEASED, and clears milk withholding', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: pastDue,
        status: 'READY_FOR_RELEASE',
      },
    });

    const res = await request(server())
      .post(api(`/health/safety-withdrawals/${withdrawal.id}/release`))
      .set(...auth(owner));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('RELEASED');

    const today = new Date().toISOString().slice(0, 10);
    const logRes = await request(server())
      .get(api(`/milk/log?date=${today}`))
      .set(...auth(owner));
    const row = (
      logRes.body.data.entries as Array<{ cattleId: string; log: unknown }>
    ).find((e) => e.cattleId === cattleId);
    expect((row!.log as { tankLocked: boolean }).tankLocked).toBe(false);
  });

  it('releasing an already-RELEASED withdrawal is idempotent', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() - 1000),
        status: 'RELEASED',
      },
    });

    const res = await request(server())
      .post(api(`/health/safety-withdrawals/${withdrawal.id}/release`))
      .set(...auth(owner));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('RELEASED');
  });

  it('404s releasing a withdrawal id that does not exist in the farm', async () => {
    const res = await request(server())
      .post(api('/health/safety-withdrawals/does-not-exist/release'))
      .set(...auth(owner));
    expect(res.status).toBe(404);
  });

  it('worker RBAC: cannot release a withdrawal', async () => {
    const { cattleId, healthCaseId } = await createCowWithHealthCase();
    const withdrawal = await prisma.safetyWithdrawal.create({
      data: {
        farmId: owner.farmId,
        cattleId,
        healthCaseId,
        milkWithdrawalUntil: new Date(Date.now() - 1000),
        status: 'ACTIVE',
      },
    });

    const res = await request(server())
      .post(api(`/health/safety-withdrawals/${withdrawal.id}/release`))
      .set(...auth(worker));
    expect(res.status).toBe(403);
  });
});
