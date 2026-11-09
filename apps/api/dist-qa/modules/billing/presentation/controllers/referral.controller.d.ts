import { ReferralService } from '../../application/services/referral.service';
export declare class ReferralController {
    private readonly referrals;
    constructor(referrals: ReferralService);
    getMine(farmId: string, userId: string): Promise<import("../../application/services/referral.service").ReferralSummary>;
    commissions(farmId: string): Promise<{
        id: string;
        referred_farm_id: string;
        reward_type: import("@prisma/client").$Enums.CommissionRewardType;
        amount: number;
        status: import("@prisma/client").$Enums.CommissionStatus;
        created_at: string;
        clawed_back_at: string | null;
    }[]>;
}
