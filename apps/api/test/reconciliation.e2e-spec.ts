import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { PaymentGateway } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { LoggerService } from '../src/core/logger/logger/logger.service';
import { ReconciliationService } from '../src/modules/billing/application/services/reconciliation.service';
import type {
  PaymentExecutionResult,
  PaymentProvider,
} from '../src/modules/billing/application/ports/payment-provider.port';

/**
 * RAKHAL-239 — settlement reconciliation (PRD §36.4). Uses a **stub** gateway
 * (no network) to prove the sweep flags a discrepancy (gateway amount ≠ our
 * ledger → AMOUNT_MISMATCH), leaves a clean payment alone, is idempotent on
 * re-run, and never mutates the ledger (REC-03). Then the `admin-api` console
 * (behind `PlatformAdminGuard`) lists + resolves the exception; a farm token
 * can't reach it.
 */
interface AdminException {
  id: string;
  type: string;
  status: string;
  payment_id: string | null;
}

describe('Settlement reconciliation (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let adminToken: string;
  let starterPlanId: string;
  let tempFarmId: string;
  let mismatchPaymentId: string;
  let cleanPaymentId: string;

  // LoggerService is request-scoped; a stub is enough for the manual construction.
  const logger = {
    setContext: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;

  // Stub gateway: PID-MM reports a different amount (mismatch), PID-OK matches,
  // anything else is a clean COMPLETED with no amount (never flags).
  const provider: PaymentProvider = {
    gateway: PaymentGateway.BKASH,
    isConfigured: () => true,
    createPayment: () =>
      Promise.resolve({ providerPaymentId: 'PID', redirectUrl: null }),
    executePayment: () => Promise.resolve({ status: 'COMPLETED' }),
    queryPayment: (pid: string): Promise<PaymentExecutionResult> => {
      if (pid === 'PID-MM')
        return Promise.resolve({ status: 'COMPLETED', amount: 9999 });
      if (pid === 'PID-OK')
        return Promise.resolve({ status: 'COMPLETED', amount: 1000 });
      return Promise.resolve({ status: 'COMPLETED', amount: null });
    },
    refund: () => Promise.resolve({ refundTrxId: 'R', status: 'ok' }),
  };

  const svc = () => new ReconciliationService(prisma, provider, logger);

  const seedPayment = async (
    providerPaymentId: string,
    amount: string,
  ): Promise<string> => {
    const invoice = await prisma.invoice.create({
      data: {
        farmId: tempFarmId,
        subscriptionPlanId: starterPlanId,
        billingPeriod: 'MONTHLY',
        currency: 'BDT',
        subtotal: amount,
        discountTotal: 0,
        total: amount,
        status: 'PAID',
        idempotencyKey: `recon-${providerPaymentId}`,
      },
      select: { id: true },
    });
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        farmId: tempFarmId,
        provider: PaymentGateway.BKASH,
        providerPaymentId,
        amount,
        status: 'COMPLETED',
        idempotencyKey: `recon-${providerPaymentId}:pay`,
      },
      select: { id: true },
    });
    return payment.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({
        email: 'admin@rakhal.test',
        password: 'AdminPass123',
        code: currentTotpCode(),
      })
      .expect(201);
    adminToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;

    const starter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' },
      select: { id: true },
    });
    const ownerUser = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!starter || !ownerUser)
      throw new Error('seed missing — run `pnpm seed`');
    starterPlanId = starter.id;

    const farm = await prisma.farm.create({
      data: {
        name: 'E2E Recon Farm',
        slug: `e2e-recon-${Date.now()}`,
        ownerId: ownerUser.id,
      },
      select: { id: true },
    });
    tempFarmId = farm.id;

    mismatchPaymentId = await seedPayment('PID-MM', '1000');
    cleanPaymentId = await seedPayment('PID-OK', '1000');
  }, 30_000);

  afterAll(async () => {
    if (tempFarmId) {
      await prisma.reconciliationException.deleteMany({
        where: { farmId: tempFarmId },
      });
      await prisma.payment.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.invoice.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.farm
        .delete({ where: { id: tempFarmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('flags an amount mismatch, leaves a clean payment, is idempotent (REC-01)', async () => {
    await svc().runReconciliation();

    const mismatch = await prisma.reconciliationException.findFirst({
      where: { paymentId: mismatchPaymentId, type: 'AMOUNT_MISMATCH' },
    });
    expect(mismatch).not.toBeNull();
    expect(mismatch?.status).toBe('OPEN');
    expect(mismatch?.expectedAmount?.toString()).toBe('1000');
    expect(mismatch?.actualAmount?.toString()).toBe('9999');

    // The matching payment is not flagged.
    expect(
      await prisma.reconciliationException.count({
        where: { paymentId: cleanPaymentId },
      }),
    ).toBe(0);

    // The ledger is untouched (REC-03).
    const payment = await prisma.payment.findUnique({
      where: { id: mismatchPaymentId },
    });
    expect(payment?.status).toBe('COMPLETED');
    expect(payment?.amount.toString()).toBe('1000');

    // Re-run → no duplicate exception (idempotent, RNW-04 analog).
    await svc().runReconciliation();
    expect(
      await prisma.reconciliationException.count({
        where: { paymentId: mismatchPaymentId, type: 'AMOUNT_MISMATCH' },
      }),
    ).toBe(1);
  });

  it('a farm token cannot reach the reconciliation console (401)', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/reconciliation`)
      .set(...bearer(owner))
      .expect(401);
  });

  it('admin lists then resolves the exception (audited)', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/reconciliation`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'OPEN', type: 'AMOUNT_MISMATCH' })
      .expect(200);
    const items = (list.body as { data: AdminException[] }).data;
    const found = items.find((e) => e.payment_id === mismatchPaymentId);
    expect(found).toBeDefined();

    const resolved = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/reconciliation/${found!.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        note: 'Gateway over-reported; manual review OK',
      })
      .expect(201);
    expect((resolved.body as { data: AdminException }).data.status).toBe(
      'RESOLVED',
    );

    const audit = await prisma.platformAdminAuditLog.findFirst({
      where: { action: 'RECONCILIATION_RESOLVED', entityId: found!.id },
    });
    expect(audit).not.toBeNull();
  });
});
