import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — farm-scoped custom ingredient (user request 2026-07-17, no ticket #). A farm
 * can quick-add its own ingredient (name/category/cost only, no nutrition breakdown) via `POST
 * /feed/ingredients/custom` when one isn't in the Admin catalogue. Asserts the created row's shape,
 * that it appears in this farm's `GET /feed/ingredients`, that it's invisible to another farm, and
 * that it can be used as a real concentration line (contributing cost but zero nutrients).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — custom ingredient (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let neighbor: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    neighbor = await loginAs(
      ctx,
      'neighbor@demo.rakhal.test',
      'NeighborPass123',
    );
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a farm-scoped custom ingredient with the quick-add shape', async () => {
    const name = `E2E Custom Ingredient ${Date.now()}`;
    const res = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name, nutrientGroup: 'PROTEIN', pricePerKg: 42 })
      .expect(201);

    const ing = res.body.data;
    expect(ing.name_en).toBe(name);
    expect(ing.nutrient_group).toBe('PROTEIN');
    expect(ing.is_custom).toBe(true);
    expect(ing.effective_price_per_kg).toBe(42);
    // No known nutrition breakdown: dmPct defaults to 100 (whole weight = dry matter), every
    // other nutrient stays 0 — real gap, not a fabricated value (see the Prisma doc comment).
    expect(ing.nutrition.dm_pct).toBe(100);
    expect(ing.nutrition.cp_pct).toBe(0);
    expect(ing.nutrition.me_mj_per_kg_dm).toBe(0);
  });

  it("appears in this farm's ingredient list but not another farm's", async () => {
    const name = `E2E Isolation Ingredient ${Date.now()}`;
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name, nutrientGroup: 'ENERGY', pricePerKg: 10 })
      .expect(201);
    const id = created.body.data.id as string;

    const ownerList = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (ownerList.body.data as Array<{ id: string }>).some((i) => i.id === id),
    ).toBe(true);

    const neighborList = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(neighbor))
      .expect(200);
    expect(
      (neighborList.body.data as Array<{ id: string }>).some(
        (i) => i.id === id,
      ),
    ).toBe(false);
  });

  it('accepts a full nutrition profile and uses it exactly like a catalogue ingredient', async () => {
    const name = `E2E Full-Profile Ingredient ${Date.now()}`;
    const res = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name,
        nutrientGroup: 'ENERGY',
        pricePerKg: 30,
        dmPct: 87,
        cpPct: 9,
        meMjPerKgDm: 13.5,
        fatPct: 4.3,
        ndfPct: 9,
        starchPct: 65,
        adfPct: 3,
        calciumPct: 0.05,
        phosphorusPct: 0.28,
        tdnPct: 80,
      })
      .expect(201);

    const ing = res.body.data;
    expect(ing.nutrition.dm_pct).toBe(87);
    expect(ing.nutrition.cp_pct).toBe(9);
    expect(ing.nutrition.starch_pct).toBe(65);
    expect(ing.nutrition.tdn_pct).toBe(80);

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Full-Profile Formula ${Date.now()}`,
        items: [{ ingredientId: ing.id as string, amountKg: 10 }],
      })
      .expect(201);
    // dm_kg = 10 * 0.87 = 8.7; cp_kg = 8.7 * 0.09 = 0.783
    expect(conc.body.data.totals.dm_kg).toBeCloseTo(8.7, 1);
    expect(conc.body.data.totals.cp_kg).toBeCloseTo(0.783, 2);
  });

  it('rejects an incomplete quick-add (validation)', async () => {
    await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: '', nutrientGroup: 'FIBER', pricePerKg: 5 })
      .expect(400);
    // `nutrientGroup` is optional (user request 2026-07-17 — it was a display-only tag nothing in
    // the UI rendered), so a missing group is no longer invalid; `pricePerKg` still is.
    await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: 'Missing price' })
      .expect(400);
  });

  it('a custom ingredient contributes cost but zero nutrients to a formula', async () => {
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Formula Ingredient ${Date.now()}`,
        nutrientGroup: 'FIBER',
        pricePerKg: 8,
      })
      .expect(201);
    const ingredientId = created.body.data.id as string;

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Custom-Ingredient Formula ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);

    const detail = conc.body.data;
    expect(detail.totals.total_cost_tk).toBe(80); // 10kg * ৳8/kg
    expect(detail.totals.cp_kg).toBe(0);
    expect(detail.totals.me_mj).toBe(0);
    expect(detail.totals.dm_kg).toBe(10); // dmPct=100 → whole 10kg counts as DM
  });

  it('edits a custom ingredient — name, price, and nutrition profile', async () => {
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: `E2E Edit Me ${Date.now()}`, pricePerKg: 20 })
      .expect(201);
    const id = created.body.data.id as string;

    const updated = await request(server())
      .patch(api(`/feed/ingredients/custom/${id}`))
      .set(...auth(owner))
      .send({ name: 'E2E Edited Name', pricePerKg: 25, cpPct: 12 })
      .expect(200);

    expect(updated.body.data.name_en).toBe('E2E Edited Name');
    expect(updated.body.data.effective_price_per_kg).toBe(25);
    expect(updated.body.data.nutrition.cp_pct).toBe(12);
  });

  it('deletes (archives) a custom ingredient, removing it from the ingredient list', async () => {
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: `E2E Delete Me ${Date.now()}`, pricePerKg: 15 })
      .expect(201);
    const id = created.body.data.id as string;

    await request(server())
      .delete(api(`/feed/ingredients/custom/${id}`))
      .set(...auth(owner))
      .expect(200);

    const list = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).some((i) => i.id === id),
    ).toBe(false);
  });

  it('blocks deleting a custom ingredient still used by an active concentration', async () => {
    const created = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: `E2E In-Use Ingredient ${Date.now()}`, pricePerKg: 12 })
      .expect(201);
    const id = created.body.data.id as string;

    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E In-Use Formula ${Date.now()}`,
        items: [{ ingredientId: id, amountKg: 5 }],
      })
      .expect(201);

    await request(server())
      .delete(api(`/feed/ingredients/custom/${id}`))
      .set(...auth(owner))
      .expect(409);
  });

  it("rejects edit/delete on a catalogue ingredient (not farm-owned) and on another farm's ingredient", async () => {
    const catalogue = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const catalogueRow = (
      catalogue.body.data as Array<{ id: string; is_custom: boolean }>
    ).find((i) => !i.is_custom);
    expect(catalogueRow).toBeDefined();

    await request(server())
      .patch(api(`/feed/ingredients/custom/${catalogueRow!.id}`))
      .set(...auth(owner))
      .send({ pricePerKg: 999 })
      .expect(404);

    await request(server())
      .delete(api(`/feed/ingredients/custom/${catalogueRow!.id}`))
      .set(...auth(owner))
      .expect(404);

    const ownerOwned = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({ name: `E2E Owner-Only Ingredient ${Date.now()}`, pricePerKg: 7 })
      .expect(201);
    const ownerOwnedId = ownerOwned.body.data.id as string;

    await request(server())
      .patch(api(`/feed/ingredients/custom/${ownerOwnedId}`))
      .set(...auth(neighbor))
      .send({ pricePerKg: 999 })
      .expect(404);
  });
});
