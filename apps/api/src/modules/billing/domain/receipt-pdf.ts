import { ReceiptReportData } from './receipt-pdf-renderer';

/** The fields a receipt needs — snapshotted off the paid Invoice + its context. */
export interface ReceiptInput {
  invoiceNumber: string;
  planName: string;
  billingPeriod: string;
  buyerName: string;
  sellerName: string;
  sellerAddress: string;
  sellerBin: string | null;
  placeOfSupply: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  referralCreditApplied: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  paidAt: string | null;
  issuedAt: string;
}

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Build a receipt as the renderer-agnostic {@link ReportData} used by the Reports
 * engine, so we render it with the exact same `renderPdf` (TAX-03 — "reuse the
 * Reports renderer"). Header carries seller/buyer identity + the sequential
 * number; the table is the line-item breakdown down to the amount paid.
 */
export function buildReceiptReportData(input: ReceiptInput): ReceiptReportData {
  const summary = [
    { label: 'Receipt No', value: input.invoiceNumber },
    { label: 'Status', value: input.status },
    { label: 'Issued', value: input.paidAt ?? input.issuedAt },
    { label: 'Seller', value: input.sellerName },
    { label: 'Seller Address', value: input.sellerAddress },
    ...(input.sellerBin
      ? [{ label: 'Seller BIN', value: input.sellerBin }]
      : []),
    { label: 'Billed To', value: input.buyerName },
    { label: 'Place of Supply', value: input.placeOfSupply },
  ];

  const rows: (string | number)[][] = [
    [
      `${input.planName} subscription (${input.billingPeriod.toLowerCase()})`,
      money(input.currency, input.subtotal),
    ],
  ];
  if (input.discountTotal > 0) {
    rows.push(['Discount', `- ${money(input.currency, input.discountTotal)}`]);
  }
  if (input.referralCreditApplied > 0) {
    rows.push([
      'Rakhal Credit applied',
      `- ${money(input.currency, input.referralCreditApplied)}`,
    ]);
  }
  if (input.taxAmount > 0) {
    rows.push([
      `VAT (${input.taxRate}%)`,
      money(input.currency, input.taxAmount),
    ]);
  }
  rows.push(['Total paid', money(input.currency, input.total)]);

  return {
    title: 'Payment Receipt',
    period: `Invoice ${input.invoiceNumber}`,
    summary,
    columns: ['Description', 'Amount'],
    rows,
  };
}
