import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { adminRoleHasPermission } from '../../domain/admin-permission-matrix';
import { AuthenticatedAdminRequest } from '../../domain/authenticated-admin-request.type';
import { ADMIN_PERMISSION_KEY } from '../decorators/require-admin-permission.decorator';

/**
 * Least-privilege enforcement for `/admin/*` (RAKHAL-225, PRD §35.21). Runs
 * **after** `PlatformAdminGuard` (needs `request.admin` already attached).
 * Routes without a `@RequireAdminPermission(...)` decorator are allowed through
 * unchanged (guard-chain-only protection) — opt in per route as controllers
 * adopt the matrix.
 */
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      ADMIN_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();
    if (!request.admin) {
      throw new ForbiddenException('Admin authentication required');
    }
    if (!adminRoleHasPermission(request.admin.role, required)) {
      throw new ForbiddenException(
        `Admin role ${request.admin.role} lacks permission ${required}`,
      );
    }
    return true;
  }
}
