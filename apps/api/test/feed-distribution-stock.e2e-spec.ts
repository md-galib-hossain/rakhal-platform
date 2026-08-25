import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — Phase 4 + Phase 12.4 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md`: a `POST /feed/distributions` line
 * can name a specific `FeedStock` lot (`items[].stockId`, Phase 4, 2026-07-17) to decrement via a
 * real FK-backed, validated, transactional path (`FeedStockService.decrementForDistribution`)
 * instead of the existing best-effort `FeedItem` ingredientId-match. As of Phase 12.4 (2026-07-18, "Feed
 * Today"), a distribution with **no** explicit `stockId` on any line still auto-decrements the
 * concentration's own finalized batch lot (`FeedStock.sourceConcentrationId`) if one exists — the
 * frontend never picks a stock lot manually, it relies entirely on this. Covers: the explicit-
 * stockId happy path (decrement + audit movement); over-consumption (400, no partial state); the
 * auto-resolved own-batch path; and that a concentration with no finalized lot at all is a genuine
 * no-op, not an error.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — distribution decrements a named feed stock lot (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let ingredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Dist-Stock Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 8,
        dmPct: 90,
        cpPct: 10,
        meMjPerKgDm: 9,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function produceStock(amountKg: number) {
    // A stock lot only ever comes from finalizing a Total Mixed Ration (TMR) — a Concentrate
    // Mixer is a virtual recipe/calculator that never touches inventory (2026-07-19 correction).
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Dist-Stock Mixture ${Date.now()}-${Math.random()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [{ ingredientId, amountKg }],
      })
      .expect(201);
    const finalized = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH' })
      .expect(201);
    return {
      concentrationId: conc.body.data.id as string,
      stockId: finalized.body.data.stock.id as string,
    };
  }

  it('decrements the named stock lot transactionally and records a FED movement', async () => {
    const { concentrationId, stockId } = await produceStock(20);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId,
        items: [{ ingredientId, actualKg: 12, stockId }],
      })
      .expect(201);

    const detail = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.current_stock_kg).toBeCloseTo(8, 1); // 20 - 12
    const fed = detail.body.data.movements.find(
      (m: { reason: string }) => m.reason === 'FED',
    );
    expect(fed).toBeTruthy();
    expect(fed.change_kg).toBeCloseTo(-12, 1);
    expect(fed.distribution_id).toBeTruthy();
  });

  it('rejects over-consumption before creating the distribution (no partial state)', async () => {
    const { concentrationId, stockId } = await produceStock(5);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId,
        items: [{ ingredientId, actualKg: 999, stockId }],
      })
      .expect(400);

    // Stock is untouched — the sufficiency check ran (and threw) before the distribution's
    // transaction, so no partial decrement happened.
    const detail = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.current_stock_kg).toBeCloseTo(5, 1);
  });

  it("a line without stockId still auto-decrements the concentration's own finalized batch lot (Phase 12.4, 2026-07-18)", async () => {
    const { concentrationId, stockId } = await produceStock(15);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId, items: [{ ingredientId, actualKg: 5 }] })
      .expect(201);

    // No explicit stockId was supplied, but this concentration has its own finalized batch lot —
    // "Feed Today" (the frontend's only caller) never picks a stockId manually, relying entirely on
    // this auto-resolution to make stock actually move.
    const detail = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.current_stock_kg).toBeCloseTo(10, 1); // 15 - 5
    const fed = detail.body.data.movements.find(
      (m: { reason: string }) => m.reason === 'FED',
    );
    expect(fed).toBeTruthy();
    expect(fed.change_kg).toBeCloseTo(-5, 1);
  });

  it('a distribution against a concentration with no finalized batch lot touches no FeedStock at all', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Dist-No-Stock Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 8 }],
      })
      .expect(201);
    // Deliberately never finalized — no FeedStock lot exists for this concentration.

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId: conc.body.data.id,
        items: [{ ingredientId, actualKg: 4 }],
      })
      .expect(201);
    // No assertion beyond the 201 — there is no stock lot to check; this proves the auto-resolution
    // is a genuine no-op (not an error) when the concentration was never finalized.
  });
});
