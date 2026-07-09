import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  ReconciliationException,
  ReconciliationStatus,
  ReconciliationType,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  PAYMENT_PROVIDER,
  type PaymentExecutionResult,
  type PaymentProvider,
} from '../ports/payment-provider.port';

const DAY_MS = 24 * 60 * 60 * 1000;

interface CandidatePayment {
  id: string;
  invoiceId: string;
  farmId: string;
  providerPaymentId: string | null;
  amount: Prisma.Decimal;
  status: PaymentStatus;
}

/**
 * Payment settlement reconciliation (RAKHAL-239, PRD §36.4). A daily job that
 * treats the **gateway as the source of truth**: it re-queries every recent
 * `Payment` and, whenever the gateway disagrees with our ledger, raises an OPEN
 * `ReconciliationException` for a human to clear. It is strictly **read-only to
 * the ledger** (REC-03) — it never mutates a `Payment`/`Invoice`; a mismatch is
 * an exception to investigate, not something to auto-fix. Idempotent: the unique
 * `(paymentId, type)` means a re-run never re-raises the same exception.
 */
@Injectable()
export class ReconciliationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReconciliationService.name);
  }

  /**
   * Reconcile gateway-backed payments from the last `lookbackDays` against the
   * gateway. Returns how many were checked + flagged. Skips entirely when no
   * gateway is configured (nothing to reconcile against).
   */
  async runReconciliation(
    now: Date = new Date(),
    lookbackDays = 7,
  ): Promise<{ checked: number; flagged: number; skipped?: string }> {
    if (!this.provider.isConfigured()) {
      return { checked: 0, flagged: 0, skipped: 'no gateway configured' };
    }

    const cutoff = new Date(now.getTime() - lookbackDays * DAY_MS);
    const payments = (await this.prisma.payment.findMany({
      where: { providerPaymentId: { not: null }, createdAt: { gte: cutoff } },
      select: {
        id: true,
        invoiceId: true,
        farmId: true,
        providerPaymentId: true,
        amount: true,
        status: true,
      },
    })) as CandidatePayment[];

    let flagged = 0;

    // Duplicate detection: more than one COMPLETED payment per invoice.
    const completedByInvoice = new Map<string, string[]>();
    for (const p of payments) {
      if (p.status === PaymentStatus.COMPLETED) {
        const list = completedByInvoice.get(p.invoiceId) ?? [];
        list.push(p.id);
        completedByInvoice.set(p.invoiceId, list);
      }
    }
    for (const [invoiceId, ids] of completedByInvoice) {
      // Flag the extras (keep the first as canonical).
      for (const extraId of ids.slice(1)) {
        const p = payments.find((x) => x.id === extraId)!;
        flagged += (await this.raise({
          paymentId: p.id,
          invoiceId,
          farmId: p.farmId,
          providerPaymentId: p.providerPaymentId,
          type: ReconciliationType.DUPLICATE,
          detail: `Multiple COMPLETED payments for invoice ${invoiceId}`,
        }))
          ? 1
          : 0;
      }
    }

    // Per-payment gateway comparison.
    for (const p of payments) {
      if (!p.providerPaymentId) continue;
      let result: PaymentExecutionResult;
      try {
        result = await this.provider.queryPayment(p.providerPaymentId);
      } catch (err) {
        // A gateway hiccup isn't a discrepancy — leave it for the next run.
        this.log.warn('Reconciliation query failed; will retry next run', {
          paymentId: p.id,
          err: (err as Error).message,
        });
        continue;
      }

      const gatewayCompleted = result.status === 'COMPLETED';
      if (gatewayCompleted && p.status !== PaymentStatus.COMPLETED) {
        flagged += (await this.raise({
          paymentId: p.id,
          invoiceId: p.invoiceId,
          farmId: p.farmId,
          providerPaymentId: p.providerPaymentId,
          type: ReconciliationType.PAID_NOT_SETTLED,
          expectedAmount: p.amount,
          actualAmount: result.amount ?? null,
          detail: `Gateway reports Completed but our payment is ${p.status} (missed callback?)`,
        }))
          ? 1
          : 0;
      } else if (
        gatewayCompleted &&
        result.amount != null &&
        !new Prisma.Decimal(result.amount).equals(p.amount)
      ) {
        flagged += (await this.raise({
          paymentId: p.id,
          invoiceId: p.invoiceId,
          farmId: p.farmId,
          providerPaymentId: p.providerPaymentId,
          type: ReconciliationType.AMOUNT_MISMATCH,
          expectedAmount: p.amount,
          actualAmount: result.amount,
          detail: `Gateway amount ${result.amount} ≠ recorded ${p.amount.toString()}`,
        }))
          ? 1
          : 0;
      } else if (!gatewayCompleted && p.status === PaymentStatus.COMPLETED) {
        flagged += (await this.raise({
          paymentId: p.id,
          invoiceId: p.invoiceId,
          farmId: p.farmId,
          providerPaymentId: p.providerPaymentId,
          type: ReconciliationType.STATUS_MISMATCH,
          expectedAmount: p.amount,
          actualAmount: result.amount ?? null,
          detail: `Our payment is COMPLETED but the gateway reports ${result.status}`,
        }))
          ? 1
          : 0;
      }
    }

    this.log.info('Settlement reconciliation complete', {
      checked: payments.length,
      flagged,
    });
    return { checked: payments.length, flagged };
  }

  /** Idempotently raise an exception; returns false if one already exists (paymentId, type). */
  private async raise(input: {
    paymentId: string;
    invoiceId: string | null;
    farmId: string | null;
    providerPaymentId: string | null;
    type: ReconciliationType;
    expectedAmount?: Prisma.Decimal | null;
    actualAmount?: Prisma.Decimal | number | null;
    detail: string;
  }): Promise<boolean> {
    try {
      await this.prisma.reconciliationException.create({
        data: {
          paymentId: input.paymentId,
          invoiceId: input.invoiceId,
          farmId: input.farmId,
          providerPaymentId: input.providerPaymentId,
          type: input.type,
          expectedAmount: input.expectedAmount ?? null,
          actualAmount:
            input.actualAmount != null
              ? new Prisma.Decimal(input.actualAmount)
              : null,
          detail: input.detail,
        },
      });
      this.log.warn('Reconciliation exception raised', {
        paymentId: input.paymentId,
        type: input.type,
      });
      return true;
    } catch (err) {
      // Already flagged (unique paymentId+type) — not a new discrepancy.
      if ((err as { code?: string }).code === 'P2002') return false;
      throw err;
    }
  }

  /** `GET /admin/reconciliation` — the exception report (newest first). */
  async list(filters: {
    status?: ReconciliationStatus;
    type?: ReconciliationType;
  }) {
    const rows = await this.prisma.reconciliationException.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.present(r));
  }

  /** `POST /admin/reconciliation/:id/resolve` — human clears/ignores an exception. */
  async resolve(
    id: string,
    adminId: string,
    status: ReconciliationStatus,
    note?: string,
  ) {
    const existing = await this.prisma.reconciliationException.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Reconciliation exception not found');

    const updated = await this.prisma.reconciliationException.update({
      where: { id },
      data: {
        status,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
        resolutionNote: note ?? existing.resolutionNote,
      },
    });
    return this.present(updated);
  }

  private present(r: ReconciliationException) {
    return {
      id: r.id,
      type: r.type,
      status: r.status,
      payment_id: r.paymentId,
      invoice_id: r.invoiceId,
      farm_id: r.farmId,
      provider_payment_id: r.providerPaymentId,
      expected_amount: r.expectedAmount ? r.expectedAmount.toNumber() : null,
      actual_amount: r.actualAmount ? r.actualAmount.toNumber() : null,
      detail: r.detail,
      resolved_by_admin_id: r.resolvedByAdminId,
      resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolution_note: r.resolutionNote,
      created_at: r.createdAt.toISOString(),
    };
  }
}
