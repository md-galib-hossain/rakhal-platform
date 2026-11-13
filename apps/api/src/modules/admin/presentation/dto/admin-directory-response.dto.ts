import { ApiProperty } from '@nestjs/swagger';
import {
  FarmStatus,
  Language,
  SessionStatus,
  SubscriptionStatus,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { AdminDirectoryService } from '../../application/services/admin-directory.service';
import type { AdminSupportActionsService } from '../../application/services/admin-support-actions.service';

/**
 * Documented response shapes for the admin directory (`/admin/overview`, `/admin/farms*`, `/admin/users*`) and
 * the controlled support actions (`POST /admin/farms/:id/*`, `/admin/users/:id/*`), admin-api, RD-140. Each
 * class mirrors what `AdminDirectoryService` / `AdminSupportActionsService` return and is pinned to it by a
 * compile-time guard at the bottom of this file. `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const COUNT_MAP = {
  type: 'object',
  additionalProperties: { type: 'number' },
} as const;

const subscriptionStatus = {
  enum: SubscriptionStatus,
  enumName: 'SubscriptionStatus',
} as const;
const farmStatus = { enum: FarmStatus, enumName: 'FarmStatus' } as const;

// ─── Overview ───────────────────────────────────────────────────────────────

export class AdminDayCountDto {
  @ApiProperty({ description: 'UTC calendar day, `YYYY-MM-DD`.' })
  day!: string;
  @ApiProperty() count!: number;
}

export class AdminOverviewFarmsDto {
  @ApiProperty() total!: number;
  @ApiProperty(COUNT_MAP) byStatus!: Record<string, number>;
  @ApiProperty() newLast7Days!: number;
  @ApiProperty() newLast30Days!: number;
  @ApiProperty() newThisMonth!: number;
}

export class AdminOverviewUsersDto {
  @ApiProperty() total!: number;
  @ApiProperty() blocked!: number;
  @ApiProperty() newLast7Days!: number;
  @ApiProperty() newLast30Days!: number;
  @ApiProperty() newThisMonth!: number;
  @ApiProperty() activeLastDay!: number;
  @ApiProperty() activeLast30Days!: number;
}

export class AdminOverviewSubscriptionsDto {
  @ApiProperty(COUNT_MAP) byStatus!: Record<string, number>;
}

export class AdminOverviewSignupsDto {
  @ApiProperty() days!: number;
  @ApiProperty({ type: () => [AdminDayCountDto] }) farms!: AdminDayCountDto[];
  @ApiProperty({ type: () => [AdminDayCountDto] }) users!: AdminDayCountDto[];
}

/** GET /admin/overview. */
export class AdminOverviewResponseDto {
  @ApiProperty(DATE_TIME) generatedAt!: string;
  @ApiProperty({ type: () => AdminOverviewFarmsDto })
  farms!: AdminOverviewFarmsDto;
  @ApiProperty({ type: () => AdminOverviewUsersDto })
  users!: AdminOverviewUsersDto;
  @ApiProperty({ type: () => AdminOverviewSubscriptionsDto })
  subscriptions!: AdminOverviewSubscriptionsDto;
  @ApiProperty({ type: () => AdminOverviewSignupsDto })
  signups!: AdminOverviewSignupsDto;
}

// ─── Farms ──────────────────────────────────────────────────────────────────

export class AdminPlanRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class AdminFarmSubscriptionDto {
  @ApiProperty(subscriptionStatus) status!: SubscriptionStatus;
  @ApiProperty(DATE_TIME) startsAt!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) expiresAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) cancelledAt!: Date | null;
  @ApiProperty({ type: () => AdminPlanRefDto })
  subscriptionPlan!: AdminPlanRefDto;
  @ApiProperty({ type: () => AdminPlanRefDto, nullable: true })
  pendingPlan!: AdminPlanRefDto | null;
}

export class AdminPersonRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

/** One row of GET /admin/farms. */
export class AdminFarmListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(farmStatus) status!: FarmStatus;
  @ApiProperty({ type: String, nullable: true }) division!: string | null;
  @ApiProperty({ type: String, nullable: true }) district!: string | null;
  @ApiProperty({ type: String, nullable: true }) farmCode!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({ type: () => AdminPersonRefDto }) owner!: AdminPersonRefDto;
  @ApiProperty() memberCount!: number;
  @ApiProperty() cattleCount!: number;
  @ApiProperty({ type: () => AdminFarmSubscriptionDto })
  subscription!: AdminFarmSubscriptionDto;
}

export class AdminFarmOwnerDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() email!: string;
  @ApiProperty() isEmailVerified!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastLoginAt!: Date | null;
}

export class AdminFarmMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() email!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty(DATE_TIME) joinedAt!: Date;
  @ApiProperty() role!: string;
}

/** GET /admin/farms/:id. */
export class AdminFarmDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty(farmStatus) status!: FarmStatus;
  @ApiProperty({ type: String, nullable: true }) division!: string | null;
  @ApiProperty({ type: String, nullable: true }) district!: string | null;
  @ApiProperty({ type: String, nullable: true }) upazila!: string | null;
  @ApiProperty({ type: String, nullable: true }) operationalPurpose!:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ type: String, nullable: true }) herdSizeBand!: string | null;
  @ApiProperty({ type: String, nullable: true }) farmCode!: string | null;
  @ApiProperty() hasCompletedOnboarding!: boolean;
  @ApiProperty() timezone!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({ type: () => AdminFarmOwnerDto }) owner!: AdminFarmOwnerDto;
  @ApiProperty() cattleRecords!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastActivityAt!: Date | null;
  @ApiProperty({ type: () => AdminFarmSubscriptionDto })
  subscription!: AdminFarmSubscriptionDto;
  @ApiProperty({ type: () => [AdminFarmSubscriptionDto] })
  subscriptionHistory!: AdminFarmSubscriptionDto[];
  @ApiProperty({ type: () => [AdminFarmMemberDto] })
  members!: AdminFarmMemberDto[];
}

// ─── Users ──────────────────────────────────────────────────────────────────

/** One row of GET /admin/users. */
export class AdminUserListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() email!: string;
  @ApiProperty() isEmailVerified!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lockedUntil!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty() farmCount!: number;
  @ApiProperty() ownedFarmCount!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastActiveAt!: Date | null;
}

export class AdminUserSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SessionStatus, enumName: 'SessionStatus' })
  status!: SessionStatus;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) expiresAt!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastUsedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceName!: string | null;
}

export class AdminUserChannelDto {
  @ApiProperty() id!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() platform!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) lastSeenAt!: Date;
}

export class AdminUserMembershipFarmDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(farmStatus) status!: FarmStatus;
}

export class AdminUserMembershipDto {
  @ApiProperty(DATE_TIME) joinedAt!: Date;
  @ApiProperty() role!: string;
  @ApiProperty({ type: () => AdminUserMembershipFarmDto })
  farm!: AdminUserMembershipFarmDto;
}

/** GET /admin/users/:id. Credentials are never included. */
export class AdminUserDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() email!: string;
  @ApiProperty() isEmailVerified!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) emailVerifiedAt!: Date | null;
  @ApiProperty() failedLoginAttempts!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  lastFailedLoginAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lockedUntil!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  lastPasswordChangedAt!: Date | null;
  @ApiProperty({ enum: Language, enumName: 'Language' })
  preferredLanguage!: Language;
  @ApiProperty() hasTelegram!: boolean;
  @ApiProperty() hasPush!: boolean;
  @ApiProperty() mfaConfigured!: boolean;
  @ApiProperty() ownedFarmCount!: number;
  @ApiProperty() activeSessionCount!: number;
  @ApiProperty({ type: () => [AdminUserSessionDto] })
  recentSessions!: AdminUserSessionDto[];
  @ApiProperty({ type: () => [AdminUserChannelDto] })
  connectedChannels!: AdminUserChannelDto[];
  @ApiProperty({ type: () => [AdminUserMembershipDto] })
  memberships!: AdminUserMembershipDto[];
}

// ─── Support actions ────────────────────────────────────────────────────────

/** POST /admin/farms/:id/suspend and /reactivate. `changed` is false when the farm was already in that state. */
export class AdminFarmActionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['SUSPENDED', 'ACTIVE'] })
  status!: 'SUSPENDED' | 'ACTIVE';
  @ApiProperty() changed!: boolean;
}

/** POST /admin/users/:id/block and /unblock. `changed` is false when the user was already in that state. */
export class AdminUserBlockResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty() changed!: boolean;
}

/** POST /admin/users/:id/send-password-reset. */
export class AdminPasswordResetSentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() sent!: boolean;
  @ApiProperty() revokedSessions!: number;
}

/** POST /admin/users/:id/revoke-sessions. */
export class AdminRevokeSessionsResponseDto {
  @ApiProperty() revokedSessions!: number;
  @ApiProperty() revokedRefreshTokens!: number;
  @ApiProperty() success!: boolean;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Out<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Dir<K extends keyof AdminDirectoryService> = Out<AdminDirectoryService[K]>;
type Act<K extends keyof AdminSupportActionsService> = Out<
  AdminSupportActionsService[K]
>;

export type AdminDirectoryShapeGuards = [
  Assert<Same<Dir<'overview'>, AdminOverviewResponseDto>>,
  Assert<Same<Dir<'listFarms'>, CursorPage<AdminFarmListItemDto>>>,
  Assert<Same<Dir<'getFarm'>, AdminFarmDetailResponseDto>>,
  Assert<Same<Dir<'listUsers'>, CursorPage<AdminUserListItemDto>>>,
  Assert<Same<Dir<'getUser'>, AdminUserDetailResponseDto>>,
  Assert<Same<Act<'suspendFarm'>, AdminFarmActionResponseDto>>,
  Assert<Same<Act<'reactivateFarm'>, AdminFarmActionResponseDto>>,
  Assert<Same<Act<'blockUser'>, AdminUserBlockResponseDto>>,
  Assert<Same<Act<'unblockUser'>, AdminUserBlockResponseDto>>,
  Assert<Same<Act<'sendPasswordReset'>, AdminPasswordResetSentResponseDto>>,
  Assert<Same<Act<'revokeUserSessions'>, AdminRevokeSessionsResponseDto>>,
];
