import { MfsProvider } from '@prisma/client';
export declare class UpdateBankAccountDetailDto {
    bankName?: string;
    accountNumber?: string;
    branch?: string;
}
export declare class UpdateMfsAccountDetailDto {
    provider?: MfsProvider;
    phoneNumber?: string;
    accountType?: string;
}
export declare class UpdateFinancialAccountDto {
    name?: string;
    bankDetail?: UpdateBankAccountDetailDto;
    mfsDetail?: UpdateMfsAccountDetailDto;
}
