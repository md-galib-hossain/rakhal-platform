import { CreatePurchaseLineDto } from './create-purchase-line.dto';
export declare class CreatePurchaseDto {
    supplierId?: string;
    purchaseDate: string;
    notes?: string;
    lines: CreatePurchaseLineDto[];
    paidAmount?: number;
    financialAccountId?: string;
    dueDate?: string;
}
