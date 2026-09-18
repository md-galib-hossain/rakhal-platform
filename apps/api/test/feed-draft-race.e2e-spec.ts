import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-089 (docs/TECH_DEBT.md) — two concurrent `POST /feed/grid/draft` calls for the same
 * cow/date/source used to both pass `saveDraft()`'s own `findFirst` check before either committed,
 * duplicating the `FeedFeedingDraft` row. Fixed with a partial unique index per source branch
 * (migration `20260918130000_rd089_feed_draft_unique_partial_index`) plus a P2002-recovery path
 * (`FeedFeedingGridService.createOrRecoverDraft`) so the loser of the race updates instead of
 * 500ing or silently duplicating.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feeding Grid — concurrent draft save race (e2e, RD-089)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  let cattleId: string;
  let feedItemId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const cattle = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: `E2E-RD089-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
      })
      .expect(201);
    cattleId = cattle.body.data.id as string;

    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E RD089 Ingredient ${Date.now()}`,
        pricePerKg: 8,
        dmPct: 90,
        cpPct: 16,
      })
      .expect(201);

    const item = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E RD089 Item ${Date.now()}`,
        feedClass: 'CONCENTRATE',
        ingredientId: ingredient.body.data.id as string,
        unitId: 'unit_kg',
        currentStock: 100,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    feedItemId = item.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('two concurrent saves for the same cow/date/source both succeed and leave exactly one row', async () => {
    const date = '2026-07-01';
    const body = (offeredKg: number) => ({
      date,
      entries: [
        {
          cattleId,
          offeredKg,
          sourceType: 'FEED_ITEM',
          feedItemId,
        },
      ],
    });

    const [resA, resB] = await Promise.all([
      request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send(body(5)),
      request(server())
        .post(api('/feed/grid/draft'))
        .set(...auth(owner))
        .send(body(7)),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    const rows = await prisma.feedFeedingDraft.findMany({
      where: {
        cattleId,
        feedItemId,
        logDate: new Date(`${date}T00:00:00.000Z`),
      },
    });
    expect(rows).toHaveLength(1);
    // Whichever request actually committed last (the recovered loser's update, or the winner's
    // own create) determines the final value — either is a valid outcome, the point is there's
    // exactly one row, not which offeredKg survived.
    expect([5, 7]).toContain(rows[0].offeredKg);
  });
});
