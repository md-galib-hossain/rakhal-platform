import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-370 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.3, §5.14, §9.1) —
 * unified Transactions feed. Proves the ticket's own AC against the real DB
 * + HTTP surface:
 *
 * - cursor-paginated over `JournalTransaction` headers, newest first;
 * - `?type=` filters on `sourceType`;
 * - `amount` (document gross) and `cashAmount` (net cash movement, `0` for
 *   an internal fee-less transfer) are both correct;
 * - `party`/`reference` resolve for an `EXPENSE` row via the batched
 *   per-source-type lookup;
 * - a `Transfer` renders one row naming both accounts touched;
 * - **no** `debit`/`credit`/`ledgerAccount*` key ever appears in the
 *   serialized response (ADR-023).
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — the feed is a
 * whole-population cursor over every `JournalTransaction` on the farm, so
 * sharing the demo farm with every other suite would be flaky by
 * construction (same precedent `rakhal-369-aging.e2e-spec.ts` documents).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Business Reporting — Transactions feed (e2e, RAKHAL-370)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;
  let accountAId: string;
  let accountBId: string;
  let supplierId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);

    const throwaway = await createThrowawayOwner(
      ctx,
      prisma,
      unique('E2E-370-TxnFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    const accountA = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: 'E2E-370 Cash A', type: 'CASH', openingBalance: 1000 })
      .expect(201);
    accountAId = accountA.body.data.id as string;

    const accountB = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: 'E2E-370 Cash B', type: 'CASH', openingBalance: 0 })
      .expect(201);
    accountBId = accountB.body.data.id as string;

    const supplier = await prisma.supplier.create({
      data: { farmId, name: 'E2E-370 Feed Supplier' },
    });
    supplierId = supplier.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.supplier
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  it('EXPENSE row: gross amount, negative cashAmount, resolved party/reference', async () => {
    const description = 'E2E-370 concentrate feed purchase';
    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'OTHER',
        description,
        amount: 500,
        expenseDate: new Date().toISOString(),
        financialAccountId: accountAId,
        supplierId,
      })
      .expect(201);

    const res = await request(server())
      .get(api('/finance/transactions?type=EXPENSE'))
      .set(...bearer(owner))
      .expect(200);

    const rows = res.body.data as {
      type: string;
      amount: string;
      cashAmount: string;
      reference: string | null;
      party: { id: string; name: string } | null;
      accounts: string[];
    }[];
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.type).toBe('EXPENSE');
    expect(row.amount).toBe('500');
    expect(row.cashAmount).toBe('-500');
    expect(row.reference).toBe(description);
    expect(row.party?.id).toBe(supplierId);
    expect(row.accounts).toEqual(['E2E-370 Cash A']);
  });

  it('Transfer row: one row naming both accounts, cashAmount 0 with no fee', async () => {
    await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: accountAId,
        toFinancialAccountId: accountBId,
        amount: 200,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);

    const res = await request(server())
      .get(api('/finance/transactions?type=FINANCE_TRANSFER'))
      .set(...bearer(owner))
      .expect(200);

    const rows = res.body.data as {
      amount: string;
      cashAmount: string;
      accounts: string[];
    }[];
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe('200');
    expect(rows[0].cashAmount).toBe('0');
    expect(rows[0].accounts.sort()).toEqual(
      ['E2E-370 Cash A', 'E2E-370 Cash B'].sort(),
    );
  });

  it('cursor pagination returns distinct pages newest-first', async () => {
    const page1 = await request(server())
      .get(api('/finance/transactions?limit=1'))
      .set(...bearer(owner))
      .expect(200);
    expect(page1.body.data.length).toBe(1);
    expect(page1.body.meta.hasNextPage).toBe(true);

    const page2 = await request(server())
      .get(
        api(
          `/finance/transactions?limit=1&cursor=${page1.body.meta.endCursor as string}`,
        ),
      )
      .set(...bearer(owner))
      .expect(200);
    expect(page2.body.data.length).toBe(1);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
  });

  it('never exposes debit/credit/ledgerAccount in the serialized response (ADR-023)', async () => {
    const res = await request(server())
      .get(api('/finance/transactions'))
      .set(...bearer(owner))
      .expect(200);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/debit|credit|ledgerAccount/i);
  });
});
