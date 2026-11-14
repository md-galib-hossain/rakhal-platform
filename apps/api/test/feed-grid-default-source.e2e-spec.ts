import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-431 (Feeding Favourites, `docs/EPIC_FEEDING_FAVOURITES.md`) — the resolution ladder
 * (own last-used → none), surfaced as `default_source` on `GET /feed/grid`. Covers the
 * availability guard (a soft-deleted/zero-stock item is skipped) and batch fall-forward (an
 * exhausted `FeedStock` lot resolves to a sibling lot of the same recipe).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feeding Grid — default_source resolution ladder (e2e, RAKHAL-431)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (label: string) =>
    `E2E-GRIDDS-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let ingredientId: string;

  const createCow = async (label: string) => {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag(label), gender: 'FEMALE' })
      .expect(201);
    return res.body.data.id as string;
  };

  const createFeedItem = async (stock: number) => {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E GridDS Item ${Date.now()}-${Math.random()}`,
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

    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E GridDS Ingredient ${Date.now()}`,
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

  const getGrid = async (date: string) => {
    const res = await request(server())
      .get(api(`/feed/grid?date=${date}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data.cows as Array<{
      cattle_id: string;
      default_source: {
        source_type: string;
        feed_item_id: string | null;
        feed_stock_id: string | null;
      } | null;
    }>;
  };

  it('resolves own last-used as the default source', async () => {
    const cow = await createCow('A');
    const item = await createFeedItem(50);

    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-01',
        entries: [
          {
            cattleId: cow,
            offeredKg: 4,
            sourceType: 'FEED_ITEM',
            feedItemId: item,
          },
        ],
      })
      .expect(201);

    const cows = await getGrid('2026-06-02');
    const row = cows.find((c) => c.cattle_id === cow);
    expect(row?.default_source).toMatchObject({
      source_type: 'FEED_ITEM',
      feed_item_id: item,
    });
  });

  it('availability guard: a soft-deleted feed item is skipped, falling through to none', async () => {
    const cow = await createCow('C');
    const item = await createFeedItem(50);

    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-01',
        entries: [
          {
            cattleId: cow,
            offeredKg: 2,
            sourceType: 'FEED_ITEM',
            feedItemId: item,
          },
        ],
      })
      .expect(201);

    await prisma.feedItem.update({
      where: { id: item },
      data: { deletedAt: new Date() },
    });

    const cows = await getGrid('2026-06-02');
    const row = cows.find((c) => c.cattle_id === cow);
    expect(row?.default_source).toBeNull();
  });

  it('batch fall-forward: an exhausted FeedStock lot resolves to a sibling lot of the same recipe', async () => {
    const cow = await createCow('D');

    const concentration = await prisma.feedConcentration.create({
      data: {
        farmId: owner.farmId,
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E GridDS Recipe ${Date.now()}`,
        createdBy: 'e2e-test-setup',
      },
    });
    const nutrients = {
      dmPct: 90,
      cpPct: 16,
      meMjPerKgDm: 10,
      fatPct: 3,
      ndfPct: 30,
      rdpPct: 60,
      rupPct: 40,
      starchPct: 20,
      adfPct: 20,
      calciumPct: 1,
      phosphorusPct: 0.5,
      tdnPct: 70,
    };
    const profileId = (
      await prisma.nutritionProfile.create({
        data: {
          farmId: owner.farmId,
          ...nutrients,
          nutritionSource: 'REFERENCE',
          createdBy: 'e2e-test-setup',
        },
      })
    ).id;
    const lot1 = await prisma.feedStock.create({
      data: {
        farmId: owner.farmId,
        kind: 'CONCENTRATE_TEMPLATE',
        sourceConcentrationId: concentration.id,
        sourceConcentrationVersion: 1,
        producedAt: new Date('2026-05-01'),
        producedQtyKg: 5,
        currentStockKg: 5,
        producedCostTk: 40,
        createdBy: 'e2e-test-setup',
        nutritionProfileId: profileId,
      },
    });

    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-01',
        entries: [
          {
            cattleId: cow,
            offeredKg: 5,
            sourceType: 'FEED_STOCK',
            feedStockId: lot1.id,
          },
        ],
      })
      .expect(201);

    const lot1After = await prisma.feedStock.findUniqueOrThrow({
      where: { id: lot1.id },
    });
    expect(lot1After.currentStockKg).toBe(0);

    const lot2 = await prisma.feedStock.create({
      data: {
        farmId: owner.farmId,
        kind: 'CONCENTRATE_TEMPLATE',
        sourceConcentrationId: concentration.id,
        sourceConcentrationVersion: 1,
        producedAt: new Date('2026-06-02'),
        producedQtyKg: 20,
        currentStockKg: 20,
        producedCostTk: 160,
        createdBy: 'e2e-test-setup',
        nutritionProfileId: profileId,
      },
    });

    const cows = await getGrid('2026-06-03');
    const row = cows.find((c) => c.cattle_id === cow);
    expect(row?.default_source).toMatchObject({
      source_type: 'FEED_STOCK',
      feed_stock_id: lot2.id,
    });
  });
});
