import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { env } from 'src/core/config/env';
import { EmailService } from 'src/modules/email/application/services/email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import { renderPdf } from 'src/modules/reports/domain/pdf-renderer';
import { buildReceiptReportData, ReceiptInput } from '../../domain/receipt-pdf';

export interface RenderedReceipt {
  fileName: string;
  buffer: Buffer;
  invoiceNumber: string;
}

/**
 * Tax-ready receipt/invoice PDF (RAKHAL-237, PRD §36.2). Renders the paid invoice
 * with the **Reports PDF renderer** (TAX-03) off the fields snapshotted on the
 * invoice at issue time, and — best-effort — emails it to the farm owner on
 * payment. Kept separate from `BillingService` so the money paths stay lean and a
 * receipt-render/email failure can never break a checkout or a payment finalize.
 */
@Injectable()
export class ReceiptService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReceiptService.name);
  }

  /** In-app download (`GET /billing/invoices/:id/receipt`) — farm-scoped, PAID/REFUNDED only. */
  async renderForDownload(
    farmId: string,
    invoiceId: string,
  ): Promise<RenderedReceipt> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, farmId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (
      invoice.status !== InvoiceStatus.PAID &&
      invoice.status !== InvoiceStatus.REFUNDED
    ) {
      throw new NotFoundException(
        'A receipt is only available for a paid invoice',
      );
    }
    return this.render(invoice);
  }

  /** Email the receipt PDF to the farm owner on payment (best-effort — never throws). */
  async emailReceipt(invoiceId: string): Promise<void> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) return;

      const farm = await this.prisma.farm.findUnique({
        where: { id: invoice.farmId },
        select: { name: true, owner: { select: { email: true, name: true } } },
      });
      const to = farm?.owner?.email;
      if (!to) {
        this.log.warn('No owner email for receipt — skipping', { invoiceId });
        return;
      }

      const receipt = await this.render(invoice, farm.name ?? undefined);

      await this.email.queue({
        to,
        subject: `Your Rakhal payment receipt ${receipt.invoiceNumber}`,
        template: EmailTemplate.PAYMENT_RECEIPT,
        templateData: {
          receiptId: receipt.invoiceNumber,
          name: farm?.owner?.name ?? farm?.name ?? 'there',
          total: `${invoice.currency} ${invoice.total.toFixed(2)}`,
        },
        tenantId: invoice.farmId,
        farmId: invoice.farmId,
        userId: null,
        correlationId: randomUUID(),
        attachments: [
          {
            filename: receipt.fileName,
            contentBase64: receipt.buffer.toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (err) {
      // A receipt email must never fail the payment that triggered it (COM-02).
      this.log.error('Failed to email payment receipt', err, { invoiceId });
    }
  }

  private async render(
    invoice: Invoice,
    farmName?: string,
  ): Promise<RenderedReceipt> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: invoice.subscriptionPlanId },
      select: { name: true },
    });
    const buyerName =
      farmName ??
      (
        await this.prisma.farm.findUnique({
          where: { id: invoice.farmId },
          select: { name: true },
        })
      )?.name ??
      invoice.farmId;

    // Older invoices (pre-237) have no snapshot number — fall back to the id so a
    // legacy receipt still renders deterministically.
    const invoiceNumber = invoice.invoiceNumber ?? invoice.id;

    const input: ReceiptInput = {
      invoiceNumber,
      planName: plan?.name ?? 'Subscription',
      billingPeriod: invoice.billingPeriod,
      buyerName,
      sellerName: invoice.sellerName ?? env.INVOICE_SELLER_NAME,
      sellerAddress: invoice.sellerAddress ?? env.INVOICE_SELLER_ADDRESS,
      sellerBin: invoice.sellerBin ?? env.INVOICE_SELLER_BIN ?? null,
      placeOfSupply: invoice.placeOfSupply ?? env.INVOICE_PLACE_OF_SUPPLY,
      currency: invoice.currency,
      subtotal: invoice.subtotal.toNumber(),
      discountTotal: invoice.discountTotal.toNumber(),
      referralCreditApplied: (
        invoice.referralCreditApplied ?? new Prisma.Decimal(0)
      ).toNumber(),
      taxRate: invoice.taxRate.toNumber(),
      taxAmount: invoice.taxAmount.toNumber(),
      total: invoice.total.toNumber(),
      status: invoice.status,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      issuedAt: invoice.createdAt.toISOString(),
    };

    const buffer = await renderPdf(buildReceiptReportData(input));
    return {
      fileName: `receipt-${invoiceNumber}.pdf`,
      buffer: Buffer.from(buffer),
      invoiceNumber,
    };
  }
}
