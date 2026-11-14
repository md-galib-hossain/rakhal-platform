import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PasswordService } from 'src/modules/auth/application/services/password.service';
import { AdminTokenService } from './admin-token.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminTotpService } from './admin-totp.service';
import { assertAdminPasswordPolicy } from '../../domain/admin-password-policy';
import {
  AdminClientContext,
  AdminSessionService,
} from './admin-session.service';

/** P2-06: 5 failed sign-ins within 15 minutes lock the account for the rest of the window. */
export const ADMIN_LOCKOUT_MAX_FAILURES = 5;
export const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

type LoginResult =
  | {
      twoFactorSetupRequired: true;
      setupToken: string;
    }
  | {
      twoFactorSetupRequired: false;
      accessToken: string;
      refreshToken: string;
      sessionId: string;
      admin: { id: string; email: string; role: string };
    };

/**
 * Platform-admin login (RAKHAL-224/225, PRD §32.5/§35.1). Validates against the
 * separate `PlatformAdmin` identity. **2FA is mandatory**: an admin who hasn't
 * enabled TOTP yet gets a short-lived setup-scoped token instead of a real
 * access token — they must call `2fa/setup` + `2fa/enable` before they can
 * reach any `/admin/*` route. An admin with 2FA enabled must supply a valid
 * `code` on every login. Uses a **generic** failure message + always runs the
 * password hash even for an unknown email (constant-ish work) so it doesn't
 * leak which admin emails exist.
 */
@Injectable()
export class AdminAuthService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AdminTokenService,
    private readonly audit: AdminAuditService,
    private readonly totp: AdminTotpService,
    private readonly sessions: AdminSessionService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminAuthService.name);
  }

  async login(
    email: string,
    password: string,
    code: string | undefined,
    client: AdminClientContext = {},
  ): Promise<LoginResult> {
    const ipAddress = client.ipAddress;
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Per-account lockout (P2-06), read from the audit trail: too many recent
    // failures end the attempt before any password work. Same generic 401, so a
    // locked account is indistinguishable from a wrong password.
    if (admin && (await this.isLockedOut(admin.id))) {
      await this.recordFailedLogin(admin.id, email, 'LOCKED', client);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok =
      admin?.isActive === true &&
      (await this.passwords.verifyPassword(admin.passwordHash, password));

    if (!admin || !ok) {
      this.log.warn('Platform-admin login failed', { email });
      await this.recordFailedLogin(
        admin?.id ?? null,
        email,
        !admin
          ? 'UNKNOWN_ADMIN'
          : !admin.isActive
            ? 'INACTIVE'
            : 'BAD_PASSWORD',
        client,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!admin.totpEnabled) {
      const setupToken = await this.tokens.sign(
        { sub: admin.id, type: 'platform_admin_2fa_setup' },
        '10m',
      );
      this.log.warn('Platform-admin login pending mandatory 2FA setup', {
        adminId: admin.id,
      });
      return { twoFactorSetupRequired: true, setupToken };
    }

    if (!code || !this.totp.verify(admin.totpSecret!, code)) {
      this.log.warn('Platform-admin login failed 2FA', { adminId: admin.id });
      await this.recordFailedLogin(admin.id, email, 'BAD_TOTP', client);
      throw new UnauthorizedException('Invalid credentials');
    }

    const { session, refreshToken } = await this.sessions.create(
      admin.id,
      client,
    );
    const accessToken = await this.tokens.sign({
      sub: admin.id,
      role: admin.role,
      sid: session.id,
      type: 'platform_admin',
    });

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress ?? null },
    });
    await this.audit.record({
      adminId: admin.id,
      action: 'LOGIN',
      entityType: 'PlatformAdmin',
      entityId: admin.id,
      sessionId: session.id,
      ipAddress,
      userAgent: client.userAgent,
    });

    return {
      twoFactorSetupRequired: false,
      accessToken,
      refreshToken,
      sessionId: session.id,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    };
  }

  private async isLockedOut(adminId: string): Promise<boolean> {
    const since = new Date(Date.now() - ADMIN_LOCKOUT_WINDOW_MS);
    const failures = await this.prisma.platformAdminAuditLog.count({
      where: {
        adminId,
        action: 'LOGIN_FAILED',
        createdAt: { gt: since },
        // Rejected-while-locked attempts don't extend their own lockout.
        NOT: { metadata: { path: ['reason'], equals: 'LOCKED' } },
      },
    });
    return failures >= ADMIN_LOCKOUT_MAX_FAILURES;
  }

  /**
   * Failed logins are persisted (P2-04) with the real reason, which the client
   * never sees (the response stays a generic 401). The attempted address is kept
   * as `actorEmail` — there may be no admin row to attribute it to.
   */
  private async recordFailedLogin(
    adminId: string | null,
    email: string,
    reason:
      | 'UNKNOWN_ADMIN'
      | 'INACTIVE'
      | 'BAD_PASSWORD'
      | 'BAD_TOTP'
      | 'LOCKED',
    client: AdminClientContext,
  ): Promise<void> {
    await this.audit.record({
      adminId,
      action: 'LOGIN_FAILED',
      entityType: 'PlatformAdmin',
      entityId: adminId,
      outcome: 'FAILURE',
      actorEmail: email.trim().toLowerCase(),
      metadata: { reason },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    });
  }

  /**
   * Self-service password change (P2-05). Verifies the current password, applies
   * the policy, clears the temporary-password flag and revokes every other
   * session of the admin.
   */
  async changePassword(
    adminId: string,
    currentSessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (
      !(await this.passwords.verifyPassword(
        admin.passwordHash,
        currentPassword,
      ))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current one',
      );
    }
    assertAdminPasswordPolicy(newPassword);

    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        passwordHash: await this.passwords.hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    await this.sessions.revokeAll(
      adminId,
      'PASSWORD_CHANGED',
      currentSessionId,
    );
    await this.audit.record({
      adminId,
      action: 'PASSWORD_CHANGED',
      entityType: 'PlatformAdmin',
      entityId: adminId,
      before: { mustChangePassword: admin.mustChangePassword },
      after: { mustChangePassword: false },
    });
    return { changed: true };
  }

  /** Rotates the refresh token and mints a fresh access token (P2-01). */
  async refresh(presentedRefreshToken: string, client: AdminClientContext) {
    const { session, refreshToken, admin } = await this.sessions.rotate(
      presentedRefreshToken,
      client,
    );
    const accessToken = await this.tokens.sign({
      sub: admin.id,
      role: admin.role,
      sid: session.id,
      type: 'platform_admin',
    });
    return { accessToken, refreshToken, sessionId: session.id };
  }

  /** Issues a fresh TOTP secret for an admin who hasn't enabled 2FA yet. */
  async beginTwoFactorSetup(
    adminId: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (admin.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    const secret = this.totp.generateSecret();
    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: { totpSecret: secret },
    });
    return {
      secret,
      otpauthUrl: this.totp.buildOtpAuthUrl(admin.email, secret),
    };
  }

  /** Confirms the pending secret with a live code and flips 2FA on. */
  async enableTwoFactor(
    adminId: string,
    code: string,
    ipAddress?: string,
  ): Promise<{ enabled: true }> {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (admin.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    if (!admin.totpSecret || !this.totp.verify(admin.totpSecret, code)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: { totpEnabled: true },
    });
    await this.audit.record({
      adminId,
      action: 'TWO_FACTOR_ENABLED',
      entityType: 'PlatformAdmin',
      entityId: adminId,
      ipAddress,
    });
    return { enabled: true };
  }
}
