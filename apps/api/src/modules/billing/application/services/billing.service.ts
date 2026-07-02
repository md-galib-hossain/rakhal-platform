import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { computeInvoiceTotal } from '../../domain/money';
import {
  PAYMENT_PROVIDER,
  type PaymentExecutionResult,
  type PaymentProvider,
} from '../ports/payment-provider.port';
import { CheckoutDto } from '../../presentation/dto/checkout.dto';
import { ListInvoiceQueryDto } from '../../presentation/dto/list-invoice-query.dto';

export interface PublicInvoice {
  id: string;
  plan_id: string;
  billing_period: BillingPeriod;
  currency: string;
  subtotal: number;
  discount_total: number;
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

    // Total computed here — the client never sends an amount (PAY-01).
    const subtotal =
      dto.billingPeriod === BillingPeriod.YEARLY
        ? (plan.yearlyPrice ?? plan.monthlyPrice.times(12))
        : plan.monthlyPrice;
    const discountTotal = new Prisma.Decimal(0); // coupon (222) / referral (223) seams
    const total = computeInvoiceTotal(subtotal, discountTotal);
    const isFree = total.isZero();

    const invoice = await this.prisma.invoice.create({
      data: {
        farmId,
        subscriptionPlanId: plan.id,
        billingPeriod: dto.billingPeriod,
        currency: 'BDT',
        subtotal,
        discountTotal,
        total,
        status: isFree ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        idempotencyKey: key,
        paidAt: isFree ? new Date() : null,
      },
    });
    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.INVOICE_CREATED,
      entityType: 'Invoice',
      entityId: invoice.id,
      farmId,
      metadata: { total: total.toNumber(), status: invoice.status },
    });

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

    // Initiate with the gateway when one is configured (bKash, RAKHAL-221).
    if (this.provider.isConfigured()) {
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
    }
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
      plan_id: invoice.subscriptionPlanId,
      billing_period: invoice.billingPeriod,
      currency: invoice.currency,
      subtotal: invoice.subtotal.toNumber(),
      discount_total: invoice.discountTotal.toNumber(),
      total: invoice.total.toNumber(),
      status: invoice.status,
      paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      created_at: invoice.createdAt.toISOString(),
    };
  }
}
