import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';
import { PaymentGateway } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from '../src/modules/subscription/application/services/subscription-lifecycle.service';
import { SubscriptionAccessService } from '../src/modules/subscription/application/services/subscription-access.service';
import { LoggerService } from '../src/core/logger/logger/logger.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { CouponService } from '../src/modules/billing/application/services/coupon.service';
import type {
  PaymentExecutionResult,
  PaymentProvider,
} from '../src/modules/billing/application/ports/payment-provider.port';

/**
 * RAKHAL-221 — bKash finalize flow (`customer-api`, PRD §32.3). Uses a **stub**
 * `PaymentProvider` (no network) to prove the callback finalize: gateway-confirmed
 * COMPLETED + matching amount → PAID + subscription activated, idempotent (no
 * double-activate), and FAILED on execute-error / amount-mismatch. Plus the
 * public callback route redirects.
 */
describe('bKash payment finalize (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let audit: AuditService;
  let lifecycle: SubscriptionLifecycleService;
  let coupons: CouponService;
  let access: SubscriptionAccessService;
  let starterPlanId: string;
  let tempFarmId: string;

  // LoggerService is request-scoped (can't app.get it); a stub is enough here.
  const logger = {
    setContext: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;

  const svcWith = (
    executePayment: () => Promise<PaymentExecutionResult>,
  ): BillingService => {
    const provider: PaymentProvider = {
      gateway: PaymentGateway.BKASH,
      isConfigured: () => true,
      createPayment: () =>
        Promise.resolve({ providerPaymentId: 'PID', redirectUrl: null }),
      executePayment,
      queryPayment: () => Promise.resolve({ status: 'PENDING' }),
      refund: () => Promise.resolve({ refundTrxId: 'R', status: 'ok' }),
    };
    return new BillingService(
      prisma,
      audit,
      lifecycle,
      coupons,
      provider,
      logger,
    );
  };

  const seedPending = async (providerPaymentId: string, total: string) => {
    const invoice = await prisma.invoice.create({
      data: {
        farmId: tempFarmId,
        subscriptionPlanId: starterPlanId,
        billingPeriod: 'MONTHLY',
        currency: 'BDT',
        subtotal: total,
        discountTotal: 0,
        total,
        status: 'PENDING',
        idempotencyKey: `k-${providerPaymentId}`,
      },
      select: { id: true },
    });
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        farmId: tempFarmId,
        provider: PaymentGateway.BKASH,
        providerPaymentId,
        amount: total,
        status: 'INITIATED',
        idempotencyKey: `k-${providerPaymentId}:pay`,
      },
    });
    return invoice.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    audit = ctx.app.get(AuditService);
    lifecycle = ctx.app.get(SubscriptionLifecycleService);
    coupons = ctx.app.get(CouponService);
    access = ctx.app.get(SubscriptionAccessService);

    const starter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' },
      select: { id: true },
    });
    const owner = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!starter || !owner) throw new Error('seed missing — run `pnpm seed`');
    starterPlanId = starter.id;

    const farm = await prisma.farm.create({
      data: {
        name: 'E2E bKash Farm',
        slug: `e2e-bkash-${Date.now()}`,
        ownerId: owner.id,
      },
      select: { id: true },
    });
    tempFarmId = farm.id;
  }, 30_000);

  afterAll(async () => {
    if (tempFarmId) {
      await prisma.payment.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.invoice.deleteMany({ where: { farmId: tempFarmId } });
      await prisma.farmSubscription.deleteMany({
        where: { farmId: tempFarmId },
      });
      await prisma.farm
        .delete({ where: { id: tempFarmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('COMPLETED + matching amount → PAID + activates the subscription (idempotent)', async () => {
    const invoiceId = await seedPending('PID-ok', '1000');
    const svc = svcWith(() =>
      Promise.resolve({
        status: 'COMPLETED',
        providerTrxId: 'TRX123',
        amount: 1000,
      }),
    );

    const first = await svc.finalizePayment('PID-ok');
    expect(first.status).toBe('PAID');

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(invoice?.status).toBe('PAID');
    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: 'PID-ok' },
    });
    expect(payment?.status).toBe('COMPLETED');
    expect(payment?.providerTrxId).toBe('TRX123');

    const ent = await access.resolveEntitlement(tempFarmId);
    expect(ent.status).toBe('ACTIVE');
    expect(ent.planName).toBe('Starter');

    const subsAfterFirst = await prisma.farmSubscription.count({
      where: { farmId: tempFarmId },
    });

    // Replayed callback → no-op (no double charge / double activate).
    const second = await svc.finalizePayment('PID-ok');
    expect(second.status).toBe('ALREADY_PAID');
    const subsAfterSecond = await prisma.farmSubscription.count({
      where: { farmId: tempFarmId },
    });
    expect(subsAfterSecond).toBe(subsAfterFirst);
  });

  it('a gateway amount mismatch is refused (never marks PAID)', async () => {
    const invoiceId = await seedPending('PID-mismatch', '1000');
    const svc = svcWith(() =>
      Promise.resolve({
        status: 'COMPLETED',
        providerTrxId: 'X',
        amount: 9999,
      }),
    );
    const res = await svc.finalizePayment('PID-mismatch');
    expect(res.status).toBe('FAILED');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(invoice?.status).toBe('FAILED');
  });

  it('an execute error marks the payment FAILED', async () => {
    const invoiceId = await seedPending('PID-throw', '1000');
    const svc = svcWith(() => Promise.reject(new Error('gateway down')));
    const res = await svc.finalizePayment('PID-throw');
    expect(res.status).toBe('FAILED');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(invoice?.status).toBe('FAILED');
  });

  it('returns UNKNOWN for an unrecognized paymentID', async () => {
    const svc = svcWith(() => Promise.resolve({ status: 'COMPLETED' }));
    const res = await svc.finalizePayment('no-such-payment');
    expect(res.status).toBe('UNKNOWN');
  });

  it('the public callback route redirects (no auth required)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/bkash/callback`)
      .query({ paymentID: 'no-such-payment', status: 'success' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('status=failed');
  });
});
