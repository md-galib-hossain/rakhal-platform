import request from 'supertest';
import { AuthedUser, TestContext } from './e2e';

/**
 * 2026-09-24: a recipe can only be *finalized* from ingredients the farm already stocks (finalize
 * never buys anything, needs no wallet). This puts `qtyKg` of a catalogue ingredient into inventory
 * as a `FeedItem` linked to it (`ingredientId`) — finalize auto-matches lines to it — so a spec that
 * finalizes a catalogue-only recipe stocks each of its ingredients first. `costPerKg` prices the lot
 * (the finalized batch's cost comes from it, not the catalogue). Returns the `FeedItem` id.
 */
export async function stockIngredient(
  ctx: TestContext,
  owner: AuthedUser,
  ingredientId: string,
  opts: { qtyKg?: number; costPerKg?: number; name?: string } = {},
): Promise<string> {
  const res = await request(ctx.app.getHttpServer())
    .post(`${ctx.prefix}/inventory/feed-items`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({
      name:
        opts.name ??
        `E2E stocked ${ingredientId.slice(-6)} ${Date.now()}-${Math.random()}`,
      feedClass: 'CONCENTRATE',
      unitId: 'unit_kg',
      currentStock: opts.qtyKg ?? 1000,
      costPerUnit: opts.costPerKg ?? 5,
      purchaseDate: '2026-01-10T00:00:00.000Z',
      ingredientId,
    })
    .expect(201);
  return res.body.data.id as string;
}

/**
 * RAKHAL-425: a Total Mixed Ration now requires at least one line whose ingredient was promoted
 * from a finalized Concentrate Mixer (`FeedIngredient.sourceConcentrationId != null`) — pure
 * catalogue ingredients are no longer enough on their own. Every pre-425 spec that finalizes a
 * `FEED_MIXTURE` predates this rule, so this creates a minimal concentrate, finalizes it once, and
 * returns the promoted ingredient id. Splice `{ ingredientId, amountKg: 0 }` onto the end of any
 * `FEED_MIXTURE` `items` array — `amountKg: 0` satisfies the rule (only the ingredient's
 * provenance is checked, not its quantity) without perturbing any existing totals/cost assertion
 * in the spec that didn't anticipate this line.
 *
 * RAKHAL-428: this template's own finalize now has real unlinked cost too (1kg @ 5/kg, no batch
 * link — nothing to link, this is a from-scratch fixture) — since RAKHAL-428 (closes RD-090)
 * made a Concentrate Mixer finalize pay for its unlinked cost the same way a TMR does, this
 * needs a `financialAccountId` now, same as any TMR finalize in this suite (`seededCashAccountId`,
 * same helper `test/utils/finance.ts` already documents for that exact purpose).
 */
export async function concentrateDerivedIngredientId(
  ctx: TestContext,
  owner: AuthedUser,
): Promise<string> {
  const server = ctx.app.getHttpServer();
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const auth: [string, string] = ['Authorization', `Bearer ${owner.token}`];

  const base = await request(server)
    .post(api('/feed/ingredients/custom'))
    .set(...auth)
    .send({
      name: `E2E RAKHAL-425 Base Ingredient ${Date.now()}-${Math.random()}`,
      nutrientGroup: 'ENERGY',
      pricePerKg: 5,
      dmPct: 90,
      cpPct: 10,
      meMjPerKgDm: 9,
    })
    .expect(201);

  const template = await request(server)
    .post(api('/feed/concentrations'))
    .set(...auth)
    .send({
      kind: 'CONCENTRATE_TEMPLATE',
      name: `E2E RAKHAL-425 Concentrate ${Date.now()}-${Math.random()}`,
      items: [{ ingredientId: base.body.data.id, amountKg: 1 }],
    })
    .expect(201);

  // Finalize consumes inventory — stock the base ingredient first (no wallet involved any more).
  await stockIngredient(ctx, owner, base.body.data.id as string, {
    qtyKg: 100,
  });
  const finalized = await request(server)
    .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
    .set(...auth)
    .send({})
    .expect(201);

  return finalized.body.data.ingredient.id as string;
}
