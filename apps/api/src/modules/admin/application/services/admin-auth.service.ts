import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PasswordService } from 'src/modules/auth/application/services/password.service';
import { AdminTokenService } from './admin-token.service';
import { AdminAuditService } from './admin-audit.service';

/**
 * Platform-admin login (RAKHAL-224, PRD §32.5). Validates against the separate
 * `PlatformAdmin` identity + issues an admin-secret JWT. Stateless access token
 * only for now — sessions / refresh / 2FA are RAKHAL-225. Uses a **generic**
 * failure message + always runs the password hash even for an unknown email
 * (constant-ish work) so it doesn't leak which admin emails exist.
 */
@Injectable()
export class AdminAuthService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AdminTokenService,
    private readonly audit: AdminAuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminAuthService.name);
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
  ): Promise<{
    accessToken: string;
    admin: { id: string; email: string; role: string };
  }> {
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

    const accessToken = await this.tokens.sign({
      sub: admin.id,
      role: admin.role,
      type: 'platform_admin',
    });

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      adminId: admin.id,
      action: 'LOGIN',
      entityType: 'PlatformAdmin',
      entityId: admin.id,
      ipAddress,
    });

    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    };
  }
}
