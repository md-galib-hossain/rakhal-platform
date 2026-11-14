import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { env } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { isIpAllowed, parseAllowlist } from '../../domain/ip-allowlist';

/**
 * In-app second layer behind the nginx IP allowlist (P2-06). When
 * `ADMIN_IP_ALLOWLIST` is set, every `/admin/*` route (login included) answers
 * a generic 403 to any other client IP. Unset = off. Must be the **first** guard
 * on a controller so a blocked IP never reaches authentication.
 */
@Injectable()
export class AdminIpAllowlistGuard implements CanActivate {
  private readonly log: LoggerService;

  constructor(logger: LoggerService) {
    this.log = logger.setContext(AdminIpAllowlistGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const allowlist = parseAllowlist(env.ADMIN_IP_ALLOWLIST);
    if (allowlist.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (isIpAllowed(request.ip, allowlist)) return true;

    this.log.warn('Admin request blocked by IP allowlist', {
      ip: request.ip,
      path: request.path,
    });
    throw new ForbiddenException('Forbidden');
  }
}
