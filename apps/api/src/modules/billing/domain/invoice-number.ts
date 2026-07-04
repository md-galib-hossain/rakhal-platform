/**
 * Single global numbering scope at launch — one continuous gapless sequence.
 * (A future fiscal-year reset would key `InvoiceCounter` by year instead.)
 */
export const INVOICE_COUNTER_SCOPE = 'invoice';

/**
 * Human-readable invoice/receipt number (RAKHAL-237, TAX-02). Pairs a config
 * prefix with the zero-padded sequential value taken from `InvoiceCounter`, e.g.
 * `INV-000001`. The number is assigned once at issue time and never reused.
 */
export function formatInvoiceNumber(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(6, '0')}`;
}
