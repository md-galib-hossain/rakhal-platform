import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  BillingPeriod,
  Invoice,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { env } from 'src/core/config/env';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { PLAN_NAMES } from 'src/modules/subscription/domain/subscription-features';
import {
  clampNonNegative,
  computeGrandTotal,
  computeTax,
} from '../../domain/money';
import {
  formatInvoiceNumber,
  INVOICE_COUNTER_SCOPE,
} from '../../domain/invoice-number';
import {
  PAYMENT_PROVIDER,
  type PaymentExecutionResult,
  type PaymentProvider,
} from '../ports/payment-provider.port';
import { CheckoutDto } from '../../presentation/dto/checkout.dto';
import { ScheduleDowngradeDto } from '../../presentation/dto/schedule-downgrade.dto';
import { UpdateBillingProfileDto } from '../../presentation/dto/update-billing-profile.dto';
import { PreviewCheckoutDto } from '../../presentation/dto/preview-checkout.dto';
import { ListInvoiceQueryDto } from '../../presentation/dto/list-invoice-query.dto';
import { CouponService } from './coupon.service';
import { ReferralService } from './referral.service';
import { CreditWalletService } from './credit-wallet.service';
import { ReceiptService, type RenderedReceipt } from './receipt.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';

/** A pending downgrade/lateral plan change (RFE-036 follow-up) — the switch takes effect at
 * `effective_at` (the current period's expiry), never charges. */
export interface PublicSubscriptionSchedule {
  pending_plan_id: string;
  pending_plan_name: string;
  pending_billing_period: BillingPeriod;
  effective_at: string;
}

export interface PublicInvoice {
  id: string;
  invoice_number: string | null;
  plan_id: string;
  billing_period: BillingPeriod;
  currency: string;
  subtotal: number;
  discount_total: number;
  referral_credit_applied: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
}

/**
 * Billing core (RAKHAL-220, PRD §32). Owns invoices + payments; **computes
 * totals server-side** (PAY-01), is **idempotent** on the checkout key (PAY-05),
 * and audits every transition (PAY-04). Subscription state changes are delegated
 * to `SubscriptionLifecycleService` (single owner of the cache). The gateway is
 * behind `PaymentProvider` (bKash = RAKHAL-221).
 */
@Injectable()
export class BillingService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly coupons: CouponService,
    private readonly referrals: ReferralService,
    private readonly creditWallet: CreditWalletService,
    private readonly receipts: ReceiptService,
    private readonly legal: LegalConsentService,
    private readonly txEmail: TransactionalEmailService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BillingService.name);
  }

  async checkout(
    farmId: string,
    userId: string,
    dto: CheckoutDto,
    idempotencyKey?: string,
  ) {
    // LGL-02: the current Terms + Privacy must be accepted before any charge.
    await this.legal.assertConsent(userId);

    const key = idempotencyKey?.trim() || randomUUID();

    // Idempotent: same (farm, key) returns the invoice already created (PAY-05).
    const existing = await this.prisma.invoice.findUnique({
      where: { farmId_idempotencyKey: { farmId, idempotencyKey: key } },
    });
    if (existing) {
      return {
        invoice: this.present(existing),
        checkout: null,
        idempotent: true,
      };
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    // Free-plan gate: profile must be complete, and a farm may activate Free
    // only once ever (independent of the separate TrialGrant/auto-trial-at-
    // signup system). Checked on the plan itself, not `total.isZero()` — a
    // paid plan zeroed by a 100%-off coupon must not trip this.
    const isFreePlan = plan.name === PLAN_NAMES.FREE;
    if (isFreePlan) {
      const farm = await this.prisma.farm.findUniqueOrThrow({
        where: { id: farmId },
        select: { phone: true, address: true, freePlanActivatedAt: true },
      });
      if (!farm.phone || !farm.address) {
        throw new ForbiddenException(
          'Complete your farm profile (phone and address) before activating the Free plan',
        );
      }
      if (farm.freePlanActivatedAt) {
        throw new ConflictException(
          'The Free plan has already been activated for this farm',
        );
      }
    }

    // Total computed here — the client never sends an amount (PAY-01).
    const subtotal =
      dto.billingPeriod === BillingPeriod.YEARLY
        ? (plan.yearlyPrice ?? plan.monthlyPrice.times(12))
        : plan.monthlyPrice;

    // Coupon (222) reservation + wallet-credit application (223) both run
    // inside the same transaction as the invoice commit, so the coupon seat
    // decrement (CPN-01), the wallet debit, and the invoice row all commit
    // atomically (a rejected coupon rolls the wallet debit back too).
    const user = dto.couponCode
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { phoneVerifiedAt: true },
        })
      : null;

    // VAT is off at launch (`VAT_ENABLED=false`) → rate 0 → taxAmount 0, so the
    // total is unchanged from the pre-237 behaviour (TAX-04).
    const vatRate = new Prisma.Decimal(env.VAT_ENABLED ? env.VAT_RATE : 0);

    const invoice = await this.prisma.$transaction(async (tx) => {
      let discountTotal = new Prisma.Decimal(0);
      let couponId: string | null = null;
      if (dto.couponCode) {
        const reservation = await this.coupons.reserve(tx, {
          code: dto.couponCode,
          farmId,
          planId: plan.id,
          subtotal,
          phoneVerifiedAt: user?.phoneVerifiedAt ?? null,
        });
        discountTotal = reservation.discount;
        couponId = reservation.couponId;
      }

      const netAfterDiscount = clampNonNegative(subtotal.minus(discountTotal));
      // VAT is charged on the post-discount price (TAX-01).
      const taxAmount = computeTax(netAfterDiscount, vatRate);
      const grossWithTax = netAfterDiscount.plus(taxAmount);

      // Closed-loop Rakhal Credit auto-applies to the tax-inclusive charge (§37).
      const referralCreditApplied = await this.creditWallet.applyToCharge(
        tx,
        farmId,
        grossWithTax,
        'subscription',
      );

      // Gapless sequential receipt number (TAX-02): incrementing the counter row
      // inside this transaction serializes concurrent checkouts on its lock and
      // releases the number if the checkout rolls back — never a collision, never
      // a gap. The seed pre-creates the row so the create branch never races.
      const counter = await tx.invoiceCounter.upsert({
        where: { scope: INVOICE_COUNTER_SCOPE },
        create: { scope: INVOICE_COUNTER_SCOPE, value: 1 },
        update: { value: { increment: 1 } },
      });
      const invoiceNumber = formatInvoiceNumber(
        env.INVOICE_NUMBER_PREFIX,
        counter.value,
      );

      const created = await tx.invoice.create({
        data: this.buildInvoiceData({
          farmId,
          subscriptionPlanId: plan.id,
          billingPeriod: dto.billingPeriod,
          subtotal,
          discountTotal,
          taxRate: vatRate,
          taxAmount,
          couponId,
          referralCreditApplied,
          invoiceNumber,
          idempotencyKey: key,
        }),
      });

      if (couponId) {
        await this.coupons.recordRedemption(tx, {
          couponId,
          farmId,
          invoiceId: created.id,
          discount: discountTotal,
        });
      }

      // Atomic conditional flip (mirrors CouponService.reserve's seat-decrement
      // pattern) — closes the TOCTOU race between the pre-transaction check
      // above and two concurrent Free-plan checkout requests from the same farm.
      if (isFreePlan) {
        const flip = await tx.farm.updateMany({
          where: { id: farmId, freePlanActivatedAt: null },
          data: { freePlanActivatedAt: new Date() },
        });
        if (flip.count === 0) {
          throw new ConflictException(
            'The Free plan has already been activated for this farm',
          );
        }
      }

      return created;
    });
    const redeemedCouponId = invoice.couponId;
    const total = invoice.total;
    const isFree = total.isZero();

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.INVOICE_CREATED,
      entityType: 'Invoice',
      entityId: invoice.id,
      farmId,
      metadata: { total: total.toNumber(), status: invoice.status },
    });
    if (redeemedCouponId) {
      await this.audit.record({
        actorUserId: userId,
        action: AuditAction.COUPON_REDEEMED,
        entityType: 'Coupon',
        entityId: redeemedCouponId,
        farmId,
        metadata: {
          invoiceId: invoice.id,
          discount: invoice.discountTotal.toNumber(),
        },
      });
    }

    // ৳0 invoice (e.g. Free / 100%-coupon later) → PAID with no gateway (PAY-07).
    if (isFree) {
      await this.lifecycle.activate(farmId, plan.id, dto.billingPeriod);
      await this.audit.record({
        actorUserId: userId,
        action: AuditAction.INVOICE_PAID,
        entityType: 'Invoice',
        entityId: invoice.id,
        farmId,
        metadata: { total: 0 },
      });
      // Receipt PDF emailed on payment (TAX-03); best-effort, never throws.
      await this.receipts.emailReceipt(invoice.id);
      return {
        invoice: this.present(invoice),
        checkout: null,
        idempotent: false,
      };
    }

    // Paid invoice → open a payment attempt.
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        farmId,
        provider: this.provider.gateway,
        amount: total,
        status: PaymentStatus.INITIATED,
        idempotencyKey: `${key}:pay`,
      },
    });
    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.PAYMENT_INITIATED,
      entityType: 'Payment',
      entityId: payment.id,
      farmId,
      metadata: { amount: total.toNumber(), provider: this.provider.gateway },
    });

    // Initiate with the gateway when one is configured (bKash, RAKHAL-221). A
    // gateway error must NOT 500 the checkout — the invoice stays PENDING (the
    // client can retry the idempotent checkout, or reconciliation resolves it).
    if (this.provider.isConfigured()) {
      try {
        const res = await this.provider.createPayment({
          invoiceId: invoice.id,
          farmId,
          amount: total.toNumber(),
          currency: 'BDT',
        });
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { providerPaymentId: res.providerPaymentId },
        });
        return {
          invoice: this.present(invoice),
          checkout: {
            provider: this.provider.gateway,
            provider_payment_id: res.providerPaymentId,
            redirect_url: res.redirectUrl ?? null,
          },
          idempotent: false,
        };
      } catch (err) {
        this.log.error('Gateway payment initiation failed', err, {
          farmId,
          invoiceId: invoice.id,
        });
        return {
          invoice: this.present(invoice),
          checkout: { provider_configured: true, initiation_failed: true },
          idempotent: false,
        };
      }
    }

    this.log.warn(
      'Checkout created a PENDING invoice with no gateway configured',
      {
        farmId,
        invoiceId: invoice.id,
      },
    );
    return {
      invoice: this.present(invoice),
      checkout: { provider_configured: false },
      idempotent: false,
    };
  }

  async listInvoices(
    farmId: string,
    query: ListInvoiceQueryDto,
  ): Promise<CursorPage<PublicInvoice>> {
    const rows = await this.prisma.invoice.findMany({
      where: { farmId },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { items: page.items.map((i) => this.present(i)), meta: page.meta };
  }

  async getInvoice(farmId: string, id: string): Promise<PublicInvoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, farmId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.present(invoice);
  }

  /**
   * Finalize a gateway payment (RAKHAL-221) — called from the bKash callback.
   * **Never trusts the callback** (PAY-02): it re-executes the gateway and flips
   * state only on a confirmed COMPLETED with a matching amount (PAY-01).
   * Idempotent (PAY-05) via a conditional invoice update — a replayed callback
   * can't double-activate.
   */
  async finalizePayment(
    providerPaymentId: string,
  ): Promise<{ status: 'PAID' | 'FAILED' | 'ALREADY_PAID' | 'UNKNOWN' }> {
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId },
    });
    if (!payment) return { status: 'UNKNOWN' };

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
    });
    if (!invoice) return { status: 'UNKNOWN' };
    if (invoice.status === InvoiceStatus.PAID)
      return { status: 'ALREADY_PAID' };

    let result: PaymentExecutionResult;
    try {
      result = await this.provider.executePayment(
        providerPaymentId,
        payment.idempotencyKey,
      );
    } catch (err) {
      this.log.error('Payment execution failed', err, {
        invoiceId: invoice.id,
      });
      await this.failPayment(payment.id, invoice);
      return { status: 'FAILED' };
    }

    const amountOk =
      result.amount == null ||
      new Prisma.Decimal(result.amount).equals(invoice.total);

    if (result.status === 'COMPLETED' && amountOk) {
      // Atomic idempotency guard: only the first finalize flips PAID (PAY-05).
      const flip = await this.prisma.invoice.updateMany({
        where: { id: invoice.id, status: { not: InvoiceStatus.PAID } },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      if (flip.count === 0) return { status: 'ALREADY_PAID' };

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          providerTrxId: result.providerTrxId ?? null,
        },
      });
      await this.lifecycle.activate(
        invoice.farmId,
        invoice.subscriptionPlanId,
        invoice.billingPeriod,
      );

      // REF-02: only a real (gateway-paid, > ৳0) invoice is a qualifying
      // conversion — a ৳0 invoice never reaches this path. Best-effort;
      // never fails the payment finalize (see ReferralService.accrueOnFirstPaidInvoice).
      if (invoice.total.gt(0)) {
        await this.referrals.accrueOnFirstPaidInvoice(
          invoice.farmId,
          invoice.id,
        );
      }

      const actorUserId = await this.farmOwnerId(invoice.farmId);
      if (actorUserId) {
        await this.audit.record({
          actorUserId,
          action: AuditAction.PAYMENT_COMPLETED,
          entityType: 'Payment',
          entityId: payment.id,
          farmId: invoice.farmId,
          metadata: {
            trxId: result.providerTrxId,
            amount: invoice.total.toNumber(),
          },
        });
        await this.audit.record({
          actorUserId,
          action: AuditAction.INVOICE_PAID,
          entityType: 'Invoice',
          entityId: invoice.id,
          farmId: invoice.farmId,
          metadata: { total: invoice.total.toNumber() },
        });
      }

      // Receipt PDF emailed on payment (TAX-03); best-effort, never throws — and
      // idempotent-safe because the invoice only reaches here on the first flip.
      await this.receipts.emailReceipt(invoice.id);
      return { status: 'PAID' };
    }

    if (!amountOk) {
      this.log.error(
        'Payment amount mismatch — refusing to mark PAID',
        undefined,
        {
          invoiceId: invoice.id,
          expected: invoice.total.toNumber(),
          got: result.amount,
        },
      );
    }
    await this.failPayment(payment.id, invoice);
    return { status: 'FAILED' };
  }

  /**
   * Refund a paid, gateway-backed invoice (RAKHAL-221 promised this, never
   * wired up until 223 needed a real REF-05 clawback trigger). Owner-only
   * (billing.controller). Idempotent — a repeat call on an already-REFUNDED
   * invoice is a no-op. Flips the invoice `REFUNDED`, audits it, then claws
   * back any referral commission it triggered (REF-05).
   */
  async refundInvoice(
    farmId: string,
    invoiceId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<PublicInvoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, farmId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.REFUNDED) return this.present(invoice);
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new NotFoundException('Only a paid invoice can be refunded');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { invoiceId, status: PaymentStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment?.providerPaymentId) {
      throw new NotFoundException(
        'No completed gateway payment found for this invoice',
      );
    }

    await this.provider.refund({
      providerPaymentId: payment.providerPaymentId,
      amount: invoice.total.toNumber(),
      reason,
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.REFUNDED },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED },
      }),
    ]);

    await this.audit.record({
      actorUserId,
      action: AuditAction.REFUND_ISSUED,
      entityType: 'Invoice',
      entityId: invoice.id,
      farmId,
      metadata: { amount: invoice.total.toNumber(), reason: reason ?? null },
    });

    await this.referrals.clawback(invoice.id, actorUserId);

    return this.present(updated);
  }

  private async failPayment(
    paymentId: string,
    invoice: Invoice,
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED },
    });
    if (invoice.status !== InvoiceStatus.PAID) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.FAILED },
      });
    }
    const actorUserId = await this.farmOwnerId(invoice.farmId);
    if (actorUserId) {
      await this.audit.record({
        actorUserId,
        action: AuditAction.PAYMENT_FAILED,
        entityType: 'Payment',
        entityId: paymentId,
        farmId: invoice.farmId,
      });

      // Payment-failed email (RAKHAL-238, COM-01) — idempotent on the payment id
      // so a retried finalize can't re-notify. Best-effort.
      const owner = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: { email: true, name: true },
      });
      if (owner) {
        await this.txEmail
          .sendOnce({
            idempotencyKey: `payment_failed:${paymentId}`,
            to: owner.email,
            subject: 'Your Rakhal payment could not be completed',
            template: EmailTemplate.PAYMENT_FAILED,
            templateData: {
              name: owner.name,
              amount: `${invoice.currency} ${invoice.total.toFixed(2)}`,
            },
            tenantId: invoice.farmId,
            farmId: invoice.farmId,
            userId: actorUserId,
          })
          .catch(() => undefined);
      }
    }
  }

  /** ৳0 (coupon/wallet-credit/Free) → PAID with no gateway round-trip, still audited (PAY-07). */
  private buildInvoiceData(p: {
    farmId: string;
    subscriptionPlanId: string;
    billingPeriod: BillingPeriod;
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    couponId: string | null;
    referralCreditApplied: Prisma.Decimal;
    invoiceNumber: string;
    idempotencyKey: string;
  }): Prisma.InvoiceCreateInput {
    const total = computeGrandTotal(
      p.subtotal,
      p.discountTotal,
      p.taxAmount,
      p.referralCreditApplied,
    );
    const isFree = total.isZero();
    return {
      farmId: p.farmId,
      subscriptionPlanId: p.subscriptionPlanId,
      billingPeriod: p.billingPeriod,
      currency: 'BDT',
      subtotal: p.subtotal,
      discountTotal: p.discountTotal,
      referralCreditApplied: p.referralCreditApplied,
      taxRate: p.taxRate,
      taxAmount: p.taxAmount,
      invoiceNumber: p.invoiceNumber,
      // Seller identity snapshotted at issue time (TAX-04 — a later config change
      // never mutates a past receipt).
      sellerName: env.INVOICE_SELLER_NAME,
      sellerAddress: env.INVOICE_SELLER_ADDRESS,
      sellerBin: env.INVOICE_SELLER_BIN ?? null,
      placeOfSupply: env.INVOICE_PLACE_OF_SUPPLY,
      total,
      couponId: p.couponId,
      status: isFree ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
      idempotencyKey: p.idempotencyKey,
      paidAt: isFree ? new Date() : null,
    };
  }

  /** `GET /billing/invoices/:id/receipt` — the tax-ready receipt PDF (TAX-03). */
  getReceipt(farmId: string, invoiceId: string): Promise<RenderedReceipt> {
    return this.receipts.renderForDownload(farmId, invoiceId);
  }

  /**
   * `POST /billing/checkout/preview` — non-mutating price preview for the
   * upgrade modal's coupon stage. Reuses the exact subtotal computation
   * `checkout()` uses, and `CouponService.preview` for validation/pricing
   * (identical rules to `reserve`, no seat decrement). The Rakhal Credit
   * portion is a **read-only estimate** (current balance, not spent) — the
   * real `checkout()` is the only place credit actually moves.
   */
  async previewCheckout(
    farmId: string,
    userId: string,
    dto: PreviewCheckoutDto,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const subtotal =
      dto.billingPeriod === BillingPeriod.YEARLY
        ? (plan.yearlyPrice ?? plan.monthlyPrice.times(12))
        : plan.monthlyPrice;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true },
    });

    const { discount } = await this.coupons.preview({
      code: dto.couponCode,
      farmId,
      planId: plan.id,
      subtotal,
      phoneVerifiedAt: user?.phoneVerifiedAt ?? null,
    });

    const vatRate = new Prisma.Decimal(env.VAT_ENABLED ? env.VAT_RATE : 0);
    const netAfterDiscount = clampNonNegative(subtotal.minus(discount));
    const taxAmount = computeTax(netAfterDiscount, vatRate);
    const grossWithTax = netAfterDiscount.plus(taxAmount);

    const walletBalance = await this.creditWallet.getBalance(farmId);
    const estimatedCreditApplied = Prisma.Decimal.min(
      walletBalance,
      grossWithTax,
    );
    const total = computeGrandTotal(
      subtotal,
      discount,
      taxAmount,
      estimatedCreditApplied,
    );

    return {
      plan_id: plan.id,
      billing_period: dto.billingPeriod,
      currency: 'BDT',
      subtotal: subtotal.toNumber(),
      discount_total: discount.toNumber(),
      estimated_credit_applied: estimatedCreditApplied.toNumber(),
      tax_rate: vatRate.toNumber(),
      tax_amount: taxAmount.toNumber(),
      total: total.toNumber(),
    };
  }

  /** `PATCH /billing/profile` — the mandatory profile-completion step gating Free-plan checkout. */
  async updateProfile(farmId: string, dto: UpdateBillingProfileDto) {
    const updated = await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        phone: dto.phone,
        address: dto.address,
        ...(dto.farm_name ? { name: dto.farm_name } : {}),
      },
      select: { id: true, name: true, phone: true, address: true },
    });
    return {
      farm_id: updated.id,
      farm_name: updated.name,
      phone: updated.phone,
      address: updated.address,
    };
  }

  /**
   * Schedule a downgrade/lateral plan change (RFE-036 follow-up, PAY-08). Never charges and never
   * creates an Invoice/Payment — the switch only takes effect at the current period's `expiresAt`,
   * applied by `SubscriptionLifecycleService.runExpirySweep`. Rejects an equal-or-higher-priced
   * target (that must go through the real `checkout()` — it needs a charge, this endpoint is
   * deliberately free-of-charge and would otherwise be a way to sneak an unpaid upgrade).
   */
  async scheduleDowngrade(
    farmId: string,
    userId: string,
    dto: ScheduleDowngradeDto,
  ): Promise<PublicSubscriptionSchedule> {
    const current = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
    if (!current || current.status !== 'ACTIVE' || !current.expiresAt) {
      throw new BadRequestException(
        'No active subscription to schedule a change against',
      );
    }

    const [currentPlan, targetPlan] = await Promise.all([
      this.prisma.subscriptionPlan.findUnique({
        where: { id: current.subscriptionPlanId },
      }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (!targetPlan) throw new NotFoundException('Subscription plan not found');
    if (!currentPlan) {
      throw new NotFoundException('Current subscription plan not found');
    }

    if (targetPlan.monthlyPrice.gte(currentPlan.monthlyPrice)) {
      throw new BadRequestException(
        'Use checkout for an upgrade or same-tier plan',
      );
    }

    const updated = await this.prisma.farmSubscription.update({
      where: { id: current.id },
      data: {
        pendingPlanId: targetPlan.id,
        pendingBillingPeriod: dto.billingPeriod,
        pendingScheduledBy: userId,
      },
    });

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.SUBSCRIPTION_DOWNGRADE_SCHEDULED,
      entityType: 'FarmSubscription',
      entityId: updated.id,
      farmId,
      metadata: {
        targetPlanId: targetPlan.id,
        effectiveAt: current.expiresAt.toISOString(),
      },
    });

    return {
      pending_plan_id: targetPlan.id,
      pending_plan_name: targetPlan.name,
      pending_billing_period: dto.billingPeriod,
      effective_at: current.expiresAt.toISOString(),
    };
  }

  /** Cancel a previously-scheduled downgrade (RFE-036 follow-up). Idempotent — a no-op if nothing
   * is scheduled, since there's nothing sensitive to leak by that (already farm-scoped). */
  async cancelScheduledDowngrade(
    farmId: string,
    userId: string,
  ): Promise<void> {
    const current = await this.prisma.farmSubscription.findFirst({
      where: { farmId, pendingPlanId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (!current) return;

    await this.prisma.farmSubscription.update({
      where: { id: current.id },
      data: {
        pendingPlanId: null,
        pendingBillingPeriod: null,
        pendingScheduledBy: null,
      },
    });

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.SUBSCRIPTION_DOWNGRADE_CANCELLED,
      entityType: 'FarmSubscription',
      entityId: current.id,
      farmId,
    });
  }

  private async farmOwnerId(farmId: string): Promise<string | null> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { ownerId: true },
    });
    return farm?.ownerId ?? null;
  }

  private present(invoice: Invoice): PublicInvoice {
    return {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      plan_id: invoice.subscriptionPlanId,
      billing_period: invoice.billingPeriod,
      currency: invoice.currency,
      subtotal: invoice.subtotal.toNumber(),
      discount_total: invoice.discountTotal.toNumber(),
      referral_credit_applied: (
        invoice.referralCreditApplied ?? new Prisma.Decimal(0)
      ).toNumber(),
      tax_rate: invoice.taxRate.toNumber(),
      tax_amount: invoice.taxAmount.toNumber(),
      total: invoice.total.toNumber(),
      status: invoice.status,
      paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      created_at: invoice.createdAt.toISOString(),
    };
  }
}
