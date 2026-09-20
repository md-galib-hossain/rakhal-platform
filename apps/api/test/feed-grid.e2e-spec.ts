import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feeding Grid (2026-08-15) e2e — replaces the old Quick Feed route. Covers: (1) save a draft then
 * GET the grid back reflects it; (2) confirm with no draft falls back to the carried-forward default
 * from a prior confirmed feeding; (3) confirm decrements `FeedItem.currentStock` and creates
 * `FeedDistribution` + `FeedDistributionCattleItem` rows; (4) a second day's `GET /feed/grid` shows
 * `default_offered_kg` prefilled from the first day's confirmed per-cow quantity; (5) RBAC — a
 * worker can view the grid (`feed.read`, granted RAKHAL-427 — the role that logs feeding
 * couldn't load the page it feeds from) and save/confirm via `feed.distribution-log`;
 * manager/owner both succeed at every step.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feeding Grid (e2e)', () => {
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
    `E2E-GRID-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const group = await request(server())
      .post(api('/settings/feed-groups'))
      .set(...auth(owner))
      .send({ name: `E2E Grid Group ${Date.now()}` })
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
        name: `E2E Grid Ingredient ${Date.now()}`,
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
        name: `E2E Grid Feed Item ${Date.now()}`,
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

  it('saves a draft, then GET /feed/grid reflects it', async () => {
    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date: '2026-05-01',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [
          { cattleId: cowA, offeredKg: 5 },
          { cattleId: cowB, offeredKg: 6 },
        ],
      })
      .expect(201);

    const grid = await request(server())
      .get(api(`/feed/grid?date=2026-05-01&feedGroupId=${feedGroupId}`))
      .set(...auth(owner))
      .expect(200);

    const cows = grid.body.data.cows as Array<{
      cattle_id: string;
      drafts: Array<{
        source_type: string;
        feed_item_id: string | null;
        offered_kg: number;
        // The API must never expose the pre-rename field name again.
        quantity_kg?: number;
      }>;
    }>;
    const rowA = cows.find((c) => c.cattle_id === cowA)!;
    const rowB = cows.find((c) => c.cattle_id === cowB)!;
    expect(rowA.drafts).toHaveLength(1);
    expect(rowA.drafts[0]).toMatchObject({
      source_type: 'FEED_ITEM',
      feed_item_id: feedItemId,
      offered_kg: 5,
    });
    expect(rowA.drafts[0].quantity_kg).toBeUndefined();
    expect(rowB.drafts[0].offered_kg).toBe(6);
  });

  it('confirms from the saved draft, decrements FeedItem stock, and creates the aggregate + per-cow rows', async () => {
    const before = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    const stockBefore = before.body.data.currentStock as number;

    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-05-01',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
      })
      .expect(201);

    expect(res.body.data.total_actual_kg).toBe(11);
    expect(res.body.data.cows).toHaveLength(2);
    const distributionId = res.body.data.id as string;

    const after = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(stockBefore - 11);

    const distribution = await prisma.feedDistribution.findUnique({
      where: { id: distributionId },
      include: { items: true, cattleItems: true },
    });
    expect(distribution).not.toBeNull();
    expect(distribution!.sourceType).toBe('FEEDING_GRID');
    expect(distribution!.items).toHaveLength(1);
    expect(distribution!.cattleItems).toHaveLength(2);
    const byCattle = new Map(
      distribution!.cattleItems.map((c) => [c.cattleId, c.offeredKg]),
    );
    expect(byCattle.get(cowA)).toBe(5);
    expect(byCattle.get(cowB)).toBe(6);

    // RAKHAL-327/328 follow-up: the aggregate line carries a frozen nutrient snapshot matching the
    // ingredient's values AT CONFIRM TIME (dmPct: 90, cpPct: 16, set on ingredient creation above).
    const line = distribution!.items[0];
    expect(line.dmPct).toBe(90);
    expect(line.cpPct).toBe(16);

    // Editing the ingredient's nutrition AFTER confirming must not change the already-frozen line.
    await request(server())
      .patch(api(`/feed/ingredients/custom/${ingredientId}`))
      .set(...auth(owner))
      .send({ cpPct: 30 })
      .expect(200);

    const afterEdit = await prisma.feedDistributionItem.findUnique({
      where: { id: line.id },
    });
    expect(afterEdit!.cpPct).toBe(16); // unchanged — still the value at confirm time
    expect(afterEdit!.dmPct).toBe(90);

    const distAfterEdit = await request(server())
      .get(api(`/feed/distributions/${distributionId}`))
      .set(...auth(owner))
      .expect(200);
    expect(distAfterEdit.body.data.items[0].line_cost).toBe(line.lineCost); // cost untouched too

    // Confirming consumes the day's drafts.
    const grid = await request(server())
      .get(api(`/feed/grid?date=2026-05-01&feedGroupId=${feedGroupId}`))
      .set(...auth(owner))
      .expect(200);
    const gridCows = grid.body.data.cows as Array<{
      cattle_id: string;
      drafts: unknown[];
      confirmed_offered_kg: number | null;
    }>;
    const rowA = gridCows.find((c) => c.cattle_id === cowA)!;
    const rowB = gridCows.find((c) => c.cattle_id === cowB)!;
    expect(rowA.drafts).toHaveLength(0);
    // RAKHAL-440/RD-099: re-opening the same day's grid must show it as already confirmed, not
    // just prefilled with a value indistinguishable from an untouched default.
    expect(rowA.confirmed_offered_kg).toBe(5);
    expect(rowB.confirmed_offered_kg).toBe(6);
  });

  it("a second day's grid shows default_offered_kg prefilled from the first day's confirmed quantity, and confirming with no draft falls back to it", async () => {
    const grid = await request(server())
      .get(api(`/feed/grid?date=2026-05-02&feedGroupId=${feedGroupId}`))
      .set(...auth(owner))
      .expect(200);
    const cows = grid.body.data.cows as Array<{
      cattle_id: string;
      default_offered_kg: number | null;
      confirmed_offered_kg: number | null;
      drafts: unknown[];
    }>;
    const rowA = cows.find((c) => c.cattle_id === cowA)!;
    const rowB = cows.find((c) => c.cattle_id === cowB)!;
    expect(rowA.drafts).toHaveLength(0);
    expect(rowA.default_offered_kg).toBe(5);
    expect(rowB.default_offered_kg).toBe(6);
    // RAKHAL-440/RD-099 (the actual bug report): day 2 hasn't been confirmed yet — the carried-
    // forward suggestion above must NOT be mistaken for an already-logged feeding.
    expect(rowA.confirmed_offered_kg).toBeNull();
    expect(rowB.confirmed_offered_kg).toBeNull();

    const before = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    const stockBefore = before.body.data.currentStock as number;

    // No draft and no `entries` for day 2 — must resolve purely from the carried-forward default.
    const confirmed = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-05-02',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
      })
      .expect(201);
    expect(confirmed.body.data.total_actual_kg).toBe(11);

    const after = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(stockBefore - 11);

    // RAKHAL-440/RD-099: once day 2 is itself confirmed, its grid must flip to confirmed too.
    const gridAfter = await request(server())
      .get(api(`/feed/grid?date=2026-05-02&feedGroupId=${feedGroupId}`))
      .set(...auth(owner))
      .expect(200);
    const cowsAfter = gridAfter.body.data.cows as Array<{
      cattle_id: string;
      confirmed_offered_kg: number | null;
    }>;
    expect(
      cowsAfter.find((c) => c.cattle_id === cowA)!.confirmed_offered_kg,
    ).toBe(5);
    expect(
      cowsAfter.find((c) => c.cattle_id === cowB)!.confirmed_offered_kg,
    ).toBe(6);
  });

  it('RD-100: confirming with an explicit entries list touches ONLY the named cow(s) — no sweep of other cows via their own carried-forward default', async () => {
    // By day 3, both cows have a resolvable carried-forward default (5/6, from day 2's confirm) AND
    // this call supplies a top-level default source — exactly the condition that used to sweep cowB
    // in too, even though only cowA is named.
    const before = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    const stockBefore = before.body.data.currentStock as number;

    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-05-03',
        feedGroupId,
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [{ cattleId: cowA, offeredKg: 4 }],
      })
      .expect(201);

    expect(res.body.data.total_actual_kg).toBe(4);
    expect(res.body.data.cows).toHaveLength(1);
    expect(res.body.data.cows[0].cattle_id).toBe(cowA);

    const after = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(stockBefore - 4);

    const distribution = await prisma.feedDistribution.findUnique({
      where: { id: res.body.data.id as string },
      include: { cattleItems: true },
    });
    expect(distribution!.cattleItems).toHaveLength(1);
    expect(distribution!.cattleItems[0].cattleId).toBe(cowA);

    // cowB must show no confirmed feeding for this date — it was never named.
    const grid = await request(server())
      .get(api(`/feed/grid?date=2026-05-03&feedGroupId=${feedGroupId}`))
      .set(...auth(owner))
      .expect(200);
    const rowB = (
      grid.body.data.cows as Array<{
        cattle_id: string;
        confirmed_offered_kg: number | null;
      }>
    ).find((c) => c.cattle_id === cowB)!;
    expect(rowB.confirmed_offered_kg).toBeNull();
  });

  describe('validation + RBAC', () => {
    it('400s a farmId in the body (forbidNonWhitelisted)', async () => {
      await request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send({
          date: '2026-05-03',
          sourceType: 'FEED_ITEM',
          feedItemId,
          entries: [{ cattleId: cowA, offeredKg: 1 }],
          farmId: 'x',
        })
        .expect(400);
    });

    it('404s an unknown feedItemId for a FEED_ITEM source', async () => {
      await request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send({
          date: '2026-05-03',
          sourceType: 'FEED_ITEM',
          feedItemId: 'does-not-exist',
          entries: [{ cattleId: cowA, offeredKg: 1 }],
        })
        .expect(404);
    });

    it('lets a worker READ the grid (feed.read, RAKHAL-427)', async () => {
      await request(server())
        .get(api(`/feed/grid?date=2026-05-03&feedGroupId=${feedGroupId}`))
        .set(...auth(worker))
        .expect(200);
    });

    it('lets a worker SAVE a draft and CONFIRM (feed.distribution-log)', async () => {
      await request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(worker))
        .send({
          date: '2026-05-03',
          feedGroupId,
          sourceType: 'FEED_ITEM',
          feedItemId,
          entries: [{ cattleId: cowA, offeredKg: 2 }],
        })
        .expect(201);

      await request(server())
        .post(api('/feed/grid/confirm'))
        .set(...auth(worker))
        .send({
          date: '2026-05-03',
          feedGroupId,
          sourceType: 'FEED_ITEM',
          feedItemId,
          entries: [{ cattleId: cowA, offeredKg: 2 }],
        })
        .expect(201);
    });

    it('lets a manager view + confirm the grid', async () => {
      await request(server())
        .get(api(`/feed/grid?date=2026-05-01&feedGroupId=${feedGroupId}`))
        .set(...auth(manager))
        .expect(200);

      await request(server())
        .post(api('/feed/grid/confirm'))
        .set(...auth(manager))
        .send({
          date: '2026-05-04',
          feedGroupId,
          sourceType: 'FEED_ITEM',
          feedItemId,
          entries: [{ cattleId: cowB, offeredKg: 3 }],
        })
        .expect(201);
    });
  });
});
