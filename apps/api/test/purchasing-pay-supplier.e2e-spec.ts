import request from 'supertest';
import { FeedClass, FinancialAccountType, PaymentMethod } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { PayableStatus } from 'src/modules/purchasing/domain/payable-status';
import { PaySupplierUseCase } from 'src/modules/purchasing/application/use-cases/pay-supplier/pay-supplier.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-349 — `PaySupplier` + closing the Payable allocation guard gap
 * (`FINANCE_V2_DESIGN.md` §1.4). Proves two things against the real DB:
 *
 * 1. `PaymentService.allocatePayment` now rejects over-allocating a
 *    **payable** exactly like it already rejected over-allocating a
 *    receivable (RAKHAL-340) — the gap RAKHAL-348's own doc comment on
 *    `PayableService` documented explicitly. Exercised both directly
 *    against `POST /finance/payments/:id/allocations` (mirrors the
 *    existing `finance-v2-payments.e2e-spec.ts` receivable-side case) and
 *    through the new `PaySupplierUseCase`.
 * 2. `PaySupplierUseCase` pays down a real `Payable` (raised by
 *    `PurchaseService.createPurchase`, RAKHAL-348) in two payments —
 *    partial then completing — moving `PayableService`'s derived status
 *    UNPAID -> PARTIALLY_PAID -> PAID with outstanding reaching exactly
 *    zero, atomically (a rejected over-allocation leaves no partial
 *    `Payment`/`PaymentAllocation` write behind).
 *
 * This ticket adds no HTTP route (Lane: `application/use-cases/**` only —
 * a controller is a later ticket's job, same precedent RAKHAL-346/347
 * document), so `PaySupplierUseCase` is exercised directly via
 * `app.get(PaySupplierUseCase)`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — PaySupplier + Payable allocation guard (e2e, RAKHAL-349)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let useCase: PaySupplierUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdPurchaseIds: string[] = [];
  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createCashAccount = async (): Promise<{
    id: string;
    ledgerAccountId: string;
  }> => {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('PaySupplier-Cash'),
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

  const createUnpaidPayable = async (
    totalAmount: number,
  ): Promise<{ payableId: string; purchaseId: string }> => {
    const unit = await prisma.unit.findFirstOrThrow({
      where: { OR: [{ farmId: owner.farmId }, { farmId: null }] },
      select: { id: true },
    });
    const feedItem = await prisma.feedItem.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E-349-Feed'),
        feedClass: FeedClass.CONCENTRATE,
        unitId: unit.id,
        currentStock: 0,
        costPerUnit: 10,
        purchaseDate: new Date(),
        createdBy: ownerUserId,
      },
    });

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          { feedItemId: feedItem.id, quantity: 10, unitCost: totalAmount / 10 },
        ],
      })
      .expect(201);
    const purchase = res.body.data as {
      id: string;
      payable: { id: string } | null;
    };
    createdPurchaseIds.push(purchase.id);
    if (!purchase.payable) {
      throw new Error('Expected a Payable to be raised for an unpaid purchase');
    }
    return { payableId: purchase.payable.id, purchaseId: purchase.id };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    useCase = ctx.app.get(PaySupplierUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.paymentAllocation
      .deleteMany({
        where: { payable: { purchaseId: { in: createdPurchaseIds } } },
      })
      .catch(() => undefined);
    await prisma.financePayment
      .deleteMany({
        where: {
          allocations: {
            some: { payable: { purchaseId: { in: createdPurchaseIds } } },
          },
        },
      })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({
        where: {
          farmId: owner.farmId,
          sourceType: { in: ['FINANCE_PAYMENT', 'PURCHASE'] },
          sourceId: {
            in: [...createdPurchaseIds],
          },
        },
      })
      .catch(() => undefined);
    await prisma.payable
      .deleteMany({ where: { purchaseId: { in: createdPurchaseIds } } })
      .catch(() => undefined);
    await prisma.purchaseLine
      .deleteMany({ where: { purchaseId: { in: createdPurchaseIds } } })
      .catch(() => undefined);
    await prisma.purchase
      .deleteMany({ where: { id: { in: createdPurchaseIds } } })
      .catch(() => undefined);
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  it('PaySupplierUseCase pays down a payable in two payments: UNPAID -> PARTIALLY_PAID -> PAID, outstanding reaches exactly zero', async () => {
    const { payableId } = await createUnpaidPayable(1000);
    const account = await createCashAccount();

    const initial = await request(server())
      .get(api(`/purchasing/payables/${payableId}`))
      .set(...bearer(owner))
      .expect(200);
    expect(
      (initial.body as { data: { status: PayableStatus } }).data.status,
    ).toBe(PayableStatus.UNPAID);

    const first = await useCase.execute(owner.farmId, ownerUserId, {
      payableId,
      financialAccountId: account.id,
      amount: 400,
      method: PaymentMethod.CASH,
      transactionDate: new Date().toISOString(),
    });
    expect(first.payable.status).toBe(PayableStatus.PARTIALLY_PAID);
    expect(Number(first.payable.outstanding)).toBe(600);

    const second = await useCase.execute(owner.farmId, ownerUserId, {
      payableId,
      financialAccountId: account.id,
      amount: 600,
      method: PaymentMethod.CASH,
      transactionDate: new Date().toISOString(),
    });
    expect(second.payable.status).toBe(PayableStatus.PAID);
    expect(Number(second.payable.outstanding)).toBe(0);

    const final = await request(server())
      .get(api(`/purchasing/payables/${payableId}`))
      .set(...bearer(owner))
      .expect(200);
    const finalBody = final.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(finalBody.data.status).toBe(PayableStatus.PAID);
    expect(Number(finalBody.data.outstanding)).toBe(0);
  });

  it('PaySupplierUseCase rejects an over-allocating payment with no partial write', async () => {
    const { payableId } = await createUnpaidPayable(500);
    const account = await createCashAccount();

    const paymentCountBefore = await prisma.financePayment.count({
      where: { financialAccountId: account.id },
    });

    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        payableId,
        financialAccountId: account.id,
        amount: 600,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/exceeds the payable outstanding amount/);

    // Whole transaction rolled back — no Payment row survives.
    const paymentCountAfter = await prisma.financePayment.count({
      where: { financialAccountId: account.id },
    });
    expect(paymentCountAfter).toBe(paymentCountBefore);

    const payableRes = await request(server())
      .get(api(`/purchasing/payables/${payableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = payableRes.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(PayableStatus.UNPAID);
    expect(Number(body.data.outstanding)).toBe(500);
  });

  it('PaySupplierUseCase rejects a second payment that would push the total past the payable outstanding, across two payments', async () => {
    const { payableId } = await createUnpaidPayable(1000);
    const account = await createCashAccount();

    await useCase.execute(owner.farmId, ownerUserId, {
      payableId,
      financialAccountId: account.id,
      amount: 700,
      method: PaymentMethod.CASH,
      transactionDate: new Date().toISOString(),
    });

    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        payableId,
        financialAccountId: account.id,
        amount: 400,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/exceeds the payable outstanding amount/);

    const payableRes = await request(server())
      .get(api(`/purchasing/payables/${payableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = payableRes.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(PayableStatus.PARTIALLY_PAID);
    expect(Number(body.data.outstanding)).toBe(300);
  });

  it('PaySupplierUseCase rejects a foreign-farm/unknown payableId', async () => {
    const account = await createCashAccount();
    await expect(
      useCase.execute(owner.farmId, ownerUserId, {
        payableId: 'nonexistent-payable-id',
        financialAccountId: account.id,
        amount: 100,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('POST /finance/payments/:id/allocations rejects over-allocating a payable past its outstanding, mirroring the receivable-side guard', async () => {
    // The payable's own total (400) is smaller than the payment (500) —
    // proves PayableService.assertWithinOutstanding directly through the
    // shared HTTP allocation route, not just through PaySupplierUseCase.
    const { payableId } = await createUnpaidPayable(400);
    const account = await createCashAccount();

    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: 'OUTGOING',
        financialAccountId: account.id,
        amount: 500,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({ allocations: [{ payableId, amount: 500 }] })
      .expect(400);

    const payableRes = await request(server())
      .get(api(`/purchasing/payables/${payableId}`))
      .set(...bearer(owner))
      .expect(200);
    const body = payableRes.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(body.data.status).toBe(PayableStatus.UNPAID);
    expect(Number(body.data.outstanding)).toBe(400);
  });
});
