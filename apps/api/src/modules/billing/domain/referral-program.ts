import { Prisma } from '@prisma/client';

/**
 * Referral program parameters (RAKHAL-223, PRD §33.2/§33.3). REF-08 makes
 * this platform-admin-managed — deferred until `PlatformAdminGuard` exists
 * (RAKHAL-224/225, RD-025); these are the built-in launch defaults, mirroring
 * the AQR admin-config seam (`AqrConfigService`).
 */
export interface ReferralProgramConfig {
  /** Flat ৳ credited to the referrer on the referred farm's first paid invoice. */
  rewardAmount: Prisma.Decimal;
  /** Referrals bound by one code faster than this many per window get flagged for review (REF-04). */
  velocityCapPerWindow: number;
  velocityWindowHours: number;
}

export const DEFAULT_REFERRAL_PROGRAM: ReferralProgramConfig = {
  rewardAmount: new Prisma.Decimal(200),
  velocityCapPerWindow: 10,
  velocityWindowHours: 24,
};
