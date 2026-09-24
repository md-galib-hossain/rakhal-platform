import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { concentrateDerivedIngredientId, stockIngredient } from './utils/feed';

/**
 * RAKHAL-423 (batch deduction on finalize) as reshaped by the 2026-09-24 rule "a recipe can be
 * built from anything but only finalized from inventory the farm already owns": finalize deducts
 * every line's stock (a linked batch, or the farm's feed item / prepared batch for that ingredient)
 * before producing the new lot, prices the lot from those batches' **real** costs, and never buys
 * anything — so it needs no wallet and posts no journal. A line the farm doesn't stock blocks the
 * finalize (400, naming it) and `GET …/inventory-check` lists it. Also covered: insufficient stock
 * blocks with no partial state; self-consumption is rejected; a Concentrate Mixer with a linked
 * line deducts exactly like a TMR does.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — batch deduction + inventory gate on finalize (e2e, RAKHAL-423)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  /** RAKHAL-425: every TMR below needs one line using this. */
  let concentrateIngredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createIngredient = async (name: string, pricePerKg: number) => {
    const res = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `${name} ${Date.now()}-${Math.random()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg,
        dmPct: 90,
        cpPct: 10,
        meMjPerKgDm: 9,
      })
      .expect(201);
    return res.body.data.id as string;
  };

  const createFeedItem = async (
    ingredientId: string,
    stock: number,
    costPerUnit: number,
  ) => {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Deduction Feed Item ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: stock,
        costPerUnit,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    return res.body.data.id as string;
  };

  const getFeedItemStock = async (feedItemId: string) => {
    const res = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    return res.body.data.currentStock as number;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('an all-stocked TMR deducts the batch, prices from its real cost, and posts no journal entry', async () => {
    const ingredient = await createIngredient('E2E All-Linked Ingredient', 999);
    const feedItemId = await createFeedItem(ingredient, 50, 12);

    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E All-Linked TMR ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [
          { ingredientId: ingredient, amountKg: 5, feedItemId },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${tmr.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);

    expect(finalized.body.data.finance).toBeNull();
    // Real batch cost (5kg * 12/kg = 60), never the catalogue's deliberately-wrong 999/kg.
    expect(finalized.body.data.stock.produced_cost_tk).toBe(60);
    expect(await getFeedItemStock(feedItemId)).toBeCloseTo(45, 2);
  });

  it('blocks finalize on a line the farm does not stock — naming it — until it is in inventory, then prices every line from its real batch', async () => {
    const linkedIngredient = await createIngredient(
      'E2E Mixed Linked Ingredient',
      999, // deliberately wrong catalogue price — proves the real batch cost wins
    );
    const missingIngredient = await createIngredient(
      'E2E Mixed Unstocked Ingredient',
      8,
    );
    const feedItemId = await createFeedItem(linkedIngredient, 50, 12);

    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Mixed TMR ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [
          { ingredientId: linkedIngredient, amountKg: 5, feedItemId },
          { ingredientId: missingIngredient, amountKg: 3 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);
    const tmrId = tmr.body.data.id as string;

    // The check names exactly the unstocked line and says the recipe can't be finalized yet.
    const check = await request(server())
      .get(api(`/feed/concentrations/${tmrId}/inventory-check`))
      .set(...auth(owner))
      .expect(200);
    expect(check.body.data.can_finalize).toBe(false);
    expect(check.body.data.missing).toHaveLength(1);
    expect(check.body.data.missing[0].ingredient_id).toBe(missingIngredient);
    expect(check.body.data.missing[0].amount_kg).toBe(3);

    // Finalize is refused with the same list — and nothing is deducted or produced.
    const blocked = await request(server())
      .post(api(`/feed/concentrations/${tmrId}/finalize`))
      .set(...auth(owner));
    expect(blocked.status).toBe(400);
    expect((blocked.body as { message?: string }).message).toContain(
      'Not in inventory yet',
    );
    expect(await getFeedItemStock(feedItemId)).toBe(50);
    expect(
      await prisma.feedStock.count({ where: { sourceConcentrationId: tmrId } }),
    ).toBe(0);

    // Once the ingredient is in inventory the same recipe finalizes, no wallet involved.
    await stockIngredient(ctx, owner, missingIngredient, {
      qtyKg: 100,
      costPerKg: 8,
    });
    const finalized = await request(server())
      .post(api(`/feed/concentrations/${tmrId}/finalize`))
      .set(...auth(owner))
      .expect(201);

    // linked: 5kg * 12/kg = 60 ; matched-from-inventory: 3kg * 8/kg = 24 ; total = 84.
    expect(finalized.body.data.stock.produced_cost_tk).toBe(84);
    expect(finalized.body.data.finance).toBeNull();
    expect(await getFeedItemStock(feedItemId)).toBeCloseTo(45, 2);
  });

  it('blocks with a named shortfall on insufficient linked stock, producing no batch', async () => {
    const ingredient = await createIngredient('E2E Shortfall Ingredient', 5);
    const feedItemId = await createFeedItem(ingredient, 2, 10);

    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Shortfall TMR ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [
          { ingredientId: ingredient, amountKg: 10, feedItemId },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    // The check surfaces the shortfall up front too.
    const check = await request(server())
      .get(api(`/feed/concentrations/${tmr.body.data.id}/inventory-check`))
      .set(...auth(owner))
      .expect(200);
    expect(check.body.data.can_finalize).toBe(false);
    expect(check.body.data.shortfalls).toHaveLength(1);
    expect(check.body.data.shortfalls[0].needed_kg).toBe(10);
    expect(check.body.data.shortfalls[0].available_kg).toBe(2);

    const res = await request(server())
      .post(api(`/feed/concentrations/${tmr.body.data.id}/finalize`))
      .set(...auth(owner));
    expect(res.status).toBe(400);

    expect(await getFeedItemStock(feedItemId)).toBe(2);
    const stockCount = await prisma.feedStock.count({
      where: { sourceConcentrationId: tmr.body.data.id },
    });
    expect(stockCount).toBe(0);
  });

  it('rejects a line linking a FeedStock this same concentration itself produced', async () => {
    const ingredient = await createIngredient(
      'E2E Self-Consumption Ingredient',
      10,
    );
    await stockIngredient(ctx, owner, ingredient, { costPerKg: 10 });

    const template = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Self-Consumption Template ${Date.now()}`,
        items: [{ ingredientId: ingredient, amountKg: 10 }],
      })
      .expect(201);
    const templateId = template.body.data.id as string;

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${templateId}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const promotedIngredientId = finalized.body.data.ingredient.id as string;
    const stockId = finalized.body.data.stock.id as string;

    await request(server())
      .patch(api(`/feed/concentrations/${templateId}`))
      .set(...auth(owner))
      .send({
        items: [
          {
            ingredientId: promotedIngredientId,
            amountKg: 2,
            feedStockId: stockId,
          },
        ],
      })
      .expect(200);

    const res = await request(server())
      .post(api(`/feed/concentrations/${templateId}/finalize`))
      .set(...auth(owner));
    expect(res.status).toBe(400);
  });

  it('a Concentrate Mixer with a linked FeedStock line deducts it exactly, same as a TMR', async () => {
    const sourceIngredient = await createIngredient(
      'E2E Cross-Template Source Ingredient',
      10,
    );
    await stockIngredient(ctx, owner, sourceIngredient, { costPerKg: 10 });
    const source = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Cross-Template Source ${Date.now()}`,
        items: [{ ingredientId: sourceIngredient, amountKg: 20 }],
      })
      .expect(201);
    const sourceFinalized = await request(server())
      .post(api(`/feed/concentrations/${source.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const sourcePromotedIngredientId = sourceFinalized.body.data.ingredient
      .id as string;
    const sourceStockId = sourceFinalized.body.data.stock.id as string;
    expect(sourceFinalized.body.data.stock.current_stock_kg).toBe(20);

    const consumer = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Cross-Template Consumer ${Date.now()}`,
        items: [
          {
            ingredientId: sourcePromotedIngredientId,
            amountKg: 7,
            feedStockId: sourceStockId,
          },
        ],
      })
      .expect(201);

    await request(server())
      .post(api(`/feed/concentrations/${consumer.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);

    const sourceAfter = await request(server())
      .get(api(`/feed/stock`))
      .set(...auth(owner))
      .expect(200);
    const sourceRow = (
      sourceAfter.body.data as Array<{ id: string; current_stock_kg: number }>
    ).find((s) => s.id === sourceStockId);
    expect(sourceRow?.current_stock_kg).toBe(13);
  });

  it('a Concentrate Mixer with an unstocked ingredient is blocked (naming it), then finalizes at the real batch cost with no journal', async () => {
    const ingredient = await createIngredient('E2E RD-090 Ingredient', 10);

    const template = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E RD-090 Template ${Date.now()}`,
        items: [{ ingredientId: ingredient, amountKg: 4 }],
      })
      .expect(201);

    const blocked = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner));
    expect(blocked.status).toBe(400);
    expect((blocked.body as { message?: string }).message).toContain(
      'Not in inventory yet',
    );
    expect(
      await prisma.feedStock.count({
        where: { sourceConcentrationId: template.body.data.id },
      }),
    ).toBe(0);

    // The farm buys it (here at ৳7/kg — not the catalogue's ৳10), and finalize now goes through.
    await stockIngredient(ctx, owner, ingredient, { costPerKg: 7 });
    const finalized = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);

    // 4kg * 7/kg real batch cost; no payment, no journal.
    expect(finalized.body.data.stock.produced_cost_tk).toBe(28);
    expect(finalized.body.data.finance).toBeNull();
  });

  it('an all-linked Concentrate Mixer (prepared batch + feed item) finalizes with no wallet and no journal', async () => {
    const sourceIngredient = await createIngredient(
      'E2E RD-090 All-Linked Source Ingredient',
      10,
    );
    await stockIngredient(ctx, owner, sourceIngredient, { costPerKg: 10 });
    const source = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E RD-090 All-Linked Source ${Date.now()}`,
        items: [{ ingredientId: sourceIngredient, amountKg: 10 }],
      })
      .expect(201);
    const sourceFinalized = await request(server())
      .post(api(`/feed/concentrations/${source.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const sourcePromotedIngredientId = sourceFinalized.body.data.ingredient
      .id as string;
    const sourceStockId = sourceFinalized.body.data.stock.id as string;

    const feedItem = await createIngredient(
      'E2E RD-090 All-Linked FeedItem Ingredient',
      999, // deliberately wrong catalogue price — proves the real batch cost wins
    );
    const feedItemId = await createFeedItem(feedItem, 20, 6);

    const consumer = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E RD-090 All-Linked Consumer ${Date.now()}`,
        items: [
          {
            ingredientId: sourcePromotedIngredientId,
            amountKg: 3,
            feedStockId: sourceStockId,
          },
          { ingredientId: feedItem, amountKg: 2, feedItemId },
        ],
      })
      .expect(201);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${consumer.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);

    expect(finalized.body.data.finance).toBeNull();
  });

  it('a TMR line for a promoted concentrate ingredient resolves to that concentrate’s prepared batch (no link needed) and is flagged prepared when none is in stock', async () => {
    const baseIngredient = await createIngredient('E2E Prepared Base', 10);
    await stockIngredient(ctx, owner, baseIngredient, { costPerKg: 10 });
    const source = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Prepared Source ${Date.now()}`,
        items: [{ ingredientId: baseIngredient, amountKg: 10 }],
      })
      .expect(201);
    const sourceFinalized = await request(server())
      .post(api(`/feed/concentrations/${source.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const promotedId = sourceFinalized.body.data.ingredient.id as string;
    const stockId = sourceFinalized.body.data.stock.id as string;

    const tmr = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E Prepared TMR ${Date.now()}`,
        durationDays: 1,
        targetWeightKg: 450,
        targetMilkL: 15,
        items: [{ ingredientId: promotedId, amountKg: 4 }],
      })
      .expect(201);

    const ok = await request(server())
      .get(api(`/feed/concentrations/${tmr.body.data.id}/inventory-check`))
      .set(...auth(owner))
      .expect(200);
    expect(ok.body.data.can_finalize).toBe(true);
    expect(ok.body.data.lines[0].feed_stock_id).toBe(stockId);

    // Remove that prepared batch (soft-delete) → the line is missing, and flagged as prepared feed
    // (the UI points at finalizing the concentrate instead of the feed-item form).
    await request(server())
      .delete(api(`/feed/stock/${stockId}`))
      .set(...auth(owner))
      .expect(200);
    const gone = await request(server())
      .get(api(`/feed/concentrations/${tmr.body.data.id}/inventory-check`))
      .set(...auth(owner))
      .expect(200);
    expect(gone.body.data.can_finalize).toBe(false);
    expect(gone.body.data.missing[0].is_prepared_feed).toBe(true);
  });
});
