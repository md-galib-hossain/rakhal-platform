import { FinancialAccountService } from '../../application/financial-account.service';
import { CreateFinancialAccountDto } from '../dto/create-financial-account.dto';
import { SetOpeningBalanceDto } from '../dto/set-opening-balance.dto';
import { UpdateFinancialAccountDto } from '../dto/update-financial-account.dto';
export declare class FinancialAccountController {
    private readonly accounts;
    constructor(accounts: FinancialAccountService);
    create(farmId: string, userId: string, dto: CreateFinancialAccountDto): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    findAll(farmId: string): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail[]>;
    farmAccount(farmId: string, userId: string): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    findOne(farmId: string, id: string): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    update(farmId: string, id: string, dto: UpdateFinancialAccountDto): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    setOpeningBalance(farmId: string, id: string, userId: string, dto: SetOpeningBalanceDto): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    setPrimary(farmId: string, id: string, userId: string): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
    archive(farmId: string, id: string, userId: string): Promise<import("../../application/financial-account.service").FinancialAccountWithDetail>;
}
