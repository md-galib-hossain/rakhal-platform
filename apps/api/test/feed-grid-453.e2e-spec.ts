import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-453 (MILESTONE 27 phase 0) — feeding correctness regressions:
 *  (a) a voided feeding is neither "confirmed today" nor tomorrow's default (RD-104);
 *  (b) the FeedStock/FeedItem decrement is atomic with the confirm — a shortfall leaves no
 *      distribution behind (RD-105);
 *  (c) grid feedings count toward `GET /feed/cattle/:id/dmi` actual intake, net of refusal (RD-106);
 *  (d) a draft's `refusalKg` is persisted and returned by `GET /feed/grid` (RD-107);
 *  (e) a female with no calvings is a HEIFER for the requirement engine (RD-108).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feeding Grid — RAKHAL-453 (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let feedItemId: string;
  let cow: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (l: string) => `E2E-453-${l}-${Date.now()}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const c = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('C'), gender: 'FEMALE', weightKg: 400 })
      .expect(201);
    cow = c.body.data.id as string;

    const ing = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E 453 Ingredient ${Date.now()}`,
        pricePerKg: 10,
        dmPct: 90,
        cpPct: 16,
      })
      .expect(201);

    const fi = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E 453 Feed ${Date.now()}`,
        feedClass: 'CONCENTRATE',
        ingredientId: ing.body.data.id,
        unitId: 'unit_kg',
        currentStock: 1000,
        costPerUnit: 10,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    feedItemId = fi.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const confirm = (date: string, offeredKg: number, refusalKg?: number) =>
    request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date,
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [{ cattleId: cow, offeredKg, refusalKg }],
      });

  const cowRow = async (date: string) => {
    const grid = await request(server())
      .get(api(`/feed/grid?date=${date}`))
      .set(...auth(owner))
      .expect(200);
    return (
      grid.body.data.cows as Array<{
        cattle_id: string;
        default_offered_kg: number | null;
        confirmed_offered_kg: number | null;
        drafts: Array<{ offered_kg: number; refusal_kg: number | null }>;
      }>
    ).find((r) => r.cattle_id === cow)!;
  };

  it('(a) a voided feeding is not confirmed today and not tomorrow’s default', async () => {
    const res = await confirm('2026-06-10', 7).expect(201);
    const distributionId = res.body.data.id as string;
    expect((await cowRow('2026-06-10')).confirmed_offered_kg).toBe(7);
    expect((await cowRow('2026-06-11')).default_offered_kg).toBe(7);

    const item = await prisma.feedDistributionCattleItem.findFirstOrThrow({
      where: { distributionId, cattleId: cow },
    });
    await request(server())
      .post(
        api(
          `/feed/grid/distributions/${distributionId}/cattle/${item.id}/void`,
        ),
      )
      .set(...auth(owner))
      .send({ reason: 'e2e' })
      .expect(201);

    expect((await cowRow('2026-06-10')).confirmed_offered_kg).toBeNull();
    expect((await cowRow('2026-06-11')).default_offered_kg).toBeNull();
  });

  it('(b) a stock shortfall leaves no distribution row behind', async () => {
    const before = await prisma.feedDistribution.count({
      where: { sourceType: 'FEEDING_GRID' },
    });
    await confirm('2026-06-12', 999_999).expect(400);
    const after = await prisma.feedDistribution.count({
      where: { sourceType: 'FEEDING_GRID' },
    });
    expect(after).toBe(before);
  });

  it('(c) grid feedings count toward DMI actual, net of refusal', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // 10 kg offered, 2 kg refused, 90 % DM → 8 × 0.9 = 7.2 kg DM.
    await confirm(today, 10, 2).expect(201);
    const dmi = await request(server())
      .get(api(`/feed/cattle/${cow}/dmi?date=${today}`))
      .set(...auth(owner))
      .expect(200);
    expect(dmi.body.data.actual_dmi_kg).toBeCloseTo(7.2, 1);
  });

  it('(d) a draft refusal is persisted and returned by GET /feed/grid', async () => {
    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date: '2026-06-13',
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [{ cattleId: cow, offeredKg: 6, refusalKg: 1.5 }],
      })
      .expect(201);
    const row = await cowRow('2026-06-13');
    expect(row.drafts[0]).toMatchObject({ offered_kg: 6, refusal_kg: 1.5 });

    // Re-saving the quantity without a refusal must not wipe the weighed-back value.
    await request(server())
      .post(api('/feed/grid/draft'))
      .set(...auth(owner))
      .send({
        date: '2026-06-13',
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [{ cattleId: cow, offeredKg: 8 }],
      })
      .expect(201);
    expect((await cowRow('2026-06-13')).drafts[0]).toMatchObject({
      offered_kg: 8,
      refusal_kg: 1.5,
    });
  });

  it('(e) a female with no calvings is a HEIFER for the requirement engine', async () => {
    const r = await request(server())
      .get(api(`/feed/requirements?cattleId=${cow}`))
      .set(...auth(owner))
      .expect(200);
    expect(r.body.data.inputs.animal_type).toBe('HEIFER');
  });
});
