import request from 'supertest';
import { FinancialAccountType } from '@prisma/client';
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
 * RAKHAL-379 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.6, §9.2) — synchronous
 * finance report generators. Proves the ticket's own AC against the real DB
 * + HTTP surface:
 *
 * - `GET /finance/reports/profit-loss?from&to` groups revenue/expense by
 *   individual ledger account with farmer-facing names, `netProfit =
 *   revenue.total - expenses.total`;
 * - `GET /finance/reports/cash-flow?from&to` reports opening/closing balance
 *   + inflow/outflow per `FinancialAccount`;
 * - `GET /finance/reports/trial-balance?asOf=` is gated behind the new
 *   owner-only `finance.accounting` permission, `totalDebit === totalCredit`
 *   always holds (ledger-integrity invariant);
 * - Worker (no `finance.*`) gets 403 on all three.
 *
 * Runs on a **fresh, empty farm** (`FarmService.create()`) — these are
 * whole-population aggregates over every `LedgerAccount`/`JournalEntry` on
 * the farm, so asserting exact totals against the shared demo farm (which
 * every other e2e suite in this repo concurrently mutates) would be flaky by
 * construction — same isolation precedent `rakhal-369-aging.e2e-spec.ts`
 * already set.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Business Reporting — Finance report generators (e2e, RAKHAL-379)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;
  let farmId: string;

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
      unique('E2E-379-ReportsFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    // Worker needs a real FarmMember row on this fresh farm — the demo
    // worker account has no membership here by default.
    const workerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'worker@demo.rakhal.test' },
      select: { id: true },
    });
    const workerRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Worker', farmId: null },
      select: { id: true },
    });
    await prisma.farmMember.create({
      data: { farmId, userId: workerUser.id, roleId: workerRole.id },
    });
    const workerLogin = await request(server())
      .post(api('/auth/login'))
      .send({
        email: 'worker@demo.rakhal.test',
        password: 'WorkerPass123',
        farmId,
      })
      .expect(201);
    worker = { token: workerLogin.body.data.accessToken as string, farmId };
  }, 30_000);

  afterAll(async () => {
    // Worker's FarmMember row is farm-scoped and already covered by
    // deleteThrowawayOwner's own FarmMember deleteMany — nothing extra to
    // clean up here.
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  async function createAccount(openingBalance = 0): Promise<string> {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: unique('E2E-379-Account'),
        type: FinancialAccountType.CASH,
        openingBalance,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  it('profit-loss groups revenue/expense by ledger account with farmer-facing names; netProfit is correct', async () => {
    const accountId = await createAccount(0);
    const from = new Date(Date.now() - 60_000).toISOString();

    const category = await request(server())
      .post(api('/finance/income/categories'))
      .set(...bearer(owner))
      .send({ name: unique('E2E-379-IncomeCategory') })
      .expect(201);
    await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.body.data.id as string,
        amount: 1000,
        date: new Date().toISOString(),
        financialAccountId: accountId,
      })
      .expect(201);

    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: 'E2E-379 expense',
        amount: 400,
        expenseDate: new Date().toISOString(),
        financialAccountId: accountId,
      })
      .expect(201);

    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(server())
      .get(api(`/finance/reports/profit-loss?from=${from}&to=${to}`))
      .set(...bearer(owner))
      .expect(200);
    const data = res.body.data;

    const otherIncomeLine = data.revenue.lines.find(
      (l: { name: string }) => l.name === 'Other Income',
    );
    expect(otherIncomeLine.amount).toBe('1000');
    const utilitiesLine = data.expenses.lines.find(
      (l: { name: string }) => l.name === 'Utilities',
    );
    expect(utilitiesLine.amount).toBe('400');
    expect(data.revenue.total).toBe('1000');
    expect(data.expenses.total).toBe('400');
    expect(data.netProfit).toBe('600');
  });

  it('cash-flow reports opening/closing balance and inflow/outflow per FinancialAccount', async () => {
    const accountId = await createAccount(500);
    const from = new Date().toISOString();

    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: 'E2E-379 cash-flow expense',
        amount: 200,
        expenseDate: new Date().toISOString(),
        financialAccountId: accountId,
      })
      .expect(201);

    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(server())
      .get(api(`/finance/reports/cash-flow?from=${from}&to=${to}`))
      .set(...bearer(owner))
      .expect(200);
    const line = res.body.data.accounts.find(
      (a: { id: string }) => a.id === accountId,
    );
    expect(line.openingBalance).toBe('500');
    expect(line.outflow).toBe('200');
    expect(line.closingBalance).toBe('300');
  });

  it('trial-balance always balances (totalDebit === totalCredit) and is owner-only via finance.accounting', async () => {
    await createAccount(750);

    const res = await request(server())
      .get(api('/finance/reports/trial-balance'))
      .set(...bearer(owner))
      .expect(200);
    expect(res.body.data.totalDebit).toBe(res.body.data.totalCredit);
    expect(res.body.data.balanced).toBe(true);

    await request(server())
      .get(api('/finance/reports/trial-balance'))
      .set(...bearer(worker))
      .expect(403);
  });

  it('worker without finance.* is rejected on profit-loss and cash-flow', async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();

    await request(server())
      .get(api(`/finance/reports/profit-loss?from=${from}&to=${to}`))
      .set(...bearer(worker))
      .expect(403);
    await request(server())
      .get(api(`/finance/reports/cash-flow?from=${from}&to=${to}`))
      .set(...bearer(worker))
      .expect(403);
  });
});
