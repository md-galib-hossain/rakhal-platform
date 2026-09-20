import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-433 (Feeding Favourites, `docs/EPIC_FEEDING_FAVOURITES.md`) — `FeedGroup` default-feed-source
 * CRUD via `PATCH /settings/feed-groups/:id`. This is the fallback the resolution ladder
 * (RAKHAL-431, `FeedFeedingGridService.resolveDefaultSources`) falls through to once a cow has no
 * usable own-last-used source. Covers: set a `FEED_ITEM` default, farm-ownership validation rejects
 * an item from a different farm (mirrors `rakhal-365-supplier-fk.e2e-spec.ts`'s cross-farm pattern —
 * a second farm for the same demo owner, since Prisma alone can't enforce farm equality), `null`
 * clears it back out.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Settings — Feed Group default-feed-source CRUD (e2e, RAKHAL-433)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let otherFarmOwner: AuthedUser;
  let farm2UserId: string;
  let farm2Id: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let ingredientId: string;
  let groupId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const farm2Throwaway = await createThrowawayOwner(
      ctx,
      prisma,
      unique('E2E-SettingsDS-OtherFarm'),
    );
    farm2UserId = farm2Throwaway.userId;
    farm2Id = farm2Throwaway.farmId;
    otherFarmOwner = farm2Throwaway.owner;

    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E SettingsDS Ingredient ${Date.now()}`,
        pricePerKg: 8,
        dmPct: 90,
        cpPct: 16,
      })
      .expect(201);
    ingredientId = ingredient.body.data.id as string;

    const group = await request(server())
      .post(api('/settings/feed-groups'))
      .set(...auth(owner))
      .send({ name: `E2E SettingsDS Group ${Date.now()}` })
      .expect(201);
    groupId = group.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await prisma.feedItem
      .deleteMany({ where: { farmId: farm2Id } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, {
      userId: farm2UserId,
      farmId: farm2Id,
    });
    await ctx.app.close();
  });

  const createFeedItem = async (user: AuthedUser, ownIngredientId: string) => {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(user))
      .send({
        name: `E2E SettingsDS Item ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        ingredientId: ownIngredientId,
        unitId: 'unit_kg',
        currentStock: 50,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    return res.body.data.id as string;
  };

  it('sets a FEED_ITEM default and surfaces it on the list route', async () => {
    const item = await createFeedItem(owner, ingredientId);

    await request(server())
      .patch(api(`/settings/feed-groups/${groupId}`))
      .set(...auth(owner))
      .send({ defaultFeedSourceType: 'FEED_ITEM', defaultFeedItemId: item })
      .expect(200);

    const list = await request(server())
      .get(api('/settings/feed-groups'))
      .set(...auth(owner))
      .expect(200);
    const group = (
      list.body.data as Array<{
        id: string;
        default_feed_source_type: string | null;
        default_feed_item_id: string | null;
        default_feed_stock_id: string | null;
      }>
    ).find((g) => g.id === groupId);
    expect(group).toMatchObject({
      default_feed_source_type: 'FEED_ITEM',
      default_feed_item_id: item,
      default_feed_stock_id: null,
    });
  });

  it('rejects a feed item belonging to a different farm', async () => {
    // A freshly created farm is on the Free plan without `feed.formulator`, so
    // `/feed/ingredients/custom` is gated — use a system-seeded (farmId: null)
    // ingredient instead, which every farm can reference regardless of plan.
    const systemIngredient = await prisma.feedIngredient.findFirstOrThrow({
      where: { farmId: null },
      select: { id: true },
    });
    const otherFarmItem = await createFeedItem(
      otherFarmOwner,
      systemIngredient.id,
    );

    await request(server())
      .patch(api(`/settings/feed-groups/${groupId}`))
      .set(...auth(owner))
      .send({
        defaultFeedSourceType: 'FEED_ITEM',
        defaultFeedItemId: otherFarmItem,
      })
      .expect(400);
  });

  it('null clears the default back out entirely', async () => {
    const item = await createFeedItem(owner, ingredientId);
    await request(server())
      .patch(api(`/settings/feed-groups/${groupId}`))
      .set(...auth(owner))
      .send({ defaultFeedSourceType: 'FEED_ITEM', defaultFeedItemId: item })
      .expect(200);

    await request(server())
      .patch(api(`/settings/feed-groups/${groupId}`))
      .set(...auth(owner))
      .send({ defaultFeedSourceType: null })
      .expect(200);

    const list = await request(server())
      .get(api('/settings/feed-groups'))
      .set(...auth(owner))
      .expect(200);
    const group = (
      list.body.data as Array<{
        id: string;
        default_feed_source_type: string | null;
        default_feed_item_id: string | null;
        default_feed_stock_id: string | null;
      }>
    ).find((g) => g.id === groupId);
    expect(group).toMatchObject({
      default_feed_source_type: null,
      default_feed_item_id: null,
      default_feed_stock_id: null,
    });
  });
});
