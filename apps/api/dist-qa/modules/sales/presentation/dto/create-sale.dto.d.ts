import { CreateSaleLineDto } from './create-sale-line.dto';
export declare class CreateSaleDto {
    customerId?: string;
    saleDate: string;
    discountAmount?: number;
    notes?: string;
    lines: CreateSaleLineDto[];
}
