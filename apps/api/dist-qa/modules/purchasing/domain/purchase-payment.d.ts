import { PayableStatus } from './payable-status';
export interface PurchasePayableFigures {
    totalAmount: string | number;
    dueDate: Date | null;
}
export interface PurchasePayment {
    paymentStatus: PayableStatus | null;
    outstanding: string;
    paidAmount: string;
}
export declare function derivePurchasePayment(totalAmount: string | number, voided: boolean, payable: PurchasePayableFigures | null, allocated: string | number, now?: Date): PurchasePayment;
