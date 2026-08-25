import request from 'supertest';
import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-350 — `IncomeCategory` + `OtherIncome` (`FINANCE_V2_DESIGN.md`
 * §1.3, §5.1). Proves the ticket's own AC against the real DB + HTTP
 * surface:
 *
 * - the 7 seeded system categories (`prisma/seed.ts`'s `seedIncomeCategories`)
 *   are visible to any farm;
 * - `recordOtherIncome` posts a balanced journal entry — debits the target
 *   `FinancialAccount`'s own ledger account, credits the shared "Other
 *   Income" system ledger account (code `4900`) — and the account's derived
 *   balance (RAKHAL-336) increases by the recorded amount;
 * - a farm can add its own custom category and record income against it;
 * - "other" is structurally distinct from a product sale — no `subType`
 *   string anywhere in this flow;
 * - RBAC (`finance.create`/`finance.read`: Owner + Manager, not Worker).
 *
 * Requires the dev stack up + `pnpm seed` (uses the seeded demo owner's
 * already-bootstrapped chart of accounts, RAKHAL-333, and the seeded system
 * income categories, RAKHAL-350).
 */
describe('Finance V2 — Other Income (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdOtherIncomeIds: string[] = [];
  const createdCategoryIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createAccount = async (
    user: AuthedUser,
  ): Promise<{ id: string; ledgerAccountId: string }> => {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(user))
      .send({
        name: uniqueName('OtherIncome-Cash'),
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    const account = (
      res.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);
    return account;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({ where: { sourceId: { in: createdOtherIncomeIds } } })
      .catch(() => undefined);
    await prisma.otherIncome
      .deleteMany({ where: { id: { in: createdOtherIncomeIds } } })
      .catch(() => undefined);
    await prisma.incomeCategory
      .deleteMany({ where: { id: { in: createdCategoryIds } } })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({ where: { sourceId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  it('lists the 7 seeded system categories, visible to the farm', async () => {
    const res = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const categories = (
      res.body as { data: Array<{ name: string; isSystem: boolean }> }
    ).data;
    const systemNames = categories.filter((c) => c.isSystem).map((c) => c.name);
    expect(systemNames).toEqual(
      expect.arrayContaining([
        'Government Subsidy',
        'Insurance',
        'Rent',
        'Service Income',
        'Interest',
        'Compensation',
        'Miscellaneous',
      ]),
    );
  });

  it('records other income: debits the account, credits the Other Income ledger account, and the account balance moves', async () => {
    const account = await createAccount(owner);
    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (
      categoriesRes.body as { data: Array<{ id: string; name: string }> }
    ).data.find((c) => c.name === 'Government Subsidy');
    expect(category).toBeDefined();

    const balanceBefore = await request(server())
      .get(api('/finance/balance'))
      .set(...bearer(owner))
      .expect(200);
    const rakhalBalanceBefore = (
      balanceBefore.body as { data: { rakhalBalance: string } }
    ).data.rakhalBalance;

    const res = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category!.id,
        description: 'Livestock subsidy Q3',
        amount: 8000,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);

    const otherIncome = (
      res.body as {
        data: { id: string; categoryId: string; financialAccountId: string };
      }
    ).data;
    createdOtherIncomeIds.push(otherIncome.id);
    expect(otherIncome.categoryId).toBe(category!.id);
    expect(otherIncome.financialAccountId).toBe(account.id);

    const otherIncomeLedgerAccount =
      await prisma.ledgerAccount.findFirstOrThrow({
        where: { farmId: owner.farmId, code: '4900' },
      });
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'OTHER_INCOME',
        sourceId: otherIncome.id,
      },
      include: { entries: true },
    });
    expect(journalTxn).not.toBeNull();
    expect(journalTxn?.entries).toHaveLength(2);
    const debitLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === account.ledgerAccountId,
    );
    const creditLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === otherIncomeLedgerAccount.id,
    );
    expect(debitLine?.debit.toString()).toBe('8000');
    expect(creditLine?.credit.toString()).toBe('8000');

    const balanceAfter = await request(server())
      .get(api('/finance/balance'))
      .set(...bearer(owner))
      .expect(200);
    const rakhalBalanceAfter = (
      balanceAfter.body as { data: { rakhalBalance: string } }
    ).data.rakhalBalance;
    expect(Number(rakhalBalanceAfter) - Number(rakhalBalanceBefore)).toBe(8000);
  });

  it('a farm can add a custom category and record income against it', async () => {
    const catRes = await request(server())
      .post(api('/finance/income/categories'))
      .set(...bearer(owner))
      .send({ name: uniqueName('Custom Category') })
      .expect(201);
    const category = (
      catRes.body as {
        data: { id: string; isSystem: boolean; farmId: string | null };
      }
    ).data;
    createdCategoryIds.push(category.id);
    expect(category.isSystem).toBe(false);
    expect(category.farmId).toBe(owner.farmId);

    const account = await createAccount(owner);
    const res = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        amount: 1500,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);
    const otherIncome = (res.body as { data: { id: string } }).data;
    createdOtherIncomeIds.push(otherIncome.id);
  });

  it('rejects a category id belonging to another farm', async () => {
    // A category created under a different farm context is not visible here —
    // simulate by pointing at a non-existent id, since no second demo farm is
    // guaranteed to exist in this seed.
    const account = await createAccount(owner);
    await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: 'nonexistent-category-id',
        amount: 100,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(404);
  });

  it('rejects other income against an archived financial account', async () => {
    const account = await createAccount(owner);
    await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(owner))
      .expect(200);

    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        amount: 100,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(400);
  });

  it('rejects a zero amount', async () => {
    const account = await createAccount(owner);
    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        amount: 0,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(400);
  });

  it('RBAC: Worker cannot record or read other income; Manager can', async () => {
    const account = await createAccount(owner);
    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    await request(server())
      .post(api('/finance/income'))
      .set(...bearer(worker))
      .send({
        categoryId: category.id,
        amount: 100,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(403);

    await request(server())
      .get(api('/finance/income'))
      .set(...bearer(worker))
      .expect(403);

    const managerRes = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(manager))
      .send({
        categoryId: category.id,
        amount: 100,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);
    const otherIncome = (managerRes.body as { data: { id: string } }).data;
    createdOtherIncomeIds.push(otherIncome.id);
  });
});
