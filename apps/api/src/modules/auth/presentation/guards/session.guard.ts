import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
import { PermissionsVersionCacheService } from '../../application/services/permissions-version-cache.service';
import { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';
import { AuthenticatedRequestContext } from '../../domain/authenticated-request-context.type';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly log: LoggerService;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly permissionsVersionCache: PermissionsVersionCacheService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(SessionGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>();
    const payload = request.user;

    if (!payload) {
      this.log.warn('Missing access token payload', { reason: 'missing-user' });
      throw new UnauthorizedException('Unauthorized');
    }

    const session = await this.authRepository.findSessionById(
      payload.sessionId,
    );

    if (!session || session.userId !== payload.sub) {
      this.log.warn('Rejected request for missing or mismatched session', {
        userId: payload.sub,
        sessionId: payload.sessionId,
      });
      throw new UnauthorizedException('Session is not active');
    }

    const now = new Date();

    if (
      session.status !== SessionStatus.ACTIVE ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      this.log.warn('Rejected request for inactive session', {
        userId: payload.sub,
        sessionId: payload.sessionId,
        status: session.status,
      });
      throw new UnauthorizedException('Session is not active');
    }

    if (!session.user || session.user.deletedAt || session.user.isBlocked) {
      this.log.warn('Rejected request for blocked or deleted user', {
        userId: payload.sub,
        sessionId: payload.sessionId,
      });
      throw new UnauthorizedException('Session is not active');
    }

    const cachedPermissionsVersion = await this.permissionsVersionCache.get(
      session.userId,
    );

    if (cachedPermissionsVersion === undefined) {
      await this.permissionsVersionCache.set(
        session.userId,
        session.user.permissionsVersion,
      );
    } else if (cachedPermissionsVersion !== session.user.permissionsVersion) {
      await this.permissionsVersionCache.set(
        session.userId,
        session.user.permissionsVersion,
      );
    }

    if (payload.permissionsVersion !== session.user.permissionsVersion) {
      this.log.warn('Rejected request for stale permissions version', {
        userId: payload.sub,
        sessionId: payload.sessionId,
        tokenPermissionsVersion: payload.permissionsVersion,
        currentPermissionsVersion: session.user.permissionsVersion,
      });
      throw new UnauthorizedException('Session permissions are stale');
    }

    request.auth = {
      user: payload,
      session: {
        id: session.id,
        userId: session.userId,
        status: session.status,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
      },
      account: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        permissionsVersion: session.user.permissionsVersion,
        isBlocked: session.user.isBlocked,
        deletedAt: session.user.deletedAt,
        preferredLanguage: session.user.preferredLanguage.toLowerCase() as
          | 'bn'
          | 'en',
      },
    } satisfies AuthenticatedRequestContext;

    return true;
  }
}
