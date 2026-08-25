import request from 'supertest';
import { BadRequestException } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SellMilkUseCase } from '../src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import { MilkAvailabilityService } from '../src/modules/milk/application/services/milk-availability.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-343 — Milk availability read model + concurrency lock
 * (`FINANCE_V2_DESIGN.md` §9's exact proof requirement: "two concurrent 80L
 * sales against 100L — only one succeeds"). Calls `SellMilkUseCase.execute`
 * and `MilkAvailabilityService` directly through the app's DI container —
 * same pattern `sell-milk.e2e-spec.ts` (RAKHAL-342) already established for
 * a use case with no HTTP route of its own.
 *
 * The concurrency test below is deliberately built to be a genuine race, not
 * a fake one that only looks concurrent: both `execute()` calls are started
 * (not awaited) before either is awaited, via `Promise.allSettled`, so both
 * transactions are open against the live Postgres at the same time. Each
 * `execute()` opens its own `$transaction`, which itself opens a real
 * Postgres transaction on its own pooled connection — there is no
 * single-threaded-JS shortcut here, the two `BEGIN`s are genuinely
 * concurrent at the database.
 */
describe('RAKHAL-343 — Milk availability + concurrency lock (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellMilk: SellMilkUseCase;
  let milkAvailability: MilkAvailabilityService;
  let owner: AuthedUser;
  let ownerUserId: string;
  /** Every tank `makeTank` creates, archived in `afterAll` — an active
   * SELLABLE tank left behind (especially the deliberately huge one the
   * concurrency test below needs) would otherwise become "the fullest
   * active SELLABLE tank" for every *other* suite's `SellMilkUseCase` call
   * against this same shared dev DB, corrupting their tank selection. */
  const createdTankIds: string[] = [];

  const server = () => ctx.app.getHttpServer();
  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-343-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellMilk = ctx.app.get(SellMilkUseCase);
    milkAvailability = ctx.app.get(MilkAvailabilityService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterEach(async () => {
    // Archive every tank this test created *immediately* (not just at
    // suite-end) — minimizes the window where a huge test tank could be
    // picked up as "the fullest active SELLABLE tank" by an unrelated e2e
    // spec running concurrently in another Jest worker against the same
    // shared dev DB.
    while (createdTankIds.length > 0) {
      const tankId = createdTankIds.pop()!;
      await request(server())
        .delete(api(`/inventory/milk-tanks/${tankId}`))
        .set(...auth(owner));
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A dedicated, freshly-created tank at a known exact volume — every
   * assertion below reads it back by its own id, never by "the" tank, so
   * these tests are safe to run alongside other active SELLABLE tanks in
   * the shared dev DB (`GET /milk/availability` and `lockAndValidate` both
   * take an explicit `tankId`). The one exception is the concurrency test
   * further down, which exercises `SellMilkUseCase`'s auto-selected "fullest
   * tank" and documents its own DB-safety margin inline. */
  async function makeTank(
    currentVolumeL: number,
    totalCapacityL: number = Math.max(currentVolumeL * 2, 1_000_000),
  ): Promise<string> {
    const tank = await request(server())
      .post(api('/inventory/milk-tanks'))
      .set(...auth(owner))
      .send({
        name: `E2E-343 Tank ${tag()}`,
        tankType: 'SELLABLE',
        totalCapacityL,
        currentVolumeL,
      })
      .expect(201);
    const tankId = tank.body.data.id as string;
    createdTankIds.push(tankId);
    return tankId;
  }

  async function tankVolume(tankId: string): Promise<number> {
    const res = await request(server())
      .get(api(`/inventory/milk-tanks/${tankId}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data.currentVolumeL as number;
  }

  describe('GET /milk/availability', () => {
    it('reports currentVolumeL for a named SELLABLE tank', async () => {
      const tankId = await makeTank(321);

      const res = await request(server())
        .get(api(`/milk/availability?tankId=${tankId}`))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data.tanks).toEqual([
        expect.objectContaining({ tankId, availableL: 321 }),
      ]);
      expect(res.body.data.totalAvailableL).toBe(321);
    });

    it('404s for a tankId that does not belong to the farm', async () => {
      await request(server())
        .get(api('/milk/availability?tankId=not-a-real-tank'))
        .set(...auth(owner))
        .expect(404);
    });

    it('lists every active SELLABLE tank when tankId is omitted', async () => {
      const tankId = await makeTank(55);

      const res = await request(server())
        .get(api('/milk/availability'))
        .set(...auth(owner))
        .expect(200);

      const ids = (res.body.data.tanks as Array<{ tankId: string }>).map(
        (t) => t.tankId,
      );
      expect(ids).toContain(tankId);
    });
  });

  describe('MilkAvailabilityService.lockAndValidate', () => {
    it('throws when the requested volume exceeds the locked tank', async () => {
      const tankId = await makeTank(10);

      await prisma.$transaction(async (tx) => {
        await expect(
          milkAvailability.lockAndValidate(owner.farmId, tankId, 11, tx),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('succeeds and returns the locked volume when sufficient', async () => {
      const tankId = await makeTank(50);

      await prisma.$transaction(async (tx) => {
        const locked = await milkAvailability.lockAndValidate(
          owner.farmId,
          tankId,
          50,
          tx,
        );
        expect(locked.currentVolumeL).toBe(50);
      });
    });
  });

  describe('two concurrent sales against the same tank — only one succeeds', () => {
    it('exactly one succeeds; the other fails cleanly with no partial writes', async () => {
      // `SellMilkUseCase` has no `tankId` input — it always decrements the
      // single fullest active SELLABLE tank for the farm
      // (`decrementSellableTank`'s own `orderBy: currentVolumeL desc`). To
      // make *this* test's tank unambiguously "the fullest" regardless of
      // whatever other tanks the shared dev DB holds — the same caveat
      // `sell-milk.e2e-spec.ts` documents for its own tank, which solves it
      // by being "deliberately overfull" — this test uses a tank two orders
      // of magnitude larger than any real farm tank and requests 80% of it
      // twice: the same "two concurrent sales at 80% of tank volume, only
      // one succeeds" shape `FINANCE_V2_DESIGN.md` §9 specifies as "two
      // concurrent 80L sales against 100L", scaled up for DB-safety rather
      // than restated with the literal 80/100 (which a fellow parallel
      // agent's own tank could realistically exceed).
      const totalVolumeL = 10_000_000;
      const saleVolumeL = 8_000_000; // 80% of totalVolumeL, mirroring 80L/100L
      const tankId = await makeTank(totalVolumeL);
      const tagA = tag();
      const tagB = tag();

      // Both calls are STARTED (not awaited) before either is awaited, so
      // both `SellMilkUseCase.execute` transactions are genuinely open
      // against Postgres at the same time — this is the real race, not a
      // sequential-await fake.
      const callA = sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: saleVolumeL,
        pricePerLitre: 10,
        notes: tagA,
      });
      const callB = sellMilk.execute(owner.farmId, ownerUserId, {
        volumeL: saleVolumeL,
        pricePerLitre: 10,
        notes: tagB,
      });

      const [resultA, resultB] = await Promise.allSettled([callA, callB]);

      const outcomes = [resultA, resultB];
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      // Exactly one succeeds, the other fails cleanly.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);

      // Tank lands at exactly totalVolumeL - saleVolumeL (20% remaining) —
      // one real decrement, never both (which would go negative) and never
      // neither (which would leave totalVolumeL untouched).
      const after = await tankVolume(tankId);
      expect(after).toBeCloseTo(totalVolumeL - saleVolumeL, 2);
      expect(after).toBeGreaterThanOrEqual(0);

      // The winning tag produced a real, CONFIRMED Sale; the losing tag
      // produced nothing at all — no orphaned Sale/Receivable/Payment/
      // JournalTransaction from the rejected transaction.
      const winningTag = fulfilled[0] === resultA ? tagA : tagB;
      const losingTag = winningTag === tagA ? tagB : tagA;

      const winningSale = await prisma.sale.findFirst({
        where: { farmId: owner.farmId, notes: winningTag },
      });
      expect(winningSale).toBeTruthy();
      expect(winningSale!.status).toBe(SaleStatus.CONFIRMED);

      const losingSale = await prisma.sale.findFirst({
        where: { farmId: owner.farmId, notes: losingTag },
      });
      expect(losingSale).toBeNull();

      const losingReceivable = await prisma.receivable.findFirst({
        where: { farmId: owner.farmId, sale: { notes: losingTag } },
      });
      expect(losingReceivable).toBeNull();

      // No JournalTransaction can be traced to the losing call either — it
      // has no `sourceId` to look up (`losingSale` is null, proven above),
      // which is itself the proof: the losing transaction's rollback wiped
      // its Sale row before any journal posting could reference it.
      const journalCountForFarm = await prisma.journalTransaction.count({
        where: {
          farmId: owner.farmId,
          sourceType: 'SALE',
          sourceId: winningSale!.id,
        },
      });
      expect(journalCountForFarm).toBe(1);

      // The tank's audit trail carries exactly one SALE decrement for this
      // tank from this test, not two.
      const saleAuditRows = await prisma.milkTankAuditLog.count({
        where: { milkTankId: tankId, activityType: 'SALE' },
      });
      expect(saleAuditRows).toBe(1);
    }, 20_000);
  });
});
