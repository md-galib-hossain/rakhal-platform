import { FinancialAccountType, MfsProvider } from '@prisma/client';
export declare class CreateBankAccountDetailDto {
    bankName: string;
    accountNumber: string;
    branch?: string;
}
export declare class CreateMfsAccountDetailDto {
    provider: MfsProvider;
    phoneNumber: string;
    accountType?: string;
}
export declare class CreateFinancialAccountDto {
    name: string;
    type: FinancialAccountType;
    currency?: string;
    openingBalance?: number;
    bankDetail?: CreateBankAccountDetailDto;
    mfsDetail?: CreateMfsAccountDetailDto;
}
