import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';
import { concentrateDerivedIngredientId } from './utils/feed';

/**
 * Feed Formulator — Phase 4 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-17, no ticket #): TMR ↔
 * Inventory real linkage. Finalizing a Total Mixed Ration (`POST /feed/concentrations/:id/finalize`
 * on a `FEED_MIXTURE`) produces a `FeedStock` lot (`FeedStockService.produceFromConcentration`) —
 * this spec covers the stock side (production, listing, a second finalize producing a separate
 * lot); the distribution-decrement side is covered by `feed-distribution-stock.e2e-spec.ts`. A
 * Concentrate Mixer (`CONCENTRATE_TEMPLATE`) never produces stock (2026-07-19 correction — it's a
 * virtual recipe/calculator, see `feed-concentration-kind.e2e-spec.ts`/
 * `feed-concentration-promotion.e2e-spec.ts` for that side).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — feed stock production (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  /** RD-077: RAKHAL-393 made this mandatory on a TMR finalize. */
  let financialAccountId: string;
  let worker: AuthedUser;
  let ingredientId: string;
  /** RAKHAL-425: every TMR below needs one line using this. */
  let concentrateIngredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function produceMixtureStock(amountKg: number) {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Stock Delete Mixture ${Date.now()}-${Math.random()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [
          { ingredientId, amountKg },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    const finalized = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);
    return finalized.body.data.stock.id as string;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    financialAccountId = await seededCashAccountId(ctx, owner);
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Stock Base Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 10,
        dmPct: 90,
        cpPct: 12,
        meMjPerKgDm: 10,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('finalizing a Total Mixed Ration produces a FeedStock lot matching the batch size and cost', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Stock Mixture ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 30 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);
    const stockId = finalized.body.data.stock.id as string;
    // 30kg @ ৳10/kg = ৳300 total cost; batch qty = 30kg (as-fed).
    expect(finalized.body.data.stock.produced_qty_kg).toBeCloseTo(30, 1);
    expect(finalized.body.data.stock.current_stock_kg).toBeCloseTo(30, 1);
    expect(finalized.body.data.stock.produced_cost_tk).toBeCloseTo(300, 1);
    expect(finalized.body.data.stock.source_concentration_version).toBe(1);

    const detail = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.movements).toHaveLength(1);
    expect(detail.body.data.movements[0].reason).toBe('PRODUCED');
    expect(detail.body.data.movements[0].change_kg).toBeCloseTo(30, 1);

    const list = await request(server())
      .get(api('/feed/stock'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).some((s) => s.id === stockId),
    ).toBe(true);
  });

  it('re-finalizing after an edit produces a separate stock lot, not a mutation of the first', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Stock Re-finalize ${Date.now()}`,
        targetType: 'INDIVIDUAL',
        targetWeightKg: 400,
        targetMilkL: 15,
        durationDays: 30,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const v1 = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);
    const v1StockId = v1.body.data.stock.id as string;
    expect(v1.body.data.stock.produced_qty_kg).toBeCloseTo(10, 1);

    await request(server())
      .patch(api(`/feed/concentrations/${conc.body.data.id}`))
      .set(...auth(owner))
      .send({
        items: [
          { ingredientId, amountKg: 25 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(200);

    const v2 = await request(server())
      .post(api(`/feed/concentrations/${conc.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);
    const v2StockId = v2.body.data.stock.id as string;
    expect(v2StockId).not.toBe(v1StockId);
    expect(v2.body.data.stock.produced_qty_kg).toBeCloseTo(25, 1);

    // v1's lot is untouched.
    const v1Detail = await request(server())
      .get(api(`/feed/stock/${v1StockId}`))
      .set(...auth(owner))
      .expect(200);
    expect(v1Detail.body.data.current_stock_kg).toBeCloseTo(10, 1);
  });

  describe('delete from inventory (user request 2026-07-19 — "form inventory it can be also deleted")', () => {
    it('DELETE removes a lot from the default list (soft-delete)', async () => {
      const stockId = await produceMixtureStock(12);

      await request(server())
        .delete(api(`/feed/stock/${stockId}`))
        .set(...auth(owner))
        .expect(200);

      const list = await request(server())
        .get(api('/feed/stock'))
        .set(...auth(owner))
        .expect(200);
      expect(
        (list.body.data as Array<{ id: string }>).some((s) => s.id === stockId),
      ).toBe(false);

      // Detail/history stays reachable even once archived — same convention as every other
      // soft-deleted inventory model (the record isn't destroyed, just hidden from the list).
      const detail = await request(server())
        .get(api(`/feed/stock/${stockId}`))
        .set(...auth(owner))
        .expect(200);
      expect(detail.body.data.id).toBe(stockId);
    });

    it('a deleted lot can no longer be fed from', async () => {
      const stockId = await produceMixtureStock(10);
      await request(server())
        .delete(api(`/feed/stock/${stockId}`))
        .set(...auth(owner))
        .expect(200);

      const secondIngredient = await request(server())
        .post(api('/feed/ingredients/custom'))
        .set(...auth(owner))
        .send({
          name: `E2E Deleted-Lot Feed Attempt ${Date.now()}`,
          pricePerKg: 5,
        })
        .expect(201);
      const conc = await request(server())
        .post(api('/feed/concentrations'))
        .set(...auth(owner))
        .send({
          kind: 'CONCENTRATE_TEMPLATE',
          name: `E2E Deleted-Lot Concentration ${Date.now()}`,
          items: [{ ingredientId: secondIngredient.body.data.id, amountKg: 5 }],
        })
        .expect(201);

      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({
          concentrationId: conc.body.data.id,
          items: [
            {
              ingredientId: secondIngredient.body.data.id,
              actualKg: 2,
              stockId,
            },
          ],
        })
        .expect(404);
    });

    it('403s a worker deleting a stock lot (feed.delete is manager+)', async () => {
      const stockId = await produceMixtureStock(8);
      await request(server())
        .delete(api(`/feed/stock/${stockId}`))
        .set(...auth(worker))
        .expect(403);
    });
  });
});
