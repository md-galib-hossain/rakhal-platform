import request from 'supertest';
import { ExpenseCategory, FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { PayableStatus } from 'src/modules/purchasing/domain/payable-status';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-348 — `Expense` + `Payable` (`FINANCE_V2_DESIGN.md` §5.1). Proves
 * the "consumed immediately, never becomes inventory" half of the Purchase/
 * Expense split: an electricity bill (`UTILITIES`) paid immediately posts a
 * balanced journal and raises no `Payable`; the same bill left unpaid raises
 * a `Payable` for the full amount.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — Expense + Payable (e2e, RAKHAL-348)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCashAccount(): Promise<{ id: string }> {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('E2E-348-Cash'),
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    return (res.body as { data: { id: string } }).data;
  }

  it('an electricity bill paid immediately posts a balanced journal and raises no Payable', async () => {
    const cash = await createCashAccount();

    const res = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: ExpenseCategory.UTILITIES,
        description: 'Electricity bill — August',
        amount: 4500,
        expenseDate: new Date().toISOString(),
        financialAccountId: cash.id,
      });

    expect(res.status).toBe(201);
    const expense = res.body.data as {
      id: string;
      amount: string;
      financialAccountId: string | null;
    };
    expect(expense.amount).toBe('4500');
    expect(expense.financialAccountId).toBe(cash.id);

    const payable = await prisma.payable.findFirst({
      where: { expenseId: expense.id },
    });
    expect(payable).toBeNull();

    const journal = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
      },
      include: { entries: true },
    });
    const debitSum = journal.entries.reduce(
      (sum, e) => sum + Number(e.debit),
      0,
    );
    const creditSum = journal.entries.reduce(
      (sum, e) => sum + Number(e.credit),
      0,
    );
    expect(debitSum).toBe(4500);
    expect(creditSum).toBe(4500);
  });

  it('an unpaid expense raises a Payable for the full amount', async () => {
    const res = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: ExpenseCategory.SALARY,
        description: 'Worker salary — August',
        amount: 12000,
        expenseDate: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    const expense = res.body.data as { id: string };

    const payable = await prisma.payable.findFirstOrThrow({
      where: { expenseId: expense.id },
    });
    expect(Number(payable.totalAmount)).toBe(12000);

    const res2 = await request(server())
      .get(api(`/purchasing/payables/${payable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res2.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(PayableStatus.UNPAID);
    expect(Number(body.data.outstanding)).toBe(12000);
  });

  it('RBAC: Worker cannot record or read expenses', async () => {
    const res = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(worker))
      .send({
        category: ExpenseCategory.UTILITIES,
        description: 'Worker attempt',
        amount: 100,
        expenseDate: new Date().toISOString(),
      });
    expect(res.status).toBe(403);

    const readRes = await request(server())
      .get(api('/purchasing/expenses'))
      .set(...bearer(worker));
    expect(readRes.status).toBe(403);
  });
});
