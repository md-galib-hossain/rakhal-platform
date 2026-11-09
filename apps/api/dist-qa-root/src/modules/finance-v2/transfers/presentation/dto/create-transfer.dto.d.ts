export declare class CreateTransferDto {
    fromFinancialAccountId: string;
    toFinancialAccountId: string;
    amount: number;
    feeAmount?: number;
    transactionDate: string;
    notes?: string;
}
