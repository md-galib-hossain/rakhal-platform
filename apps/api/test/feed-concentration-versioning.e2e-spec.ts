import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — Phase 3 of the epic in
 * `C:\Users\mdgal\.claude\plans\composed-pondering-teapot.md` (2026-07-17, no ticket #):
 * concentrate-as-reusable-ingredient + versioning. `POST /feed/concentrations/:id/finalize`
 * promotes a concentration into a frozen `FeedIngredient` row; re-finalizing after an edit produces
 * a NEW row (the old one is never mutated) and flips `isLatestVersion` so only the newest version
 * appears in `GET /feed/ingredients`, while a TMR that already used v1 keeps resolving v1's exact
 * frozen nutrition.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration versioning + promotion (e2e)', () => {
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
        name: `E2E Versioning Base Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 20,
        dmPct: 90,
        cpPct: 15,
        meMjPerKgDm: 11,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects finalizing an empty concentration', async () => {
    const created = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Empty Concentration ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    // items:[] is only valid on PATCH (create requires a non-empty array) — emptying it here to
    // reach the finalize-rejection path.
    await request(server())
      .patch(api(`/feed/concentrations/${created.body.data.id}`))
      .set(...auth(owner))
      .send({ items: [] })
      .expect(200);

    await request(server())
      .post(api(`/feed/concentrations/${created.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(400);
  });

  it('finalize v1, use it as a TMR line item, finalize v2 — v1-referencing TMR stays frozen', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Versioned Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 20 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const v1 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    expect(v1.body.data.version).toBe(1);
    const v1IngredientId = v1.body.data.ingredient.id as string;
    // dmPct back-derived from totals: dm_kg = 20*0.9=18, totalAsFed=20 → dmPct=90
    expect(v1.body.data.ingredient.nutrition.dm_pct).toBeCloseTo(90, 1);
    expect(v1.body.data.ingredient.nutrition.cp_pct).toBeCloseTo(15, 1);

    // v1 appears in the farm's ingredient picker.
    const listAfterV1 = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (listAfterV1.body.data as Array<{ id: string }>).some(
        (i) => i.id === v1IngredientId,
      ),
    ).toBe(true);

    // Use v1 as a line item in a TMR.
    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E TMR Using v1 ${Date.now()}`,
        items: [{ ingredientId: v1IngredientId, amountKg: 10 }],
      })
      .expect(201);
    const tmrCpKgBefore = tmr.body.data.totals.cp_kg;

    // Edit the source concentration (change the amount) and finalize again → v2.
    await request(server())
      .patch(api(`/feed/concentrations/${concId}`))
      .set(...auth(owner))
      .send({ items: [{ ingredientId, amountKg: 40 }] })
      .expect(200);
    const v2 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    expect(v2.body.data.version).toBe(2);
    const v2IngredientId = v2.body.data.ingredient.id as string;
    expect(v2IngredientId).not.toBe(v1IngredientId);

    // v1 no longer appears in the picker; v2 does.
    const listAfterV2 = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const ids = (listAfterV2.body.data as Array<{ id: string }>).map(
      (i) => i.id,
    );
    expect(ids).not.toContain(v1IngredientId);
    expect(ids).toContain(v2IngredientId);

    // The TMR that already referenced v1 is untouched — re-fetching it resolves the same frozen totals.
    const tmrAfter = await request(server())
      .get(api(`/feed/concentrations/${tmr.body.data.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(tmrAfter.body.data.totals.cp_kg).toBeCloseTo(tmrCpKgBefore, 2);
  });
});
