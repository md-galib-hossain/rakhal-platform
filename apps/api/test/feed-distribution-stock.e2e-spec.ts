import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — Phase 4 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-17, no ticket #): a
 * `POST /feed/distributions` line can now name a specific `FeedStock` lot (`items[].stockId`) to
 * decrement via a real FK-backed, validated, transactional path (`FeedStockService.
 * decrementForDistribution`) instead of the existing best-effort `Forage` name-match. Covers the
 * happy path (decrement + audit movement), over-consumption (400, no partial state), and that a
 * line without `stockId` still falls back to the untouched loose Forage path.
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
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Dist-Stock Concentrate ${Date.now()}-${Math.random()}`,
        items: [{ ingredientId, amountKg }],
      })
      .expect(201);
    const finalized = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
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

  it('a line without stockId does not touch any FeedStock lot', async () => {
    const { concentrationId, stockId } = await produceStock(15);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId, items: [{ ingredientId, actualKg: 5 }] })
      .expect(201);

    const detail = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.current_stock_kg).toBeCloseTo(15, 1);
    expect(
      detail.body.data.movements.filter(
        (m: { reason: string }) => m.reason === 'FED',
      ),
    ).toHaveLength(0);
  });
});
