import { createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod, PaymentGateway } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from '../src/modules/subscription/application/services/subscription-lifecycle.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { CouponService } from '../src/modules/billing/application/services/coupon.service';
import { ReferralService } from '../src/modules/billing/application/services/referral.service';
import { CreditWalletService } from '../src/modules/billing/application/services/credit-wallet.service';
import { ReceiptService } from '../src/modules/billing/application/services/receipt.service';
import { TransactionalEmailService } from '../src/modules/email/application/services/transactional-email.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LoggerService } from '../src/core/logger/logger/logger.service';
import type {
  PaymentExecutionResult,
  PaymentProvider,
} from '../src/modules/billing/application/ports/payment-provider.port';

/**
 * RAKHAL-223 — referral engine (`customer-api`, PRD §33.2). Attribution once
 * at farm creation (REF-01), reward on the referred farm's first *real* paid
 * invoice (REF-02/03), self-referral voided (REF-04), idempotent accrual
 * (REF-06), and clawback on refund (REF-05). Uses the same **stub**
 * `PaymentProvider` technique as `bkash.e2e-spec.ts` to drive a gateway
 * COMPLETED/refund without a live bKash sandbox.
 */
describe('Referral engine (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let audit: AuditService;
  let lifecycle: SubscriptionLifecycleService;
  let coupons: CouponService;
  let referrals: ReferralService;
  let creditWallet: CreditWalletService;
  let receipts: ReceiptService;
  let txEmail: TransactionalEmailService;
  let legal: LegalConsentService;
  let farmService: FarmService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let starterPlanId: string;
  const tempFarmIds: string[] = [];
  const tempUserIds: string[] = [];

  const logger = {
    setContext: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;

  const billingWith = (provider: PaymentProvider): BillingService =>
    new BillingService(
      prisma,
      audit,
      lifecycle,
      coupons,
      referrals,
      creditWallet,
      receipts,
      legal,
      txEmail,
      provider,
      logger,
    );

  const stubProvider = (
    executePayment: () => Promise<PaymentExecutionResult>,
  ): PaymentProvider => ({
    gateway: PaymentGateway.BKASH,
    isConfigured: () => true,
    createPayment: () =>
      Promise.resolve({ providerPaymentId: 'PID', redirectUrl: null }),
    executePayment,
    queryPayment: () => Promise.resolve({ status: 'PENDING' }),
    refund: () => Promise.resolve({ refundTrxId: 'R', status: 'ok' }),
  });

  const makeReferredUser = async (email: string) => {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Referred Owner',
        isEmailVerified: true,
      },
      select: { id: true },
    });
    tempUserIds.push(user.id);
    // A real referred owner accepts the current ToS/Privacy before creating a
    // farm (RAKHAL-236 gate); record it so `farmService.create` is allowed.
    await legal.recordConsent(user.id, []);
    return user.id;
  };

  /** Seeds a PENDING invoice + payment directly (bypasses the real bKash
   * gateway call, same technique as `bkash.e2e-spec.ts`). */
  const seedPending = async (
    farmId: string,
    providerPaymentId: string,
    total: string,
  ) => {
    const invoice = await prisma.invoice.create({
      data: {
        farmId,
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
        farmId,
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
    referrals = ctx.app.get(ReferralService);
    creditWallet = ctx.app.get(CreditWalletService);
    receipts = ctx.app.get(ReceiptService);
    txEmail = ctx.app.get(TransactionalEmailService);
    legal = ctx.app.get(LegalConsentService);
    farmService = ctx.app.get(FarmService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const starter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' },
      select: { id: true },
    });
    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!starter || !user) throw new Error('seed missing — run `pnpm seed`');
    starterPlanId = starter.id;
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.creditWallet
      .deleteMany({ where: { farmId: owner.farmId } })
      .catch(() => undefined);
    for (const farmId of tempFarmIds) {
      await prisma.referralCommission.deleteMany({
        where: { OR: [{ referrerFarmId: farmId }, { referredFarmId: farmId }] },
      });
      await prisma.referral.deleteMany({
        where: { OR: [{ referrerFarmId: farmId }, { referredFarmId: farmId }] },
      });
      await prisma.payment.deleteMany({ where: { farmId } });
      await prisma.invoice.deleteMany({ where: { farmId } });
      await prisma.farmSubscription.deleteMany({ where: { farmId } });
      await prisma.creditWallet.deleteMany({ where: { farmId } });
      await prisma.farm
        .delete({ where: { id: farmId } })
        .catch(() => undefined);
    }
    await prisma.referralCode.deleteMany({ where: { farmId: owner.farmId } });
    for (const userId of tempUserIds) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it("a referred farm's first real paid invoice credits the referrer once, and a replay never double-credits (REF-02/03/06)", async () => {
    const referralCode = await referrals.getOrCreateCode(
      owner.farmId,
      ownerUserId,
    );

    const referredUserId = await makeReferredUser(
      `referred-${Date.now()}@e2e.rakhal.test`,
    );
    const referredFarm = await farmService.create(referredUserId, {
      name: 'Referred Farm A',
      referralCode: referralCode.code,
    });
    tempFarmIds.push(referredFarm.id);

    const referral = await prisma.referral.findUnique({
      where: { referredFarmId: referredFarm.id },
    });
    expect(referral?.status).toBe('PENDING');

    const invoiceId = await seedPending(referredFarm.id, 'PID-ref-ok', '1000');
    const svc = billingWith(
      stubProvider(() =>
        Promise.resolve({
          status: 'COMPLETED',
          providerTrxId: 'TRX-REF',
          amount: 1000,
        }),
      ),
    );

    const first = await svc.finalizePayment('PID-ref-ok');
    expect(first.status).toBe('PAID');

    const wallet = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(wallet?.balance.toNumber()).toBe(200);

    const commission = await prisma.referralCommission.findUnique({
      where: { idempotencyKey: invoiceId },
    });
    expect(commission?.status).toBe('APPROVED');
    expect(commission?.amount.toNumber()).toBe(200);

    const updatedReferral = await prisma.referral.findUnique({
      where: { referredFarmId: referredFarm.id },
    });
    expect(updatedReferral?.status).toBe('REWARDED');

    // Replay: finalize again (idempotent guard) AND call accrual directly a
    // second time (REF-06) — neither may double-credit.
    const second = await svc.finalizePayment('PID-ref-ok');
    expect(second.status).toBe('ALREADY_PAID');
    await referrals.accrueOnFirstPaidInvoice(referredFarm.id, invoiceId);

    const walletAfterReplay = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(walletAfterReplay?.balance.toNumber()).toBe(200);
  });

  it('a self-referral is voided and never accrues a reward (REF-04)', async () => {
    const referralCode = await referrals.getOrCreateCode(
      owner.farmId,
      ownerUserId,
    );

    // The referrer creates a *second* farm using their own code.
    const selfReferredFarm = await farmService.create(ownerUserId, {
      name: 'Self-Referred Farm',
      referralCode: referralCode.code,
    });
    tempFarmIds.push(selfReferredFarm.id);

    const referral = await prisma.referral.findUnique({
      where: { referredFarmId: selfReferredFarm.id },
    });
    expect(referral?.status).toBe('VOID');
    expect(referral?.flagReason).toBe('self-referral');

    const walletBefore = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });

    const invoiceId = await seedPending(
      selfReferredFarm.id,
      'PID-self-ref',
      '1000',
    );
    const svc = billingWith(
      stubProvider(() =>
        Promise.resolve({ status: 'COMPLETED', amount: 1000 }),
      ),
    );
    await svc.finalizePayment('PID-self-ref');

    const commission = await prisma.referralCommission.findUnique({
      where: { idempotencyKey: invoiceId },
    });
    expect(commission).toBeNull();

    const walletAfter = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(walletAfter?.balance.toNumber() ?? 0).toBe(
      walletBefore?.balance.toNumber() ?? 0,
    );
  });

  it('refunding the triggering invoice claws back the commission (REF-05)', async () => {
    const referralCode = await referrals.getOrCreateCode(
      owner.farmId,
      ownerUserId,
    );
    const referredUserId = await makeReferredUser(
      `clawback-${Date.now()}@e2e.rakhal.test`,
    );
    const referredFarm = await farmService.create(referredUserId, {
      name: 'Referred Farm Clawback',
      referralCode: referralCode.code,
    });
    tempFarmIds.push(referredFarm.id);

    const invoiceId = await seedPending(
      referredFarm.id,
      'PID-clawback',
      '1000',
    );
    const svc = billingWith(
      stubProvider(() =>
        Promise.resolve({ status: 'COMPLETED', amount: 1000 }),
      ),
    );
    await svc.finalizePayment('PID-clawback');

    const walletBefore = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(walletBefore?.balance.toNumber()).toBeGreaterThanOrEqual(200);

    const refunded = await svc.refundInvoice(
      referredFarm.id,
      invoiceId,
      referredUserId,
      'customer requested',
    );
    expect(refunded.status).toBe('REFUNDED');

    const commission = await prisma.referralCommission.findUnique({
      where: { idempotencyKey: invoiceId },
    });
    expect(commission?.status).toBe('CLAWED_BACK');

    const walletAfter = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(walletAfter?.balance.toNumber()).toBe(
      (walletBefore?.balance.toNumber() ?? 0) - 200,
    );

    // Idempotent: a repeat refund call is a no-op, not a double clawback.
    const repeat = await svc.refundInvoice(
      referredFarm.id,
      invoiceId,
      referredUserId,
      'replay',
    );
    expect(repeat.status).toBe('REFUNDED');
    const walletAfterRepeat = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(walletAfterRepeat?.balance.toNumber()).toBe(
      walletAfter?.balance.toNumber(),
    );
  });

  it("wallet credit auto-applies to the referrer's next checkout", async () => {
    await prisma.creditWallet.upsert({
      where: { farmId: owner.farmId },
      create: { farmId: owner.farmId, balance: 150 },
      update: { balance: { increment: 150 } },
    });
    const before = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    const startingBalance = before!.balance.toNumber();

    const svc = billingWith(stubProvider(() => Promise.reject(new Error())));
    const result = await svc.checkout(owner.farmId, ownerUserId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
    });

    // Wallet may already carry a balance from an earlier test on this same
    // referrer farm — assert relative to whatever was actually there, not a
    // hardcoded 150. `remaining` (1000) always exceeds the wallet here, so
    // the full balance applies.
    expect(result.invoice.referral_credit_applied).toBe(startingBalance);
    expect(result.invoice.total).toBe(1000 - startingBalance);

    const after = await prisma.creditWallet.findUnique({
      where: { farmId: owner.farmId },
    });
    expect(after?.balance.toNumber()).toBe(0);
  });
});
