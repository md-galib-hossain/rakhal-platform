import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { TenantAccessService } from '../../application/services/tenant-access.service';

/**
 * Token-based tenancy guard (the Rakhal API contract: "all data routes are
 * scoped to the organization_id from the authenticated session").
 *
 * Unlike {@link FarmMembershipGuard}, which reads `farmId` from a route param,
 * this guard derives the active farm from the access token (`request.auth.user.farmId`,
 * populated by SessionGuard) and verifies membership via TenantAccessService.
 * It attaches `request.farm` so PermissionGuard / SubscriptionFeatureGuard work
 * downstream without a `:farmId` path segment.
 *
 * Use this on farm-scoped feature routes:
 *   @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
 *
 * Requires JwtAuthGuard + SessionGuard to have run first.
 */
@Injectable()
export class FarmContextGuard implements CanActivate {
  constructor(private readonly tenantAccessService: TenantAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request>() as AuthenticatedHttpRequest;

    const userId = request.auth?.user.sub;
    const farmId = request.auth?.user.farmId;

    if (!userId || typeof farmId !== 'string' || farmId.length === 0) {
      throw new ForbiddenException('Farm access denied');
    }

    request.farm = await this.tenantAccessService.resolveFarmContext(
      userId,
      farmId,
    );

    return true;
  }
}
