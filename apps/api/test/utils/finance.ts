import request from 'supertest';
import { AuthedUser, TestContext } from './e2e';

/**
 * Resolve a `FinancialAccount` id for specs that have to post a real cost (RD-077).
 *
 * RAKHAL-393 made `financialAccountId` mandatory whenever a Total Mixed Ration finalize posts a
 * cost, closing RD-066's "farm's oldest active account" stopgap. The specs that finalize a TMR
 * were never updated, so 13 tests across 5 specs broke. This is what they use instead.
 *
 * It **reuses the farm's seeded `Cash` account rather than creating a new one**. Creating one per
 * spec would work, but RD-074 documents that 22 e2e specs already leak `FinancialAccount` rows
 * into the shared dev database — enough that the custom ledger-code range was exhausted twice and
 * had to be widened. Adding five more leaking specs to fix a different bug is not a trade worth
 * making, and the seed guarantees this row exists (`seedFinancialAccount` is idempotent by name,
 * so a re-seed reuses it).
 *
 * Falls back to any CASH account, then to any account at all, so a farm whose seed predates the
 * named `Cash` row still resolves something rather than failing with a confusing 400 from the
 * route under test.
 */
export async function seededCashAccountId(
  ctx: TestContext,
  user: AuthedUser,
): Promise<string> {
  const res = await request(ctx.app.getHttpServer())
    .get(`${ctx.prefix}/finance/accounts`)
    .set('Authorization', `Bearer ${user.token}`)
    .expect(200);

  const accounts = res.body.data as {
    id: string;
    name: string;
    type: string;
    deletedAt: string | null;
  }[];
  const live = accounts.filter((a) => a.deletedAt === null);

  const account =
    live.find((a) => a.name === 'Cash' && a.type === 'CASH') ??
    live.find((a) => a.type === 'CASH') ??
    live[0];

  if (!account) {
    throw new Error(
      'No FinancialAccount on this farm — run `pnpm seed` before the e2e suite.',
    );
  }
  return account.id;
}
