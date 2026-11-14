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
  /**
   * Launch kill switch: when false, `accrueOnFirstPaidInvoice` still records
   * the referral + a commission row (nothing lost), but never credits the
   * wallet — every commission lands `PENDING` regardless of flagging, same
   * as the existing held/flagged path. Flip once RD-025/RD-026's admin
   * review surface exists, or anti-fraud is trusted enough to auto-pay.
   */
  creditingEnabled: boolean;
}

export const DEFAULT_REFERRAL_PROGRAM: ReferralProgramConfig = {
  rewardAmount: new Prisma.Decimal(200),
  velocityCapPerWindow: 10,
  velocityWindowHours: 24,
  creditingEnabled: false,
};
