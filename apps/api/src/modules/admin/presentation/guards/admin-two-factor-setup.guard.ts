import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AdminTokenService } from '../../application/services/admin-token.service';
import { AdminTokenPayload } from '../../domain/admin-token-payload.type';
import { AuthenticatedAdminRequest } from '../../domain/authenticated-admin-request.type';

/**
 * Gate for the 2FA setup/enable routes (RAKHAL-225). Accepts **only** a
 * `platform_admin_2fa_setup` token (issued by `AdminAuthService.login` for an
 * admin who hasn't finished 2FA setup yet) — a full `platform_admin` access
 * token is rejected here just as a setup token is rejected by
 * `PlatformAdminGuard`. Keeps the two token scopes from being interchangeable.
 */
@Injectable()
export class AdminTwoFactorSetupGuard implements CanActivate {
  constructor(
    private readonly tokens: AdminTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('2FA setup token required');
    }
    const token = header.slice('Bearer '.length);

    let payload: AdminTokenPayload;
    try {
      payload = await this.tokens.verify(token);
    } catch {
      throw new UnauthorizedException('2FA setup token required');
    }
    if (payload.type !== 'platform_admin_2fa_setup') {
      throw new UnauthorizedException('2FA setup token required');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('2FA setup token required');
    }

    request.admin = { id: admin.id, email: admin.email, role: admin.role };
    return true;
  }
}
