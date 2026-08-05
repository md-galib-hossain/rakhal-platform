import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from 'src/modules/auth/application/services/auth.service';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';

/**
 * Force-revoke a farm user's sessions (e.g. suspected credential compromise,
 * support escalation). `admin-api`, behind `PlatformAdminGuard`. Reuses the
 * existing self-service `AuthService.logoutAllSessions` — same DB-level
 * revoke (`Session.status = REVOKED`, `RefreshToken.isRevoked = true`) a user
 * gets from their own "logout everywhere", just admin-triggered.
 */
@ApiTags('Admin — Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(PlatformAdminGuard, AdminPermissionGuard)
export class AdminUserSessionController {
  constructor(
    private readonly authService: AuthService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post(':userId/revoke-sessions')
  @RequireAdminPermission('user.manage')
  async revokeSessions(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const result = await this.authService.logoutAllSessions(userId);
    await this.audit.record({
      adminId: admin.id,
      action: 'USER_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: userId,
      metadata: {
        revokedSessions: result.revokedSessions,
        revokedRefreshTokens: result.revokedRefreshTokens,
      },
      ipAddress: req.ip,
    });
    return result;
  }
}
