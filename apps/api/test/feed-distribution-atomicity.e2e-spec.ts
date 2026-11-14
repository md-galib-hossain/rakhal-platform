import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';
import { concentrateDerivedIngredientId, stockIngredient } from './utils/feed';

/**
 * Feed distribution ↔ stock atomicity (RD-036).
 *
 * The decrement used to run *after* the distribution's transaction committed, in a transaction of
 * its own, and it computed the new balance by reading `currentStockKg` and subtracting in
 * JavaScript. Two failure modes fell out of that:
 *
 * - **Lost update.** Two concurrent distributions both read 20, both wrote 20-12, and 24 kg left
 *   the yard having decremented 12.
 * - **Split commit.** If the decrement failed, the distribution row was already committed, leaving
 *   feed logged against stock that never moved.
 *
 * Both are now closed: the decrement is a conditional `updateMany` guarded on
 * `currentStockKg >= quantity`, and it runs inside the distribution's own transaction.
 *
 * These tests are deliberately written against observable API behaviour (final stock balance,
 * status codes, whether a distribution row exists) rather than by reaching into the service, so
 * they would still catch a regression that reintroduced the race by a different route.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed distribution ↔ stock atomicity (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let ingredientId: string;
  let financialAccountId: string;
  /** RAKHAL-425: every TMR below needs one line using this. */
  let concentrateIngredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    financialAccountId = await seededCashAccountId(ctx, owner);

    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Atomicity Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 8,
        dmPct: 90,
        cpPct: 10,
        meMjPerKgDm: 9,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
    // Finalize consumes inventory (no wallet, no buying) — stock the base ingredient at its price.
    await stockIngredient(ctx, owner, ingredientId, { costPerKg: 8 });
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A stock lot only ever comes from finalizing a Total Mixed Ration. */
  async function produceStock(amountKg: number) {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Atomicity Mixture ${Date.now()}-${Math.random()}`,
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
    return {
      concentrationId: conc.body.data.id as string,
      stockId: finalized.body.data.stock.id as string,
    };
  }

  async function stockKg(stockId: string): Promise<number> {
    const res = await request(server())
      .get(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data.current_stock_kg as number;
  }

  function logDistribution(
    concentrationId: string,
    actualKg: number,
    stockId: string,
  ) {
    return request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId, items: [{ ingredientId, actualKg, stockId }] });
  }

  it('never lets two concurrent distributions over-draw one lot', async () => {
    // 20 kg in the lot, two simultaneous requests for 12 kg. Exactly one can win.
    const { concentrationId, stockId } = await produceStock(20);

    const [a, b] = await Promise.all([
      logDistribution(concentrationId, 12, stockId),
      logDistribution(concentrationId, 12, stockId),
    ]);

    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 400]);

    // The decisive assertion: 8 kg left, not -4. Under the old read-then-write both requests
    // could succeed and the lot would go negative.
    expect(await stockKg(stockId)).toBe(8);
  });

  it('leaves the lot untouched and logs nothing when the requested amount exceeds it', async () => {
    const { concentrationId, stockId } = await produceStock(10);

    await logDistribution(concentrationId, 25, stockId).expect(400);

    expect(await stockKg(stockId)).toBe(10);

    // Split-commit proof: a rejected decrement must not leave a distribution row behind.
    const list = await request(server())
      .get(api('/feed/distributions'))
      .set(...auth(owner))
      .query({ concentrationId })
      .expect(200);
    const rows = (list.body.data.items ?? list.body.data) as { id: string }[];
    expect(rows).toHaveLength(0);
  });

  it('still decrements correctly for a normal sequential distribution', async () => {
    const { concentrationId, stockId } = await produceStock(20);

    await logDistribution(concentrationId, 5, stockId).expect(201);
    expect(await stockKg(stockId)).toBe(15);

    await logDistribution(concentrationId, 5, stockId).expect(201);
    expect(await stockKg(stockId)).toBe(10);
  });

  it('keeps the balance at 2dp rather than accumulating float noise', async () => {
    const { concentrationId, stockId } = await produceStock(10);

    await logDistribution(concentrationId, 0.1, stockId).expect(201);
    await logDistribution(concentrationId, 0.2, stockId).expect(201);

    // 10 - 0.1 - 0.2 is 9.699999999999999 in float; the service rounds each write to 2dp.
    expect(await stockKg(stockId)).toBe(9.7);
  });
});
