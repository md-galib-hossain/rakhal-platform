import { CommissionStatus, ReferralStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { CreditWalletService } from './credit-wallet.service';
export interface ReferralSummary {
    code: string;
    active: boolean;
    wallet_balance: number;
    referred_farms: {
        farm_id: string;
        status: ReferralStatus;
        flagged: boolean;
        bound_at: string;
        qualified_at: string | null;
    }[];
}
export declare class ReferralService {
    private readonly prisma;
    private readonly audit;
    private readonly creditWallet;
    private readonly log;
    constructor(prisma: PrismaService, audit: AuditService, creditWallet: CreditWalletService, logger: LoggerService);
    getOrCreateCode(farmId: string, userId: string): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        active: boolean;
        ownerUserId: string;
    }>;
    bindReferral(referredFarmId: string, referredOwnerUserId: string, code: string): Promise<void>;
    accrueOnFirstPaidInvoice(farmId: string, invoiceId: string): Promise<void>;
    clawback(invoiceId: string, actorUserId: string): Promise<void>;
    getReferralsForFarm(farmId: string, userId: string): Promise<ReferralSummary>;
    getCommissionsForFarm(farmId: string): Promise<{
        id: string;
        referred_farm_id: string;
        reward_type: import("@prisma/client").$Enums.CommissionRewardType;
        amount: number;
        status: import("@prisma/client").$Enums.CommissionStatus;
        created_at: string;
        clawed_back_at: string | null;
    }[]>;
    listAllCommissions(status?: CommissionStatus): Promise<{
        id: string;
        referrer_farm_id: string;
        referred_farm_id: string;
        trigger_invoice_id: string;
        reward_type: import("@prisma/client").$Enums.CommissionRewardType;
        amount: number;
        status: import("@prisma/client").$Enums.CommissionStatus;
        created_at: string;
        clawed_back_at: string | null;
    }[]>;
    private farmOwnerId;
    private uniqueCode;
}
