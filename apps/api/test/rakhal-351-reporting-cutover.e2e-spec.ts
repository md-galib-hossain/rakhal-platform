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
 * RAKHAL-351 — re-point every finance reader at the ledger. Proves the
 * actual bug this ticket fixes: before this change, `DashboardService`
 * (`financial-snapshot`, `financial-performance`) and
 * `ReportGeneratorsService` (`revenueTotal`/`expenseTotal`, the Monthly P&L
 * report's own income figure) only read V1 `FinanceTransaction` — a V2
 * `OtherIncome` posting (RAKHAL-350, a real `Sale`-adjacent finance-v2 write
 * that posts a balanced `JournalEntry` against the REVENUE ledger category)
 * was completely invisible to them. This spec records real V2 other-income
 * over HTTP and asserts the dashboard KPIs move by exactly that amount —
 * the same live-DB, real-HTTP-round-trip style `other-income.e2e-spec.ts`
 * already uses for RAKHAL-350 itself.
 *
 * Requires the dev stack up + `pnpm seed` (demo owner's already-bootstrapped
 * chart of accounts, RAKHAL-333, and seeded income categories, RAKHAL-350).
 */
describe('RAKHAL-351 — dashboard/reports see V2 ledger activity (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdOtherIncomeIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
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

  it('a V2 other-income posting moves the dashboard financial-snapshot income KPI', async () => {
    const before = await request(server())
      .get(api('/dashboard/financial-snapshot'))
      .set(...bearer(owner))
      .expect(200);
    const incomeBefore = (
      before.body as { data: { income: { current: number } } }
    ).data.income.current;

    const accountRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: uniqueName('R351-Cash'), type: FinancialAccountType.CASH })
      .expect(201);
    const account = (
      accountRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    const AMOUNT = 6543;
    const incomeRes = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        description: 'RAKHAL-351 reporting cutover proof',
        amount: AMOUNT,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);
    const otherIncome = (incomeRes.body as { data: { id: string } }).data;
    createdOtherIncomeIds.push(otherIncome.id);

    const after = await request(server())
      .get(api('/dashboard/financial-snapshot'))
      .set(...bearer(owner))
      .expect(200);
    const incomeAfter = (
      after.body as { data: { income: { current: number } } }
    ).data.income.current;

    // Pre-RAKHAL-351, `financialSnapshot()`'s `txnSum()` only read V1
    // `FinanceTransaction` — this posting is entirely a V2 `JournalEntry`
    // write, so the delta would have been exactly 0 before this ticket.
    expect(Math.round((incomeAfter - incomeBefore) * 100) / 100).toBe(AMOUNT);
  });

  it('the same V2 posting shows up in the 12-month financial-performance trend for the current month', async () => {
    const before = await request(server())
      .get(api('/dashboard/financial-performance'))
      .set(...bearer(owner))
      .expect(200);
    const months = (
      before.body as {
        data: { months: Array<{ month: string; income: number }> };
      }
    ).data.months;
    const currentKey = new Date().toISOString().slice(0, 7);
    const incomeBefore =
      months.find((m) => m.month === currentKey)?.income ?? 0;

    const accountRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: uniqueName('R351-Cash2'), type: FinancialAccountType.CASH })
      .expect(201);
    const account = (
      accountRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    const AMOUNT = 321;
    const incomeRes = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        amount: AMOUNT,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);
    const otherIncome = (incomeRes.body as { data: { id: string } }).data;
    createdOtherIncomeIds.push(otherIncome.id);

    const after = await request(server())
      .get(api('/dashboard/financial-performance'))
      .set(...bearer(owner))
      .expect(200);
    const monthsAfter = (
      after.body as {
        data: { months: Array<{ month: string; income: number }> };
      }
    ).data.months;
    const incomeAfter =
      monthsAfter.find((m) => m.month === currentKey)?.income ?? 0;

    expect(Math.round((incomeAfter - incomeBefore) * 100) / 100).toBe(AMOUNT);
  });
});
