import { Prisma } from '@prisma/client';
export interface ReferralProgramConfig {
    rewardAmount: Prisma.Decimal;
    velocityCapPerWindow: number;
    velocityWindowHours: number;
    creditingEnabled: boolean;
}
export declare const DEFAULT_REFERRAL_PROGRAM: ReferralProgramConfig;
