import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { AdminTokenService } from '../../application/services/admin-token.service';
import { AdminSessionService } from '../../application/services/admin-session.service';
import { AdminTokenPayload } from '../../domain/admin-token-payload.type';
import { AuthenticatedAdminRequest } from '../../domain/authenticated-admin-request.type';

/**
 * The `admin-api` gate (RAKHAL-224, PRD §32.5 / ADR-016). Verifies a bearer JWT
 * with the **admin secret** (a farm token can't pass — wrong secret + no
 * `type` claim), then **re-loads the `PlatformAdmin` from the DB every request**
 * so deactivating an admin takes effect immediately (no waiting for token
 * expiry). Never chains with the farm guards — an admin has no farm context.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly log: LoggerService;

  constructor(
    private readonly tokens: AdminTokenService,
    private readonly prisma: PrismaService,
    private readonly sessions: AdminSessionService,
    private readonly requestContext: LoggerContext,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PlatformAdminGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin authentication required');
    }
    const token = header.slice('Bearer '.length);

    let payload: AdminTokenPayload;
    try {
      payload = await this.tokens.verify(token);
    } catch {
      throw new UnauthorizedException('Admin authentication required');
    }
    if (payload.type !== 'platform_admin' || !payload.sid) {
      throw new UnauthorizedException('Admin authentication required');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive) {
      this.log.warn('Rejected admin request for missing/inactive admin', {
        adminId: payload.sub,
      });
      throw new UnauthorizedException('Admin authentication required');
    }

    if (!(await this.sessions.isActive(payload.sid, admin.id))) {
      this.log.warn('Rejected admin request for revoked/expired session', {
        adminId: admin.id,
        sessionId: payload.sid,
      });
      throw new UnauthorizedException('Admin authentication required');
    }

    request.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      sessionId: payload.sid,
      mustChangePassword: admin.mustChangePassword,
    };

    // Feed the audit trail (AdminAuditService reads these) without every call
    // site having to thread the request through.
    this.requestContext.set('sessionId', payload.sid);
    this.requestContext.set('userId', admin.id);
    this.requestContext.set('ipAddress', request.ip);
    this.requestContext.set('userAgent', request.headers['user-agent']);
    return true;
  }
}
