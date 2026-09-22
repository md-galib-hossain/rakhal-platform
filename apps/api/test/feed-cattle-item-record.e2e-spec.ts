import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-441 (`docs/EPIC_FEED_PER_COW_RECORD.md`) e2e — per-cow feed cost, frozen nutrition
 * snapshot, session tag, and per-cow void/re-feed. Covers: (1) a Feeding Grid confirm freezes
 * `costTk`/`feedName`/nutrients/`session` on each cow's own `FeedDistributionCattleItem`; (2)
 * `GET /cattle/:id/finance` surfaces that cost in `expense_breakdown.feed`; (3) editing the
 * ingredient's nutrition after confirming does not rewrite the already-frozen per-cow row; (4)
 * voiding one cow's line credits back stock exactly, shrinks the sibling item/parent totals
 * exactly, and excludes it from the cattle-finance sum, without touching the other cow; (5) a
 * double-void is an idempotent no-op; (6) a worker cannot void (`feed.delete`, manager+); (7)
 * voiding every cow under a distribution auto-voids the parent; (8) an out-of-range session is
 * rejected, a valid one is accepted.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed per-cow record: cost/nutrition/void/session (RAKHAL-441, e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  let feedGroupId: string;
  let feedItemId: string;
  let ingredientId: string;
  let cowA: string;
  let cowB: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (label: string) =>
    `E2E-441-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const group = await request(server())
      .post(api('/settings/feed-groups'))
      .set(...auth(owner))
      .send({ name: `E2E 441 Group ${Date.now()}` })
      .expect(201);
    feedGroupId = group.body.data.id as string;

    const cattleA = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('A'), gender: 'FEMALE' })
      .expect(201);
    cowA = cattleA.body.data.id as string;

    const cattleB = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('B'), gender: 'FEMALE' })
      .expect(201);
    cowB = cattleB.body.data.id as string;

    await request(server())
      .post(api(`/feed/groups/${feedGroupId}/assign-cattle`))
      .set(...auth(owner))
      .send({ cattleIds: [cowA, cowB] })
      .expect(201);

    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E 441 Ingredient ${Date.now()}`,
        pricePerKg: 10,
        dmPct: 90,
        cpPct: 16,
      })
      .expect(201);
    ingredientId = ingredient.body.data.id as string;

    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E 441 Feed Item ${Date.now()}`,
        feedClass: 'CONCENTRATE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: 1000,
        costPerUnit: 10,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    feedItemId = feedItem.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects a session not in the farm's active list, accepts one that is", async () => {
    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-01',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
        session: 'NOT_A_REAL_SESSION',
        entries: [{ cattleId: cowA, offeredKg: 1 }],
      })
      .expect(400);
  });

  it('confirm freezes cost/name/nutrition/session per cow, and cattle finance surfaces it', async () => {
    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-01',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
        session: 'morning',
        entries: [
          { cattleId: cowA, offeredKg: 5 },
          { cattleId: cowB, offeredKg: 6 },
        ],
      })
      .expect(201);

    const distributionId = res.body.data.id as string;
    const cowARow = (
      res.body.data.cows as Array<{
        cattle_id: string;
        cost_tk: number;
        session: string;
      }>
    ).find((c) => c.cattle_id === cowA)!;
    expect(cowARow.cost_tk).toBe(50);
    expect(cowARow.session).toBe('MORNING');

    const distribution = await prisma.feedDistribution.findUnique({
      where: { id: distributionId },
      include: { items: true, cattleItems: true },
    });
    const cowAItem = distribution!.cattleItems.find(
      (c) => c.cattleId === cowA,
    )!;
    const cowBItem = distribution!.cattleItems.find(
      (c) => c.cattleId === cowB,
    )!;
    expect(cowAItem.costTk).toBe(50);
    expect(cowAItem.feedName).toBe(distribution!.items[0].ingredientName);
    expect(cowAItem.dmPct).toBe(90);
    expect(cowAItem.cpPct).toBe(16);
    expect(cowAItem.session).toBe('MORNING');
    expect(cowAItem.voidedAt).toBeNull();
    expect(cowBItem.costTk).toBe(60);

    // Editing the ingredient's nutrition AFTER confirming must not rewrite the already-frozen
    // per-cow row (same guarantee `FeedDistributionItem` already had — this closes the gap where
    // only the aggregate row, not the per-cow row, used to freeze it).
    await request(server())
      .patch(api(`/feed/ingredients/custom/${ingredientId}`))
      .set(...auth(owner))
      .send({ cpPct: 30 })
      .expect(200);
    const cowAAfterEdit = await prisma.feedDistributionCattleItem.findUnique({
      where: { id: cowAItem.id },
    });
    expect(cowAAfterEdit!.cpPct).toBe(16);

    const finance = await request(server())
      .get(api(`/cattle/${cowA}/finance?period=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(finance.body.data.expense_breakdown.feed).toBe(50);

    const financeB = await request(server())
      .get(api(`/cattle/${cowB}/finance?period=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(financeB.body.data.expense_breakdown.feed).toBe(60);

    (
      global as unknown as {
        __rakhal441: {
          distributionId: string;
          cowAItemId: string;
          cowBItemId: string;
        };
      }
    ).__rakhal441 = {
      distributionId,
      cowAItemId: cowAItem.id,
      cowBItemId: cowBItem.id,
    };
  });

  it('GET /feed/active-sessions exposes the farm sessions under feed.read', async () => {
    const res = await request(server())
      .get(api('/feed/active-sessions'))
      .set(...auth(worker))
      .expect(200);
    expect(res.body.data).toContain('MORNING');
  });

  it("GET /feed/grid/cattle/:cattleId/history lists that cow's own entries for the given date, not the other cow's", async () => {
    const { distributionId, cowAItemId } = (
      global as unknown as {
        __rakhal441: { distributionId: string; cowAItemId: string };
      }
    ).__rakhal441;

    const res = await request(server())
      .get(api(`/feed/grid/cattle/${cowA}/history`))
      .set(...auth(owner))
      .query({ date: '2026-06-01' })
      .expect(200);

    expect(res.body.data.date).toBe('2026-06-01');
    const entries = res.body.data.entries as Array<{
      id: string;
      distribution_id: string;
      cost_tk: number;
      session: string;
      voided_at: string | null;
    }>;
    expect(entries).toHaveLength(1);
    const cowAEntry = entries[0];
    expect(cowAEntry.id).toBe(cowAItemId);
    expect(cowAEntry.distribution_id).toBe(distributionId);
    expect(cowAEntry.cost_tk).toBe(50);
    expect(cowAEntry.session).toBe('MORNING');
    expect(cowAEntry.voided_at).toBeNull();
  });

  it('defaults to today when no date is given (empty for this fixture, which only confirmed on 2026-06-01)', async () => {
    const res = await request(server())
      .get(api(`/feed/grid/cattle/${cowA}/history`))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data.entries).toEqual([]);
  });

  it('404s for a cow that does not belong to this farm', async () => {
    await request(server())
      .get(api('/feed/grid/cattle/not-a-real-cattle-id/history'))
      .set(...auth(owner))
      .expect(404);
  });

  it('worker cannot void; manager can — exact stock/aggregate/finance reversal, other cow untouched', async () => {
    const { distributionId, cowAItemId } = (
      global as unknown as {
        __rakhal441: { distributionId: string; cowAItemId: string };
      }
    ).__rakhal441;

    const stockBefore = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    const stockBeforeQty = stockBefore.body.data.currentStock as number;

    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${distributionId}/cattle/${cowAItemId}/void`,
        ),
      )
      .set(...auth(worker))
      .send({ reason: 'test' })
      .expect(403);

    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${distributionId}/cattle/${cowAItemId}/void`,
        ),
      )
      .set(...auth(manager))
      .send({ reason: 'wrong amount entered' })
      .expect(201);

    const stockAfter = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(stockAfter.body.data.currentStock).toBe(stockBeforeQty + 5);

    const distribution = await prisma.feedDistribution.findUnique({
      where: { id: distributionId },
      include: { items: true, cattleItems: true },
    });
    expect(distribution!.totalActualKg).toBe(6); // 11 - 5
    expect(distribution!.totalActualCost).toBe(60); // 110 - 50
    expect(distribution!.items[0].actualKg).toBe(6);
    expect(distribution!.items[0].lineCost).toBe(60);
    expect(distribution!.voidedAt).toBeNull(); // cow B still active

    const cowAItem = distribution!.cattleItems.find(
      (c) => c.id === cowAItemId,
    )!;
    expect(cowAItem.voidedAt).not.toBeNull();
    expect(cowAItem.voidedBy).toBeTruthy();
    expect(cowAItem.voidReason).toBe('wrong amount entered');

    // Excluded from cattle finance now.
    const financeA = await request(server())
      .get(api(`/cattle/${cowA}/finance?period=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(financeA.body.data.expense_breakdown.feed).toBe(0);

    // Cow B's own number is completely unaffected by cow A's void.
    const financeB = await request(server())
      .get(api(`/cattle/${cowB}/finance?period=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(financeB.body.data.expense_breakdown.feed).toBe(60);
  });

  it('history still lists a voided entry, struck-through by voided_at, not hidden', async () => {
    const { cowAItemId } = (
      global as unknown as {
        __rakhal441: { cowAItemId: string };
      }
    ).__rakhal441;

    const res = await request(server())
      .get(api(`/feed/grid/cattle/${cowA}/history`))
      .set(...auth(owner))
      .query({ date: '2026-06-01' })
      .expect(200);

    const entries = res.body.data.entries as Array<{
      id: string;
      voided_at: string | null;
      void_reason: string | null;
    }>;
    const cowAEntry = entries.find((e) => e.id === cowAItemId)!;
    expect(cowAEntry.voided_at).not.toBeNull();
    expect(cowAEntry.void_reason).toBe('wrong amount entered');
  });

  it('a second void on the same line is an idempotent no-op', async () => {
    const { distributionId, cowAItemId } = (
      global as unknown as {
        __rakhal441: { distributionId: string; cowAItemId: string };
      }
    ).__rakhal441;

    const stockBefore = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);

    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${distributionId}/cattle/${cowAItemId}/void`,
        ),
      )
      .set(...auth(manager))
      .send({})
      .expect(201);

    const stockAfter = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    // No second credit-back — same balance as before this call.
    expect(stockAfter.body.data.currentStock).toBe(
      stockBefore.body.data.currentStock,
    );
  });

  it('voiding the last remaining cow auto-voids the parent distribution', async () => {
    const { distributionId, cowBItemId } = (
      global as unknown as {
        __rakhal441: { distributionId: string; cowBItemId: string };
      }
    ).__rakhal441;

    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${distributionId}/cattle/${cowBItemId}/void`,
        ),
      )
      .set(...auth(manager))
      .send({})
      .expect(201);

    const distribution = await prisma.feedDistribution.findUnique({
      where: { id: distributionId },
    });
    expect(distribution!.voidedAt).not.toBeNull();
    expect(distribution!.totalActualKg).toBe(0);
    expect(distribution!.totalActualCost).toBe(0);
  });
});
