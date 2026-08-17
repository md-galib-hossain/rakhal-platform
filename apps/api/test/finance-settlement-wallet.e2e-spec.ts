import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * `recordPayment()` previously accepted `paymentMethod` but discarded it —
 * settling a receivable/payable never credited/debited the Wallet and never
 * synced the originating `FinanceTransaction.paidNow`, so money never
 * actually "moved" anywhere (found while investigating why milk-sale revenue
 * never showed up as real cash/wallet balance). This spec covers the fix.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance — settlement payment applies paymentMethod (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function walletBalance(): Promise<number> {
    const res = await request(server())
      .get(api('/finance/wallet'))
      .set(...bearer(owner))
      .expect(200);
    return res.body.data.totalBalance as number;
  }

  it('crediting a receivable with WALLET creates a wallet CREDIT and syncs the source transaction paidNow', async () => {
    const entityName = `E2E Buyer ${Date.now()}`;
    const amount = 1000;

    const txnRes = await request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(owner))
      .send({
        type: 'REVENUE',
        category: 'REVENUE',
        subType: 'milk',
        entityName,
        amount,
        paymentType: 'PARTIAL',
        paidNow: 0,
      })
      .expect(201);
    const transactionId = txnRes.body.data.transactionId as string;

    const beforeTxn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: transactionId },
    });
    expect(beforeTxn.paidNow).toBe(0);

    const receivable = await prisma.financeReceivable.findFirstOrThrow({
      where: { sourceTransactionId: transactionId, kind: 'RECEIVABLE' },
    });

    const balanceBefore = await walletBalance();

    const payRes = await request(server())
      .post(api(`/finance/receivables/${receivable.id}/record-payment`))
      .set(...bearer(owner))
      .send({ amountPaid: amount, paymentMethod: 'WALLET' })
      .expect(201);

    expect(payRes.body.data.outstanding).toBe(0);
    expect(payRes.body.data.walletTransactionId).toBeTruthy();

    const balanceAfter = await walletBalance();
    expect(balanceAfter - balanceBefore).toBe(amount);

    const afterTxn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: transactionId },
    });
    expect(afterTxn.paidNow).toBe(amount);
    expect(afterTxn.paymentMethod).toBe('WALLET');

    const walletTxn = await prisma.walletTransaction.findUniqueOrThrow({
      where: { id: payRes.body.data.walletTransactionId as string },
    });
    expect(walletTxn.direction).toBe('CREDIT');
    expect(walletTxn.amount).toBe(amount);
  });

  it('settling a receivable with CASH does not touch the wallet balance', async () => {
    const entityName = `E2E Buyer Cash ${Date.now()}`;
    const amount = 400;

    const txnRes = await request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(owner))
      .send({
        type: 'REVENUE',
        category: 'REVENUE',
        subType: 'milk',
        entityName,
        amount,
        paymentType: 'PARTIAL',
        paidNow: 0,
      })
      .expect(201);
    const transactionId = txnRes.body.data.transactionId as string;
    const receivable = await prisma.financeReceivable.findFirstOrThrow({
      where: { sourceTransactionId: transactionId, kind: 'RECEIVABLE' },
    });

    const balanceBefore = await walletBalance();

    const payRes = await request(server())
      .post(api(`/finance/receivables/${receivable.id}/record-payment`))
      .set(...bearer(owner))
      .send({ amountPaid: amount, paymentMethod: 'CASH' })
      .expect(201);

    expect(payRes.body.data.walletTransactionId).toBeNull();
    expect(await walletBalance()).toBe(balanceBefore);

    const afterTxn = await prisma.financeTransaction.findUniqueOrThrow({
      where: { id: transactionId },
    });
    expect(afterTxn.paidNow).toBe(amount);
    expect(afterTxn.paymentMethod).toBe('CASH');
  });

  it('paying off a payable with WALLET debits the wallet, and rejects when balance is insufficient', async () => {
    // Fund the wallet first so the debit has something to draw from.
    await request(server())
      .post(api('/finance/wallet/add-funds'))
      .set(...bearer(owner))
      .send({ amount: 5000, paymentMethod: 'CASH', description: 'E2E fund' })
      .expect(201);

    const entityName = `E2E Vendor ${Date.now()}`;
    const amount = 300;
    const txnRes = await request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(owner))
      .send({
        type: 'OPERATING_EXPENSE',
        category: 'OVERHEAD',
        subType: 'e2e_payable',
        entityName,
        amount,
        paymentType: 'PARTIAL',
        paidNow: 0,
      })
      .expect(201);
    const transactionId = txnRes.body.data.transactionId as string;
    const payable = await prisma.financeReceivable.findFirstOrThrow({
      where: { sourceTransactionId: transactionId, kind: 'PAYABLE' },
    });

    const balanceBefore = await walletBalance();

    const payRes = await request(server())
      .post(api(`/finance/payables/${payable.id}/record-payment`))
      .set(...bearer(owner))
      .send({ amountPaid: amount, paymentMethod: 'WALLET' })
      .expect(201);

    expect(payRes.body.data.walletTransactionId).toBeTruthy();
    expect(balanceBefore - (await walletBalance())).toBe(amount);

    const walletTxn = await prisma.walletTransaction.findUniqueOrThrow({
      where: { id: payRes.body.data.walletTransactionId as string },
    });
    expect(walletTxn.direction).toBe('DEBIT');
  });

  it('400s a WALLET payable settlement that exceeds the wallet balance', async () => {
    const balance = await walletBalance();
    const entityName = `E2E Vendor Overdraw ${Date.now()}`;
    const amount = balance + 100_000;

    const txnRes = await request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(owner))
      .send({
        type: 'OPERATING_EXPENSE',
        category: 'OVERHEAD',
        subType: 'e2e_payable',
        entityName,
        amount,
        paymentType: 'PARTIAL',
        paidNow: 0,
      })
      .expect(201);
    const payable = await prisma.financeReceivable.findFirstOrThrow({
      where: {
        sourceTransactionId: txnRes.body.data.transactionId as string,
        kind: 'PAYABLE',
      },
    });

    await request(server())
      .post(api(`/finance/payables/${payable.id}/record-payment`))
      .set(...bearer(owner))
      .send({ amountPaid: amount, paymentMethod: 'WALLET' })
      .expect(400);
  });
});
