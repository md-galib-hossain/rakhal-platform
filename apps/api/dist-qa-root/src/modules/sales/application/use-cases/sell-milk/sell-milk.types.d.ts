import { FinancePayment, PaymentMethod, Receivable } from '@prisma/client';
import { SaleWithLines } from '../../sale.service';
export interface SellMilkInput {
    volumeL: number;
    pricePerLitre: number;
    customerId?: string | null;
    saleDate?: string;
    description?: string;
    notes?: string;
    dueDate?: Date | null;
    amountReceived?: number;
    financialAccountId?: string;
    paymentMethod?: PaymentMethod;
    referenceNumber?: string;
}
export interface SellMilkResult {
    sale: SaleWithLines;
    receivable: Receivable;
    payment: FinancePayment | null;
    tankUpdated: boolean;
}
