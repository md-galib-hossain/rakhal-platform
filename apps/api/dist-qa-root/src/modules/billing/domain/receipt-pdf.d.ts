import { ReceiptReportData } from './receipt-pdf-renderer';
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
export declare function buildReceiptReportData(input: ReceiptInput): ReceiptReportData;
