import { PaymentMethod } from '@prisma/client';
export declare class SellAnimalDto {
    salePrice: number;
    buyerName?: string;
    buyerId?: string;
    financialAccountId?: string;
    paymentMethod?: PaymentMethod;
    amountReceived?: number;
    saleDate: string;
}
