import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — Phase 12.1 (2026-07-18, no ticket #, plan `composed-pondering-teapot`):
 * live-sync editing. Renamed from `feed-concentration-versioning.e2e-spec.ts` — that file's whole
 * premise (re-finalizing produces a frozen, versioned row that a TMR keeps resolving even after the
 * source is edited) is now the **opposite** of correct behavior, per user request: editing a saved
 * Concentrate Mixer must live-propagate its updated nutrition/cost into every TMR that already uses
 * it, automatically, with no extra click. `POST /feed/concentrations/:id/finalize` now **upserts**
 * the promoted `FeedIngredient` by `sourceConcentrationId` (update in place if one exists) instead
 * of always creating a new version; a plain `PATCH` on an already-finalized template also refreshes
 * that same row. Finalizing a Concentrate Mixer never produces a `FeedStock` inventory batch —
 * only a Total Mixed Ration does — but RAKHAL-406 (2026-08-28) reverses the earlier "no inventory
 * at all" stance: it now also produces a real Inventory `FeedItem` batch/lot on every finalize
 * (a new row each time, unlike the ingredient upsert above).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration promotion + live-sync (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let ingredientId: string;
  let ingredientId2: string;

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
    // FeedStock stays reserved for FEED_MIXTURE — never produced for a Concentrate Mixer.
    expect(v1.body.data.stock).toBeNull();
    // RAKHAL-406: finalize also produces a real Inventory FeedItem batch, qty defaulting to
    // the formula's total as-fed kg (20kg of a single ingredient here).
    expect(v1.body.data.feed_item).not.toBeNull();
    expect(v1.body.data.feed_item.currentStock).toBeCloseTo(20, 2);
    expect(v1.body.data.feed_item.ingredientId).toBe(ingredientId1);

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

    // Explicit re-finalize: same ingredient id (upsert-in-place, not a new version). Still no
    // stock lot — re-finalizing a Concentrate Mixer any number of times never produces inventory.
    const v2 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    expect(v2.body.data.ingredient.id).toBe(ingredientId1);
    expect(v2.body.data.stock).toBeNull();
  });

  it('a plain PATCH on a template that has never been finalized creates no FeedIngredient', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Never-Finalized Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const before = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const countBefore = (before.body.data as Array<{ id: string }>).length;

    await request(server())
      .patch(api(`/feed/concentrations/${concId}`))
      .set(...auth(owner))
      .send({ items: [{ ingredientId, amountKg: 8 }] })
      .expect(200);

    const after = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    expect((after.body.data as Array<{ id: string }>).length).toBe(countBefore);
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

  it('RAKHAL-406: each finalize produces a new inventory FeedItem batch, listed under /inventory/feed-items; batchQuantityKg overrides the default', async () => {
    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Inventory-Batch Concentrate ${Date.now()}`,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);
    const concId = conc.body.data.id as string;

    const v1 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const feedItemId1 = v1.body.data.feed_item.id as string;
    expect(v1.body.data.feed_item.currentStock).toBeCloseTo(10, 2);

    const v2 = await request(server())
      .post(api(`/feed/concentrations/${concId}/finalize`))
      .set(...auth(owner))
      .send({ batchQuantityKg: 25 })
      .expect(201);
    const feedItemId2 = v2.body.data.feed_item.id as string;
    expect(feedItemId2).not.toBe(feedItemId1);
    expect(v2.body.data.feed_item.currentStock).toBeCloseTo(25, 2);
    // The same promoted ingredient is reused (upsert), unlike the FeedItem batch above.
    expect(v2.body.data.ingredient.id).toBe(v1.body.data.ingredient.id);
    // FeedStock still stays null for a Concentrate Mixer — additive, not a merge with FEED_MIXTURE.
    expect(v2.body.data.stock).toBeNull();

    const items = await request(server())
      .get(api('/inventory/feed-items'))
      .set(...auth(owner))
      .expect(200);
    const ids = (items.body.data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(feedItemId1);
    expect(ids).toContain(feedItemId2);
  });

  it('RAKHAL-406: finalizing a Total Mixed Ration (FEED_MIXTURE) never produces a FeedItem', async () => {
    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E FEED_MIXTURE No-FeedItem ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [{ ingredientId, amountKg: 10 }],
      })
      .expect(201);
    const tmrId = tmr.body.data.id as string;

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${tmrId}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH' })
      .expect(201);

    expect(finalized.body.data.feed_item).toBeNull();
    expect(finalized.body.data.ingredient).toBeNull();
    expect(finalized.body.data.stock).not.toBeNull();
  });
});
