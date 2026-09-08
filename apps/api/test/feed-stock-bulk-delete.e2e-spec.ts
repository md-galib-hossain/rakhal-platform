import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * `POST /feed/stock/bulk-delete` — the backend half of the shared bulk-select/bulk-delete "dock"
 * pilot (2026-07-21, no ticket #). Same contract as `medicine-bulk-delete.e2e-spec.ts`, gated on
 * `feed.delete` (Feed Stock lives in the `feed` module's permission namespace despite its
 * Inventory-tab UI placement — see `feed-stock.e2e-spec.ts`'s single-delete tests).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed stock (Prepared) bulk-delete (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  /** RD-077: RAKHAL-393 made this mandatory on a TMR finalize. */
  let financialAccountId: string;
  let worker: AuthedUser;
  let ingredientId: string;

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
        name: `E2E Bulk Stock Mixture ${Date.now()}-${Math.random()}`,
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
        name: `E2E Bulk Stock Base Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 10,
        dmPct: 90,
        cpPct: 12,
        meMjPerKgDm: 10,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('deletes every requested id belonging to the farm and returns the count', async () => {
    const idA = await produceMixtureStock(10);
    const idB = await produceMixtureStock(15);

    const res = await request(server())
      .post(api('/feed/stock/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [idA, idB] })
      .expect(201);
    expect(res.body.data.deleted).toBe(2);

    const list = await request(server())
      .get(api('/feed/stock'))
      .set(...auth(owner))
      .expect(200);
    const ids = (list.body.data as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(idA);
    expect(ids).not.toContain(idB);
  });

  it('silently ignores an unknown id mixed into an otherwise-valid batch', async () => {
    const idA = await produceMixtureStock(8);

    const res = await request(server())
      .post(api('/feed/stock/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [idA, 'not-a-real-id'] })
      .expect(201);
    expect(res.body.data.deleted).toBe(1);
  });

  it('403s a worker (feed.delete is manager+)', async () => {
    const idA = await produceMixtureStock(6);

    await request(server())
      .post(api('/feed/stock/bulk-delete'))
      .set(...auth(worker))
      .send({ ids: [idA] })
      .expect(403);
  });
});
