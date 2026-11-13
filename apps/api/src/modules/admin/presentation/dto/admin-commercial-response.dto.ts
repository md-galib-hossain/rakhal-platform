import { ApiProperty } from '@nestjs/swagger';
import {
  CommissionRewardType,
  CommissionStatus,
  CouponStatus,
  CouponType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import type { CouponService } from 'src/modules/billing/application/services/coupon.service';
import type { ReferralService } from 'src/modules/billing/application/services/referral.service';
import type {
  PlanCatalogueService,
  PublicPlan,
} from 'src/modules/subscription/application/services/plan-catalogue.service';
import type { AdminSubscriptionsService } from '../../application/services/admin-subscriptions.service';

/**
 * Documented response shapes for admin commercial administration (plans, plan features, manual subscription
 * operations, coupons, referral commissions), admin-api, RD-140. Each class mirrors what the service returns
 * and is pinned to it by a compile-time guard at the bottom of this file. `Date` fields are ISO-8601 strings
 * and `Prisma.Decimal` money/value fields are decimal strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const MONEY = {
  type: String,
  description: 'Decimal amount as a string (never a JSON number).',
} as const;

// ─── Plans ──────────────────────────────────────────────────────────────────

export class AdminFeatureDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty() key!: string;
}

export class AdminPlanMatrixPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() monthlyPrice!: number;
  @ApiProperty({ type: Number, nullable: true }) yearlyPrice!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxCattle!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  maxFarmMembers!: number | null;
  @ApiProperty() farmCount!: number;
  @ApiProperty({ type: [String] }) enabledFeatures!: string[];
}

/** GET /admin/plans/matrix. */
export class AdminPlanMatrixResponseDto {
  @ApiProperty({ type: () => [AdminFeatureDto] }) features!: AdminFeatureDto[];
  @ApiProperty({ type: () => [AdminPlanMatrixPlanDto] })
  plans!: AdminPlanMatrixPlanDto[];
}

/** PATCH /admin/plans/:id: the plan row after the update. */
export class AdminPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty(MONEY) monthlyPrice!: Prisma.Decimal;
  @ApiProperty({ ...MONEY, nullable: true })
  yearlyPrice!: Prisma.Decimal | null;
  @ApiProperty({ type: Number, nullable: true })
  maxFarmMembers!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxCattle!: number | null;
  @ApiProperty() reportRetentionDays!: number;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

/** PUT /admin/plans/:id/features/:key. `changed` is false when the feature was already in that state. */
export class AdminPlanFeatureResponseDto {
  @ApiProperty() planId!: string;
  @ApiProperty() feature!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() changed!: boolean;
}

export class AdminPlanLimitsDto {
  @ApiProperty({ type: Number, nullable: true }) max_cattle!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  max_farm_members!: number | null;
}

/** One plan in GET /admin/plans (snake_case, as the public pricing catalogue). */
export class AdminPlanCatalogueItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() monthly_price!: number;
  @ApiProperty({ type: Number, nullable: true }) yearly_price!: number | null;
  @ApiProperty({ type: () => AdminPlanLimitsDto }) limits!: AdminPlanLimitsDto;
  @ApiProperty({ type: [String] }) features!: string[];
}

// ─── Manual subscription operations ─────────────────────────────────────────

/** POST /admin/farms/:id/subscription/{activate,comp,extend,cancel}. `changed` is false on a no-op. */
export class AdminSubscriptionActionResponseDto {
  @ApiProperty() farmId!: string;
  @ApiProperty({ description: 'Plan name.' }) plan!: string;
  @ApiProperty({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status!: SubscriptionStatus;
  @ApiProperty(DATE_TIME) startsAt!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) expiresAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) cancelledAt!: Date | null;
  @ApiProperty() changed!: boolean;
}

// ─── Coupons + referral commissions ─────────────────────────────────────────

/** A coupon (GET /admin/coupons rows; POST /admin/coupons; POST /admin/coupons/:id/disable). */
export class AdminCouponDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: CouponType, enumName: 'CouponType' })
  type!: CouponType;
  @ApiProperty(MONEY) value!: Prisma.Decimal;
  @ApiProperty() maxRedemptions!: number;
  @ApiProperty() redeemedCount!: number;
  @ApiProperty() perFarmLimit!: number;
  @ApiProperty(DATE_TIME) validFrom!: Date;
  @ApiProperty(DATE_TIME) validUntil!: Date;
  @ApiProperty({ type: [String] }) applicablePlanIds!: string[];
  @ApiProperty({ ...MONEY, nullable: true }) minSpend!: Prisma.Decimal | null;
  @ApiProperty({ enum: CouponStatus, enumName: 'CouponStatus' })
  status!: CouponStatus;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

/** One row of GET /admin/referrals/commissions (snake_case, ISO strings). */
export class AdminReferralCommissionDto {
  @ApiProperty() id!: string;
  @ApiProperty() referrer_farm_id!: string;
  @ApiProperty() referred_farm_id!: string;
  @ApiProperty() trigger_invoice_id!: string;
  @ApiProperty({ enum: CommissionRewardType, enumName: 'CommissionRewardType' })
  reward_type!: CommissionRewardType;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: CommissionStatus, enumName: 'CommissionStatus' })
  status!: CommissionStatus;
  @ApiProperty(DATE_TIME) created_at!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) clawed_back_at!: string | null;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Out<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Subs<K extends keyof AdminSubscriptionsService> = Out<
  AdminSubscriptionsService[K]
>;
type Cpn<K extends keyof CouponService> = Out<CouponService[K]>;

export type AdminCommercialShapeGuards = [
  Assert<Same<Subs<'matrix'>, AdminPlanMatrixResponseDto>>,
  Assert<Same<Subs<'updatePlan'>, AdminPlanDto>>,
  Assert<Same<Subs<'setPlanFeature'>, AdminPlanFeatureResponseDto>>,
  Assert<Same<Subs<'activate'>, AdminSubscriptionActionResponseDto>>,
  Assert<Same<Subs<'comp'>, AdminSubscriptionActionResponseDto>>,
  Assert<Same<Subs<'extend'>, AdminSubscriptionActionResponseDto>>,
  Assert<Same<Subs<'cancel'>, AdminSubscriptionActionResponseDto>>,
  Assert<Same<Out<PlanCatalogueService['listPlans']>, PublicPlan[]>>,
  Assert<Same<PublicPlan, AdminPlanCatalogueItemDto>>,
  Assert<Same<Cpn<'list'>, AdminCouponDto[]>>,
  Assert<Same<Cpn<'issue'>, AdminCouponDto>>,
  Assert<Same<Cpn<'disable'>, AdminCouponDto>>,
  Assert<
    Same<
      Out<ReferralService['listAllCommissions']>,
      AdminReferralCommissionDto[]
    >
  >,
];
