import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { feedItemStock } from './utils/feed-fixtures';

/**
 * RAKHAL-430 (Feeding Favourites, `docs/EPIC_FEEDING_FAVOURITES.md`) — the Feeding Grid's
 * `confirm()` becomes multi-source: each cow can resolve to its own source (a per-entry override
 * on `entries[]`, falling back to the call's top-level default), grouped into one
 * `FeedDistributionItem` per distinct source inside one `FeedDistribution`, stock-validated and
 * decremented per source. Covers: two cows fed from two different sources in one confirm; a
 * shortfall on one source blocks the whole confirm with no partial write; `saveDraft` accepts a
 * per-entry override alongside a different top-level default for the rest of the call.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feeding Grid — multi-source confirm (e2e, RAKHAL-430)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  let cowA: string;
  let cowB: string;
  let ingredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (label: string) =>
    `E2E-GRIDMS-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const createFeedItem = async (stock: number) => {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Grid MS Item ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: stock,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

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

    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Grid MS Ingredient ${Date.now()}`,
        pricePerKg: 8,
        dmPct: 90,
        cpPct: 16,
      })
      .expect(201);
    ingredientId = ingredient.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('confirms two cows against two different sources in one call — one FeedDistribution, two lines, both decremented independently', async () => {
    const itemA = await createFeedItem(100);
    const itemB = await createFeedItem(100);
    const date = '2026-05-10';

    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date,
        entries: [
          {
            cattleId: cowA,
            offeredKg: 4,
            sourceType: 'FEED_ITEM',
            feedItemId: itemA,
          },
          {
            cattleId: cowB,
            offeredKg: 6,
            sourceType: 'FEED_ITEM',
            feedItemId: itemB,
          },
        ],
      })
      .expect(201);

    expect(res.body.data.total_actual_kg).toBe(10);
    expect(res.body.data.sources).toHaveLength(2);
    expect(res.body.data.cows).toHaveLength(2);

    const distribution = await prisma.feedDistribution.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
      include: { items: true, cattleItems: true },
    });
    expect(distribution.items).toHaveLength(2);
    expect(distribution.cattleItems).toHaveLength(2);

    const byCattle = new Map(
      distribution.cattleItems.map((c) => [c.cattleId, c]),
    );
    expect(byCattle.get(cowA)?.feedItemId).toBe(itemA);
    expect(byCattle.get(cowB)?.feedItemId).toBe(itemB);
    expect(byCattle.get(cowA)?.offeredKg).toBe(4);
    expect(byCattle.get(cowB)?.offeredKg).toBe(6);

    expect(await feedItemStock(prisma, itemA)).toBe(96);
    expect(await feedItemStock(prisma, itemB)).toBe(94);
  });

  it('a shortfall on one of two sources blocks the whole confirm — no partial write, neither item decremented', async () => {
    const itemOk = await createFeedItem(100);
    const itemShort = await createFeedItem(2); // only 2kg on hand
    const date = '2026-05-11';

    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date,
        entries: [
          {
            cattleId: cowA,
            offeredKg: 5,
            sourceType: 'FEED_ITEM',
            feedItemId: itemOk,
          },
          {
            cattleId: cowB,
            offeredKg: 10,
            sourceType: 'FEED_ITEM',
            feedItemId: itemShort,
          },
        ],
      });
    expect(res.status).toBe(400);

    expect(await feedItemStock(prisma, itemOk)).toBe(100);
    expect(await feedItemStock(prisma, itemShort)).toBe(2);

    const count = await prisma.feedDistribution.count({
      where: {
        farmId: owner.farmId,
        distributedAt: new Date(`${date}T00:00:00.000Z`),
      },
    });
    expect(count).toBe(0);
  });

  it('saveDraft: a per-entry source override coexists with a different top-level default for the rest of the call', async () => {
    const itemDefault = await createFeedItem(50);
    const itemOverride = await createFeedItem(50);
    const date = '2026-05-12';

    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date,
        sourceType: 'FEED_ITEM',
        feedItemId: itemDefault,
        entries: [
          { cattleId: cowA, offeredKg: 3 },
          {
            cattleId: cowB,
            offeredKg: 5,
            sourceType: 'FEED_ITEM',
            feedItemId: itemOverride,
          },
        ],
      })
      .expect(201);

    const draftA = await prisma.feedFeedingDraft.findFirst({
      where: { cattleId: cowA, feedItemId: itemDefault },
    });
    const draftB = await prisma.feedFeedingDraft.findFirst({
      where: { cattleId: cowB, feedItemId: itemOverride },
    });
    expect(draftA?.offeredKg).toBe(3);
    expect(draftB?.offeredKg).toBe(5);

    // Confirming names exactly these two cows (a confirm with no `entries` sweeps the whole shared
    // dev-DB herd); each keeps its own source — cowB's override beats the top-level default.
    const res = await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date,
        sourceType: 'FEED_ITEM',
        feedItemId: itemDefault,
        entries: [
          { cattleId: cowA, offeredKg: 3 },
          {
            cattleId: cowB,
            offeredKg: 5,
            sourceType: 'FEED_ITEM',
            feedItemId: itemOverride,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.cows).toHaveLength(2);
    const cows = res.body.data.cows as Array<{
      cattle_id: string;
      feed_item_id: string | null;
      offered_kg: number;
    }>;
    const rowA = cows.find((c) => c.cattle_id === cowA);
    const rowB = cows.find((c) => c.cattle_id === cowB);
    expect(rowA).toMatchObject({ feed_item_id: itemDefault, offered_kg: 3 });
    expect(rowB).toMatchObject({ feed_item_id: itemOverride, offered_kg: 5 });
  });
});
