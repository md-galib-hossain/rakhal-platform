import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';
import { concentrateDerivedIngredientId } from './utils/feed';

/**
 * Feed Formulator — Phase 12.1 (2026-07-18, no ticket #, plan `composed-pondering-teapot`):
 * live-sync editing. Renamed from `feed-concentration-versioning.e2e-spec.ts` — that file's whole
 * premise (re-finalizing produces a frozen, versioned row that a TMR keeps resolving even after the
 * source is edited) is now the **opposite** of correct behavior, per user request: editing a saved
 * Concentrate Mixer must live-propagate its updated nutrition/cost into every TMR that already uses
 * it, automatically, with no extra click. `POST /feed/concentrations/:id/finalize` now **upserts**
 * the promoted `FeedIngredient` by `sourceConcentrationId` (update in place if one exists) instead
 * of always creating a new version; a plain `PATCH` on an already-finalized template also refreshes
 * that same row. RAKHAL-421 (2026-09-13, closes RD-080): finalizing a Concentrate Mixer now also
 * produces a `FeedStock` batch (`kind: CONCENTRATE_TEMPLATE`) — the same table a Total Mixed
 * Ration's finalize produces (`kind: FEED_MIXTURE`), replacing RAKHAL-406 (2026-08-28)'s earlier
 * Inventory `FeedItem` batch, which put two incompatible "prepared feed" shapes in the database.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration promotion + live-sync (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  /** RD-077: RAKHAL-393 made this mandatory on a TMR finalize. */
  let financialAccountId: string;
  let ingredientId: string;
  let ingredientId2: string;
  /** RAKHAL-425: the one FEED_MIXTURE below needs a line using this. */
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
        name: `E2E Promotion Base Ingredient ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 20,
        dmPct: 90,
        cpPct: 15,
        meMjPerKgDm: 11,
      })
      .expect(201);
    ingredientId = created.body.data.id as string;

    // A second, deliberately different-composition ingredient — used to prove live-sync actually
    // recomputes the promoted ingredient's %-nutrition on a composition change, not just its kg
    // totals. Scaling a *single*-ingredient formula linearly (e.g. 20kg → 40kg of the same thing)
    // would keep every %-based rate identical, which wouldn't actually exercise the sync logic.
    const created2 = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Promotion Second Ingredient ${Date.now()}`,
        nutrientGroup: 'PROTEIN',
        pricePerKg: 35,
        dmPct: 88,
        cpPct: 40,
        meMjPerKgDm: 12,
      })
      .expect(201);
    ingredientId2 = created2.body.data.id as string;
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
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

  it('finalize once, edit + plain PATCH (no re-finalize), TMR reflects new values with the same ingredient id', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Live-Sync Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 20 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const v1 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const ingredientId1 = v1.body.data.ingredient.id as string;
    // dmPct back-derived from totals: dm_kg = 20*0.9=18, totalAsFed=20 → dmPct=90
    expect(v1.body.data.ingredient.nutrition.dm_pct).toBeCloseTo(90, 1);
    expect(v1.body.data.ingredient.nutrition.cp_pct).toBeCloseTo(15, 1);
    // RAKHAL-421: finalize also produces a FeedStock batch, qty defaulting to the formula's
    // total as-fed kg (20kg of a single ingredient here).
    expect(v1.body.data.stock).not.toBeNull();
    expect(v1.body.data.stock.kind).toBe('CONCENTRATE_TEMPLATE');
    expect(v1.body.data.stock.current_stock_kg).toBeCloseTo(20, 2);

    // Use it as a line item in a TMR.
    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E TMR Using Concentrate ${Date.now()}`,
        items: [{ ingredientId: ingredientId1, amountKg: 10 }],
      })
      .expect(201);
    const tmrCpKgBefore = tmr.body.data.totals.cp_kg;

    // Edit the source concentration's composition (add the second, higher-CP ingredient) via a
    // plain PATCH — no re-finalize. This changes the %-based nutrition, not just the kg total.
    await request(server())
      .patch(api(`/feed/concentrations/${concId}`))
      .set(...auth(owner))
      .send({
        items: [
          { ingredientId, amountKg: 20 },
          { ingredientId: ingredientId2, amountKg: 20 },
        ],
      })
      .expect(200);

    // Ingredient count unchanged in the picker (still exactly one row for this concentration).
    const listAfterPatch = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const idsAfterPatch = (
      listAfterPatch.body.data as Array<{ id: string }>
    ).map((i) => i.id);
    expect(idsAfterPatch).toContain(ingredientId1);

    // Re-fetching the TMR resolves the NEW values (live join) — the whole point of live-sync.
    const tmrAfterPatch = await request(server())
      .get(api(`/feed/concentrations/${tmr.body.data.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(tmrAfterPatch.body.data.totals.cp_kg).not.toBeCloseTo(
      tmrCpKgBefore,
      2,
    );

    // Explicit re-finalize: same ingredient id (upsert-in-place, not a new version). Produces a
    // fresh FeedStock batch each time — the physical-lot half is never idempotent.
    const v2 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    expect(v2.body.data.ingredient.id).toBe(ingredientId1);
    expect(v2.body.data.stock).not.toBeNull();
    expect(v2.body.data.stock.id).not.toBe(v1.body.data.stock.id);
  });

  it('a plain PATCH on a template that has never been finalized creates no FeedIngredient', async () => {
    // RD-077: asserted on the farm's *total* ingredient count before/after, so any spec running
    // in a parallel worker that created an ingredient in between failed it (seen as 943 vs 941).
    // Promotion names the ingredient after its template, so looking for that specific name proves
    // the same thing — no ingredient was promoted — without depending on a global count.
    const name = `E2E Never-Finalized Concentrate ${Date.now()}`;
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    await request(server())
      .patch(api(`/feed/concentrations/${concId}`))
      .set(...auth(owner))
      .send({ items: [{ ingredientId, amountKg: 8 }] })
      .expect(200);

    const after = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const promoted = (after.body.data as Array<{ name_en: string }>).filter(
      (i) => i.name_en === name,
    );
    expect(promoted).toHaveLength(0);
  });

  it('deleting a finalized concentration also archives its promoted ingredient (single delete)', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Delete-Cascade Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 15 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const promotedIngredientId = finalized.body.data.ingredient.id as string;

    // Promoted ingredient is visible in the picker before delete.
    const before = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (before.body.data as Array<{ id: string }>).some(
        (i) => i.id === promotedIngredientId,
      ),
    ).toBe(true);

    await request(server())
      .delete(api(`/feed/concentrations/${concId}`))
      .set(...auth(owner))
      .expect(200);

    // Ghost ingredient must not survive the source concentration's deletion.
    const after = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (after.body.data as Array<{ id: string }>).some(
        (i) => i.id === promotedIngredientId,
      ),
    ).toBe(false);
  });

  it('bulk-deleting finalized concentrations also archives their promoted ingredients', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Bulk-Delete-Cascade Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 12 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const promotedIngredientId = finalized.body.data.ingredient.id as string;

    await request(server())
      .post(api('/feed/concentrations/bulk-delete'))
      .set(...auth(owner))
      .send({ ids: [concId] })
      .expect(201);

    const after = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (after.body.data as Array<{ id: string }>).some(
        (i) => i.id === promotedIngredientId,
      ),
    ).toBe(false);
  });

  it('RAKHAL-421: each finalize produces a new FeedStock batch, listed under /feed/stock; batchQuantityKg overrides the default', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Stock-Batch Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const v1 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const stockId1 = v1.body.data.stock.id as string;
    expect(v1.body.data.stock.kind).toBe('CONCENTRATE_TEMPLATE');
    expect(v1.body.data.stock.current_stock_kg).toBeCloseTo(10, 2);

    const v2 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .send({ batchQuantityKg: 25 })
      .expect(201);
    const stockId2 = v2.body.data.stock.id as string;
    expect(stockId2).not.toBe(stockId1);
    expect(v2.body.data.stock.current_stock_kg).toBeCloseTo(25, 2);
    // batchQuantityKg scales the produced quantity, not the recipe's cost — producedCostTk is
    // always the recipe's own total_cost_tk regardless of how much was produced.
    expect(v2.body.data.stock.produced_cost_tk).toBe(
      v1.body.data.stock.produced_cost_tk,
    );
    // The same promoted ingredient is reused (upsert), unlike the FeedStock batch above.
    expect(v2.body.data.ingredient.id).toBe(v1.body.data.ingredient.id);

    const stockList = await request(server())
      .get(api('/feed/stock'))
      .set(...auth(owner))
      .expect(200);
    const ids = (stockList.body.data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(stockId1);
    expect(ids).toContain(stockId2);
  });

  it('RAKHAL-421: a Total Mixed Ration (FEED_MIXTURE) finalize produces stock with no ingredient promotion', async () => {
    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E FEED_MIXTURE Stock-Kind ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [
          { ingredientId, amountKg: 10 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    const tmrId = tmr.body.data.id as string;

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${tmrId}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);

    expect(finalized.body.data.ingredient).toBeNull();
    expect(finalized.body.data.stock).not.toBeNull();
    expect(finalized.body.data.stock.kind).toBe('FEED_MIXTURE');
  });
});
