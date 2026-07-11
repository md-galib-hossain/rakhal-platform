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

type LoginResult =
  | {
      twoFactorSetupRequired: true;
      setupToken: string;
    }
  | {
      twoFactorSetupRequired: false;
      accessToken: string;
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
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminAuthService.name);
  }

  async login(
    email: string,
    password: string,
    code: string | undefined,
    ipAddress?: string,
  ): Promise<LoginResult> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    const ok =
      admin?.isActive === true &&
      (await this.passwords.verifyPassword(admin.passwordHash, password));

    if (!admin || !ok) {
      this.log.warn('Platform-admin login failed', { email });
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.tokens.sign({
      sub: admin.id,
      role: admin.role,
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
      ipAddress,
    });

    return {
      twoFactorSetupRequired: false,
      accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    };
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
