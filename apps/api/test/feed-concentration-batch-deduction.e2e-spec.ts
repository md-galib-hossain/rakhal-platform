import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';
import { concentrateDerivedIngredientId } from './utils/feed';

/**
 * RAKHAL-423 + RAKHAL-424 (shipped together per docs/EPIC_PREPARED_FEED.md §5 — 424 alone would
 * double-count the expense): a finalize now deducts every batch-linked line (RAKHAL-422's link)
 * before producing the new lot, and the finance journal splits into an inventory-transfer portion
 * (linked, already owned/paid for) and a purchase portion (unlinked, still priced from the
 * catalogue). Covers: all-linked TMR needs no `financialAccountId` and posts no journal; a mixed
 * TMR credits only the unlinked portion and `producedCostTk` reflects the real batch cost, not the
 * catalogue price; insufficient linked stock blocks with no partial state; self-consumption is
 * rejected; a Concentrate Mixer with a linked line deducts exactly like a TMR does.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — batch-link deduction + finance split on finalize (e2e, RAKHAL-423/424)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let financialAccountId: string;
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
    financialAccountId = await seededCashAccountId(ctx, owner);
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('an all-linked TMR needs no financialAccountId, deducts the batch, and posts no journal entry', async () => {
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
      // No financialAccountId — must not be required when nothing is purchased.
      .expect(201);

    expect(finalized.body.data.finance).toBeNull();
    // Real batch cost (5kg * 12/kg = 60), never the catalogue's deliberately-wrong 999/kg.
    expect(finalized.body.data.stock.produced_cost_tk).toBe(60);
    expect(await getFeedItemStock(feedItemId)).toBeCloseTo(45, 2);
  });

  it('a mixed TMR credits only the unlinked portion and prices the linked portion from the real batch cost', async () => {
    const linkedIngredient = await createIngredient(
      'E2E Mixed Linked Ingredient',
      999, // deliberately wrong catalogue price — proves the real batch cost wins
    );
    const unlinkedIngredient = await createIngredient(
      'E2E Mixed Unlinked Ingredient',
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
          { ingredientId: unlinkedIngredient, amountKg: 3 },
          { ingredientId: concentrateIngredientId, amountKg: 0 },
        ],
      })
      .expect(201);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${tmr.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId })
      .expect(201);

    // linked: 5kg * 12/kg = 60 (real cost) ; unlinked: 3kg * 8/kg = 24 (catalogue) ; total = 84.
    expect(finalized.body.data.stock.produced_cost_tk).toBe(84);
    expect(finalized.body.data.finance).not.toBeNull();
    expect(await getFeedItemStock(feedItemId)).toBeCloseTo(45, 2);

    const journalTransactionId = finalized.body.data.finance
      .journal_transaction_id as string;
    const entries = await prisma.journalEntry.findMany({
      where: { journalTransactionId },
    });
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);
    const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
    // Only the unlinked portion (24) is a real purchase — not the full 84.
    expect(totalCredit).toBe(24);
    expect(totalDebit).toBe(24);
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

    const res = await request(server())
      .post(api(`/feed/concentrations/${tmr.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ paymentMethod: 'CASH', financialAccountId });
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
      // RAKHAL-428: 10kg @ 10/kg unlinked cost now requires a financialAccountId.
      .send({ financialAccountId })
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
      // RAKHAL-428: 20kg @ 10/kg unlinked cost now requires a financialAccountId.
      .send({ financialAccountId })
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

  it('RAKHAL-428 (closes RD-090): a Concentrate Mixer with real unlinked cost requires financialAccountId and posts a journal, same as a TMR', async () => {
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

    // No financialAccountId — 4kg * 10/kg = 40 unlinked cost, must be blocked.
    const blocked = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner));
    expect(blocked.status).toBe(400);
    expect((blocked.body as { message?: string }).message).toContain(
      'financialAccountId',
    );
    const noStock = await prisma.feedStock.count({
      where: { sourceConcentrationId: template.body.data.id },
    });
    expect(noStock).toBe(0);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner))
      .send({ financialAccountId })
      .expect(201);

    expect(finalized.body.data.stock.produced_cost_tk).toBe(40);
    expect(finalized.body.data.finance).not.toBeNull();

    const journalTransactionId = finalized.body.data.finance
      .journal_transaction_id as string;
    const entries = await prisma.journalEntry.findMany({
      where: { journalTransactionId },
    });
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);
    const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
    expect(totalCredit).toBe(40);
    expect(totalDebit).toBe(40);
  });

  it('RAKHAL-428: an all-linked Concentrate Mixer still needs no financialAccountId and posts no journal', async () => {
    const sourceIngredient = await createIngredient(
      'E2E RD-090 All-Linked Source Ingredient',
      10,
    );
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
      .send({ financialAccountId })
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
      // No financialAccountId — every line is batch-linked, nothing to purchase.
      .expect(201);

    expect(finalized.body.data.finance).toBeNull();
  });
});
