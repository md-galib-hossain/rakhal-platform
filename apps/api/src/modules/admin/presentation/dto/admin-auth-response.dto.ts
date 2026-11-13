import { ApiProperty } from '@nestjs/swagger';
import { PlatformAdminRole } from '@prisma/client';
import type { AdminAuthService } from '../../application/services/admin-auth.service';
import type { AdminSessionService } from '../../application/services/admin-session.service';
import type { AdminAuthController } from '../controllers/admin-auth.controller';

/**
 * Documented response shapes for platform-admin auth (`/admin/auth/*`, admin-api, RD-140). Each class mirrors
 * what `AdminAuthService` / `AdminSessionService` (or the controller, for the inline ones) returns and is pinned
 * to it by a compile-time guard at the bottom of this file. `Date` fields are ISO-8601 strings on the wire.
 * Tokens and the TOTP secret are returned by design to the signed-in admin who requested them.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** The identity block of a completed login. */
export class AdminLoginIdentityDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
}

/**
 * POST /admin/auth/login. Either the setup branch (`twoFactorSetupRequired: true` + `setupToken`, a
 * setup-scoped token usable only on `2fa/setup` and `2fa/enable`) or the session branch
 * (`twoFactorSetupRequired: false` + tokens, `sessionId` and `admin`). Fields of the other branch are absent.
 */
export class AdminLoginResponseDto {
  @ApiProperty({
    description:
      'true: 2FA is not enabled yet; use `setupToken` to complete onboarding. false: signed in.',
  })
  twoFactorSetupRequired!: boolean;
  @ApiProperty({
    required: false,
    description: 'Present only when `twoFactorSetupRequired` is true.',
  })
  setupToken?: string;
  @ApiProperty({
    required: false,
    description: 'Present only when `twoFactorSetupRequired` is false.',
  })
  accessToken?: string;
  @ApiProperty({
    required: false,
    description: 'Present only when `twoFactorSetupRequired` is false.',
  })
  refreshToken?: string;
  @ApiProperty({
    required: false,
    description: 'Present only when `twoFactorSetupRequired` is false.',
  })
  sessionId?: string;
  @ApiProperty({
    type: () => AdminLoginIdentityDto,
    required: false,
    description: 'Present only when `twoFactorSetupRequired` is false.',
  })
  admin?: AdminLoginIdentityDto;
}

/** POST /admin/auth/refresh: the rotated pair (the previous refresh token is now invalid). */
export class AdminRefreshResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() sessionId!: string;
}

/** POST /admin/auth/logout. Always `true`. */
export class AdminLogoutResponseDto {
  @ApiProperty({ type: Boolean, example: true }) loggedOut!: boolean;
}

/** POST /admin/auth/change-password. */
export class AdminPasswordChangedResponseDto {
  @ApiProperty({ type: Boolean, example: true }) changed!: boolean;
}

/** POST /admin/auth/logout-others. */
export class AdminLogoutOthersResponseDto {
  @ApiProperty({ description: 'Number of other sessions revoked.' })
  revoked!: number;
}

/** GET /admin/auth/me. */
export class AdminMeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: PlatformAdminRole, enumName: 'PlatformAdminRole' })
  role!: PlatformAdminRole;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({
    type: [String],
    description: 'Permission grants of the role (UI gating only).',
  })
  permissions!: string[];
}

/** One active session in GET /admin/auth/sessions. */
export class AdminSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty(DATE_TIME) expiresAt!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastUsedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({ description: 'True for the session making this request.' })
  current!: boolean;
}

/** DELETE /admin/auth/sessions/:id (404 when the session is not the caller's or already gone). */
export class AdminSessionRevokedResponseDto {
  @ApiProperty({ type: Boolean, example: true }) revoked!: boolean;
}

/** POST /admin/auth/2fa/setup: the pending TOTP secret and its provisioning URL (for QR enrolment). */
export class AdminTwoFactorSetupResponseDto {
  @ApiProperty() secret!: string;
  @ApiProperty() otpauthUrl!: string;
}

/** POST /admin/auth/2fa/enable. */
export class AdminTwoFactorEnabledResponseDto {
  @ApiProperty({ type: Boolean, example: true }) enabled!: boolean;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Out<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Auth<K extends keyof AdminAuthService> = Out<AdminAuthService[K]>;
type Sessions<K extends keyof AdminSessionService> = Out<
  AdminSessionService[K]
>;
type Ctl<K extends keyof AdminAuthController> = Out<AdminAuthController[K]>;

export type AdminAuthShapeGuards = [
  // login is a union of two branches: every branch must be assignable to the single documented class.
  Assert<Auth<'login'> extends AdminLoginResponseDto ? true : false>,
  Assert<Same<Auth<'refresh'>, AdminRefreshResponseDto>>,
  Assert<Same<Ctl<'logout'>, AdminLogoutResponseDto>>,
  Assert<
    Auth<'changePassword'> extends AdminPasswordChangedResponseDto
      ? true
      : false
  >,
  Assert<Same<Ctl<'logoutOthers'>, AdminLogoutOthersResponseDto>>,
  Assert<Same<Ctl<'me'>, AdminMeResponseDto>>,
  Assert<Same<Ctl<'listSessions'>, AdminSessionDto[]>>,
  Assert<Same<Ctl<'revokeSession'>, AdminSessionRevokedResponseDto>>,
  Assert<Same<Auth<'beginTwoFactorSetup'>, AdminTwoFactorSetupResponseDto>>,
  Assert<
    Auth<'enableTwoFactor'> extends AdminTwoFactorEnabledResponseDto
      ? true
      : false
  >,
  Assert<
    Same<Sessions<'listActive'>[number] & { current: boolean }, AdminSessionDto>
  >,
];
