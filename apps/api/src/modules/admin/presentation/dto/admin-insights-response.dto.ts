import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '@prisma/client';
import type { AdminAnalyticsService } from '../../application/services/admin-analytics.service';
import type { AdminInsightsService } from '../../application/services/admin-insights.service';
import { AdminDayCountDto } from './admin-directory-response.dto';

/**
 * Documented response shapes for admin analytics and insights (`GET /admin/analytics/usage`,
 * `/admin/analytics/engagement`, `/admin/security/overview`, admin-api, RD-140). Each class mirrors what
 * `AdminAnalyticsService` / `AdminInsightsService` return and is pinned to it by a compile-time guard at the
 * bottom of this file. `Date` fields are ISO-8601 strings on the wire. The CSV export route is a file
 * download and deliberately not documented here.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const COUNT_MAP = {
  type: 'object',
  additionalProperties: { type: 'number' },
} as const;
const RATE = {
  type: Number,
  nullable: true,
  description: 'Ratio 0..1, or null when the base is empty.',
} as const;

// ─── Usage ──────────────────────────────────────────────────────────────────

export class AdminUsagePlanCountsDto {
  @ApiProperty() plan!: string;
  @ApiProperty({ ...COUNT_MAP, description: 'Subscription counts by status.' })
  counts!: Record<string, number>;
}

export class AdminUsageSubscriptionsDto {
  @ApiProperty({ type: () => [AdminUsagePlanCountsDto] })
  byPlan!: AdminUsagePlanCountsDto[];
}

export class AdminUsageMrrDto {
  @ApiProperty() listPriceBdt!: number;
}

export class AdminUsageRevenueDto {
  @ApiProperty() windowDays!: number;
  @ApiProperty() paidInvoices!: number;
  @ApiProperty() totalBdt!: number;
}

export class AdminUsageActiveFarmsDto {
  @ApiProperty() last7Days!: number;
  @ApiProperty() last30Days!: number;
}

export class AdminUsageExpiringDto {
  @ApiProperty() farmId!: string;
  @ApiProperty() farm!: string;
  @ApiProperty() plan!: string;
  @ApiProperty() status!: string;
  @ApiProperty(DATE_TIME) expiresAt!: Date;
}

/** GET /admin/analytics/usage. */
export class AdminUsageResponseDto {
  @ApiProperty(DATE_TIME) generatedAt!: string;
  @ApiProperty({ type: () => AdminUsageSubscriptionsDto })
  subscriptions!: AdminUsageSubscriptionsDto;
  @ApiProperty({ type: () => AdminUsageMrrDto }) mrr!: AdminUsageMrrDto;
  @ApiProperty({ type: () => AdminUsageRevenueDto })
  revenue!: AdminUsageRevenueDto;
  @ApiProperty({ type: () => AdminUsageActiveFarmsDto })
  activeFarms!: AdminUsageActiveFarmsDto;
  @ApiProperty({ type: () => [AdminUsageExpiringDto] })
  expiring!: AdminUsageExpiringDto[];
}

// ─── Engagement ─────────────────────────────────────────────────────────────

export class AdminEngagementActiveDto {
  @ApiProperty() daily!: number;
  @ApiProperty() weekly!: number;
  @ApiProperty() monthly!: number;
}

export class AdminEngagementUsersDto {
  @ApiProperty() total!: number;
  @ApiProperty({ type: () => AdminEngagementActiveDto })
  active!: AdminEngagementActiveDto;
  @ApiProperty(RATE) stickiness!: number | null;
  @ApiProperty() returning!: number;
  @ApiProperty() dormant!: number;
}

export class AdminEngagementActivationDto {
  @ApiProperty() windowDays!: number;
  @ApiProperty() signedUp!: number;
  @ApiProperty() activated!: number;
  @ApiProperty(RATE) rate!: number | null;
  @ApiProperty() neverActivated!: number;
  @ApiProperty({ type: Number, nullable: true })
  medianHoursToFirstRecord!: number | null;
}

export class AdminRetentionCohortDto {
  @ApiProperty() base!: number;
  @ApiProperty() kept!: number;
  @ApiProperty(RATE) rate!: number | null;
}

export class AdminEngagementRetentionDto {
  @ApiProperty({ type: () => AdminRetentionCohortDto })
  d7!: AdminRetentionCohortDto;
  @ApiProperty({ type: () => AdminRetentionCohortDto })
  d30!: AdminRetentionCohortDto;
}

export class AdminEngagementFarmsDto {
  @ApiProperty() total!: number;
  @ApiProperty() withRecordsLast30Days!: number;
  @ApiProperty() everRecorded!: number;
  @ApiProperty(RATE) shareWithRecordsLast30Days!: number | null;
}

export class AdminEngagementRecordsDto {
  @ApiProperty() cattleTracked!: number;
  @ApiProperty() last30Days!: number;
}

export class AdminEngagementModuleDto {
  @ApiProperty() module!: string;
  @ApiProperty() farms!: number;
  @ApiProperty() records!: number;
  @ApiProperty(RATE) shareOfActiveFarms!: number | null;
}

export class AdminGeoDivisionDto {
  @ApiProperty() farms!: number;
  @ApiProperty() cattle!: number;
  @ApiProperty() name!: string;
}

export class AdminGeoDistrictDto {
  @ApiProperty({ type: String, nullable: true }) division!: string | null;
  @ApiProperty() district!: string;
  @ApiProperty() farms!: number;
}

export class AdminEngagementGeographyDto {
  @ApiProperty() unspecifiedFarms!: number;
  @ApiProperty({ type: () => [AdminGeoDivisionDto] })
  divisions!: AdminGeoDivisionDto[];
  @ApiProperty({ type: () => [AdminGeoDistrictDto] })
  districts!: AdminGeoDistrictDto[];
}

/** GET /admin/analytics/engagement. */
export class AdminEngagementResponseDto {
  @ApiProperty(DATE_TIME) generatedAt!: string;
  @ApiProperty({ type: () => AdminEngagementUsersDto })
  users!: AdminEngagementUsersDto;
  @ApiProperty({ type: () => AdminEngagementActivationDto })
  activation!: AdminEngagementActivationDto;
  @ApiProperty({ type: () => AdminEngagementRetentionDto })
  retention!: AdminEngagementRetentionDto;
  @ApiProperty({ type: () => AdminEngagementFarmsDto })
  farms!: AdminEngagementFarmsDto;
  @ApiProperty({ type: () => AdminEngagementRecordsDto })
  records!: AdminEngagementRecordsDto;
  @ApiProperty({ type: () => [AdminEngagementModuleDto] })
  modules!: AdminEngagementModuleDto[];
  @ApiProperty({ type: () => [AdminDayCountDto] })
  dailyActiveUsers!: AdminDayCountDto[];
  @ApiProperty({ type: () => AdminEngagementGeographyDto })
  geography!: AdminEngagementGeographyDto;
}

// ─── Security overview ──────────────────────────────────────────────────────

export class AdminSecurityCountsDto {
  @ApiProperty() activeSessions!: number;
  @ApiProperty() signIns24h!: number;
  @ApiProperty() signIns7d!: number;
  @ApiProperty() usersWithFailedAttempts24h!: number;
  @ApiProperty() lockedNow!: number;
  @ApiProperty() blocked!: number;
  @ApiProperty() adminFailedLogins24h!: number;
}

export class AdminSecurityUserRefDto {
  @ApiProperty() name!: string;
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
}

export class AdminSecurityRecentSignInDto {
  @ApiProperty({ enum: SessionStatus, enumName: 'SessionStatus' })
  status!: SessionStatus;
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceName!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastUsedAt!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({ type: () => AdminSecurityUserRefDto })
  user!: AdminSecurityUserRefDto;
}

export class AdminSecurityAttentionUserDto {
  @ApiProperty() name!: string;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() failedLoginAttempts!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  lastFailedLoginAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lockedUntil!: Date | null;
}

export class AdminSecurityMultiLocationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() distinctIps!: number;
}

export class AdminSecurityAdminFailedLoginDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({ type: String, nullable: true }) actorEmail!: string | null;
}

/** GET /admin/security/overview. Read-only aggregates; no credentials or tokens. */
export class AdminSecurityOverviewResponseDto {
  @ApiProperty(DATE_TIME) generatedAt!: string;
  @ApiProperty({ type: () => AdminSecurityCountsDto })
  counts!: AdminSecurityCountsDto;
  @ApiProperty({ type: () => [AdminSecurityRecentSignInDto] })
  recentSignIns!: AdminSecurityRecentSignInDto[];
  @ApiProperty({ type: () => [AdminSecurityAttentionUserDto] })
  needsAttention!: AdminSecurityAttentionUserDto[];
  @ApiProperty({ type: () => [AdminSecurityMultiLocationDto] })
  multiLocation!: AdminSecurityMultiLocationDto[];
  @ApiProperty({ type: () => [AdminSecurityAdminFailedLoginDto] })
  adminFailedLogins!: AdminSecurityAdminFailedLoginDto[];
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Out<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;

export type AdminInsightsShapeGuards = [
  Assert<Same<Out<AdminAnalyticsService['usage']>, AdminUsageResponseDto>>,
  Assert<
    Same<Out<AdminInsightsService['engagement']>, AdminEngagementResponseDto>
  >,
  Assert<
    Same<
      Out<AdminInsightsService['security']>,
      AdminSecurityOverviewResponseDto
    >
  >,
];
