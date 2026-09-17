import request from 'supertest';
import { AuthedUser, TestContext } from './e2e';
import { seededCashAccountId } from './finance';

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

  const financialAccountId = await seededCashAccountId(ctx, owner);
  const finalized = await request(server)
    .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
    .set(...auth)
    .send({ financialAccountId })
    .expect(201);

  return finalized.body.data.ingredient.id as string;
}
