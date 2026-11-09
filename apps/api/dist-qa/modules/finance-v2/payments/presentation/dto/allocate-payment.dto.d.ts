export declare class AllocatePaymentLineDto {
    receivableId?: string;
    payableId?: string;
    amount: number;
}
export declare class AllocatePaymentDto {
    allocations: AllocatePaymentLineDto[];
}
