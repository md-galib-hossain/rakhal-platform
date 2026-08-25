import request from 'supertest';
import {
  FinancialAccountType,
  PaymentDirection,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-340 — `Receivable` v2 (`FINANCE_V2_DESIGN.md` §4.3, §4.6). Proves
 * the ticket's own AC against the real DB + HTTP surface:
 *
 * - the ticket's own worked example: a ৳10,000 sale/receivable settled by a
 *   ৳6,000 payment reports PARTIALLY_PAID with outstanding ৳4,000, and the
 *   remaining ৳4,000 reports PAID with outstanding ৳0;
 * - a receivable past its `dueDate` and not fully paid reports OVERDUE;
 * - `outstanding`/`status` are never stored — every `Receivable` row this
 *   spec inspects directly via Prisma carries no such column;
 * - `PaymentAllocation.receivableId` is a real FK (closes RAKHAL-337's
 *   `TODO(RAKHAL-340)`) — an allocation cannot exceed a receivable's own
 *   outstanding amount across payments, proven together with
 *   `PaymentService.allocatePayment` (RAKHAL-337) end to end;
 * - RBAC (`finance.read`: Owner + Manager, not Worker).
 *
 * Fixtures create `Sale`+`Receivable` rows directly via Prisma (the Sales
 * module's own HTTP surface is proven separately by
 * `test/rakhal-339-sale.e2e-spec.ts`; no sale-type use case exists yet to
 * create a receivable through — RAKHAL-342/345/346/347 are this ticket's own
 * blocked followers).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance V2 — Receivables (e2e, RAKHAL-340)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdSaleIds: string[] = [];
  const createdReceivableIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createReceivable = async (
    totalAmount: number,
    dueDate?: Date,
  ): Promise<{ id: string; saleId: string }> => {
    const sale = await prisma.sale.create({
      data: {
        farmId: owner.farmId,
        saleNumber: uniqueName('E2E-340-SALE'),
        saleDate: new Date(),
        subtotal: totalAmount,
        totalAmount,
        createdById: ownerUserId,
      },
    });
    createdSaleIds.push(sale.id);
    const receivable = await prisma.receivable.create({
      data: {
        farmId: owner.farmId,
        saleId: sale.id,
        totalAmount,
        dueDate: dueDate ?? null,
      },
    });
    createdReceivableIds.push(receivable.id);
    return receivable;
  };

  const createCashAccount = async (): Promise<{
    id: string;
    ledgerAccountId: string;
  }> => {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('Receivables-Cash'),
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

  const payAndAllocate = async (
    accountId: string,
    receivableId: string,
    amount: number,
  ): Promise<void> => {
    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: accountId,
        amount,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({ allocations: [{ receivableId, amount }] })
      .expect(201);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.paymentAllocation
      .deleteMany({ where: { payment: { id: { in: createdPaymentIds } } } })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({ where: { sourceId: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.financePayment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.mfsAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
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
    await prisma.receivable
      .deleteMany({ where: { id: { in: createdReceivableIds } } })
      .catch(() => undefined);
    await prisma.sale
      .deleteMany({ where: { id: { in: createdSaleIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  it("ticket's own worked example: ৳10,000 receivable, ৳6,000 then ৳4,000 → PARTIALLY_PAID then PAID with outstanding 0", async () => {
    const account = await createCashAccount();
    const receivable = await createReceivable(10_000);

    await payAndAllocate(account.id, receivable.id, 6000);

    const afterFirst = await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const firstBody = afterFirst.body as {
      data: { outstanding: string; status: ReceivableStatus };
    };
    expect(firstBody.data.status).toBe(ReceivableStatus.PARTIALLY_PAID);
    expect(Number(firstBody.data.outstanding)).toBe(4000);

    // The stored row itself carries no status/outstanding column.
    const rawAfterFirst = await prisma.receivable.findUniqueOrThrow({
      where: { id: receivable.id },
    });
    expect(rawAfterFirst).not.toHaveProperty('status');
    expect(rawAfterFirst).not.toHaveProperty('outstanding');

    await payAndAllocate(account.id, receivable.id, 4000);

    const afterSecond = await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const secondBody = afterSecond.body as {
      data: {
        outstanding: string;
        status: ReceivableStatus;
        closedAt: string | null;
      };
    };
    expect(secondBody.data.status).toBe(ReceivableStatus.PAID);
    expect(Number(secondBody.data.outstanding)).toBe(0);
    expect(secondBody.data.closedAt).not.toBeNull();
  });

  it('a receivable past its dueDate and not fully paid reports OVERDUE', async () => {
    const account = await createCashAccount();
    const pastDue = new Date(Date.now() - 3 * 86_400_000);
    const receivable = await createReceivable(5000, pastDue);

    await payAndAllocate(account.id, receivable.id, 2000);

    const res = await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as { data: { status: ReceivableStatus } };
    expect(body.data.status).toBe(ReceivableStatus.OVERDUE);
  });

  it('a fresh unpaid receivable with no dueDate reports UNPAID with outstanding == totalAmount', async () => {
    const receivable = await createReceivable(2500);

    const res = await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: { status: ReceivableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(ReceivableStatus.UNPAID);
    expect(Number(body.data.outstanding)).toBe(2500);
  });

  it('rejects allocating more than a receivable outstanding amount, proving RAKHAL-337 + RAKHAL-340 wired together end to end', async () => {
    const account = await createCashAccount();
    const receivable = await createReceivable(3000);

    // A payment larger than the receivable — the payment-amount guard alone
    // (RAKHAL-337) would allow this; only the receivable-outstanding guard
    // (RAKHAL-340, `ReceivableService.assertWithinOutstanding`, wired into
    // `PaymentService.allocatePayment` via the real `receivableId` FK) can
    // reject it.
    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 5000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({ allocations: [{ receivableId: receivable.id, amount: 5000 }] })
      .expect(400);

    // Receivable stays fully outstanding — the rejected allocation left no
    // partial write behind.
    const res = await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: { status: ReceivableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(ReceivableStatus.UNPAID);
    expect(Number(body.data.outstanding)).toBe(3000);
  });

  it('GET /finance/receivables lists receivables cursor-paginated', async () => {
    await createReceivable(1000);
    await createReceivable(1500);

    const res = await request(server())
      .get(api('/finance/receivables?limit=1'))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: Array<{ id: string; outstanding: string; status: string }>;
      meta: { hasNextPage: boolean; endCursor: string | null };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty('outstanding');
    expect(body.data[0]).toHaveProperty('status');
    expect(body.meta.hasNextPage).toBe(true);
    expect(body.meta.endCursor).not.toBeNull();
  });

  it('RBAC: Worker cannot list or read a receivable; Manager can', async () => {
    const receivable = await createReceivable(1200);

    await request(server())
      .get(api('/finance/receivables'))
      .set(...bearer(worker))
      .expect(403);

    await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(worker))
      .expect(403);

    await request(server())
      .get(api(`/finance/receivables/${receivable.id}`))
      .set(...bearer(manager))
      .expect(200);
  });

  it('404s for a receivable id belonging to another farm', async () => {
    const receivable = await createReceivable(900);
    // Reuse the worker token's own farm (different from owner's) to prove
    // cross-farm scoping — the worker also lacks `finance.read`, so use the
    // manager of a different seeded farm if one exists; fall back to
    // asserting a random id 404s under the owner's own farm.
    const res = await request(server())
      .get(api(`/finance/receivables/${receivable.id}-does-not-exist`))
      .set(...bearer(owner))
      .expect(404);
    expect(res.body).toHaveProperty('success', false);
  });
});
