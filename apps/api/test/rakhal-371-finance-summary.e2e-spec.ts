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

import { createExtraAccount } from './utils/finance';
/**
 * RAKHAL-371 (MILESTONE 22, `BUSINESS_IA_PRD.md` §4.4, §6.1, §6.2) —
 * `GET /finance/summary` + retiring the fake receivable/payable block.
 * Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - `GET /finance/balance` no longer carries a `receivablePayable` key;
 * - `GET /finance/summary?from&to` derives `previousPeriod` as an
 *   equal-length slice immediately before `from` (never a fabricated full
 *   prior calendar month);
 * - `revenue`/`expenses`/`netProfit` react to a real posted `Expense`;
 * - `netCashFlow` moves only for the actually-paid expense, not an unpaid
 *   (payable-raising) one;
 * - `position` (`totalReceivable`/`totalPayable`/`accountCount`) is
 *   point-in-time and unaffected by which `from`/`to` window is requested.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — same precedent
 * `rakhal-369-aging.e2e-spec.ts`/`rakhal-370-transactions.e2e-spec.ts`
 * document (whole-population aggregates are flaky against a shared farm).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Business Reporting — Finance summary (e2e, RAKHAL-371)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;
  let accountId: string;

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
      unique('E2E-371-SummaryFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    const account = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: 'E2E-371 Cash',
          type: 'CASH',
          openingBalance: 0,
        }),
      },
    };
    accountId = account.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await prisma.receivable
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.sale.deleteMany({ where: { farmId } }).catch(() => undefined);
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  it('GET /finance/balance no longer carries receivablePayable', async () => {
    const res = await request(server())
      .get(api('/finance/balance'))
      .set(...bearer(owner))
      .expect(200);
    expect(res.body.data).not.toHaveProperty('receivablePayable');
  });

  it('derives previousPeriod as an equal-length slice immediately before from', async () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-26T00:00:00.000Z');
    const res = await request(server())
      .get(
        api(
          `/finance/summary?from=${from.toISOString()}&to=${to.toISOString()}`,
        ),
      )
      .set(...bearer(owner))
      .expect(200);

    const durationMs = to.getTime() - from.getTime();
    const expectedPrevFrom = new Date(from.getTime() - durationMs);
    const expectedPrevTo = new Date(from.getTime() - 1);

    expect(res.body.data.previousPeriod.from).toBe(
      expectedPrevFrom.toISOString(),
    );
    expect(res.body.data.previousPeriod.to).toBe(expectedPrevTo.toISOString());
  });

  it('revenue/expenses/netProfit/netCashFlow react to a real paid expense; changePct null with zero previous', async () => {
    const description = 'E2E-371 paid concentrate expense';
    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'OTHER',
        description,
        amount: 300,
        expenseDate: new Date().toISOString(),
        financialAccountId: accountId,
      })
      .expect(201);

    const unpaidDescription = 'E2E-371 unpaid raised-payable expense';
    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'OTHER',
        description: unpaidDescription,
        amount: 150,
        expenseDate: new Date().toISOString(),
      })
      .expect(201);

    const from = new Date(Date.now() - 24 * 3600 * 1000);
    const to = new Date(Date.now() + 24 * 3600 * 1000);
    const res = await request(server())
      .get(
        api(
          `/finance/summary?from=${from.toISOString()}&to=${to.toISOString()}`,
        ),
      )
      .set(...bearer(owner))
      .expect(200);

    const data = res.body.data as {
      revenue: { current: number; previous: number; changePct: number | null };
      expenses: { current: number };
      netProfit: { current: number };
      netCashFlow: { current: number };
    };
    expect(data.expenses.current).toBe(450);
    expect(data.netProfit.current).toBe(-450);
    // Only the PAID expense (300) hit a real FinancialAccount; the unpaid
    // one only raised a Payable (Cr Accounts Payable, not a cash account).
    expect(data.netCashFlow.current).toBe(-300);
    expect(data.revenue.changePct).toBeNull();
  });

  it('position (receivable/payable/account) is point-in-time, unaffected by from/to', async () => {
    const sale = await prisma.sale.create({
      data: {
        farmId,
        saleNumber: unique('E2E-371-INV'),
        saleDate: new Date(),
        subtotal: 1000,
        totalAmount: 1000,
        createdById: ownerUserId,
      },
    });
    await prisma.receivable.create({
      data: { farmId, saleId: sale.id, totalAmount: 1000, dueDate: null },
    });

    // A period window with no overlap with "now" at all — position must
    // still report the real receivable/payable/account state.
    const res = await request(server())
      .get(
        api(
          '/finance/summary?from=2020-01-01T00:00:00.000Z&to=2020-01-02T00:00:00.000Z',
        ),
      )
      .set(...bearer(owner))
      .expect(200);

    const position = res.body.data.position as {
      totalReceivable: string;
      receivableCount: number;
      totalPayable: string;
      payableCount: number;
      accountCount: number;
    };
    expect(position.totalReceivable).toBe('1000');
    expect(position.receivableCount).toBe(1);
    expect(position.totalPayable).toBe('150');
    expect(position.payableCount).toBe(1);
    expect(position.accountCount).toBe(1);
  });
});
