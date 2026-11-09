import { BalanceService } from '../../application/balance.service';
export declare class BalanceController {
    private readonly balance;
    constructor(balance: BalanceService);
    getRakhalBalance(farmId: string): Promise<import("../../application/balance.service").RakhalBalanceResult>;
}
