import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottleAuth } from 'src/common/decorators';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import {
  AdminClientContext,
  AdminSessionService,
} from '../../application/services/admin-session.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { adminRoleGrants } from '../../domain/admin-permission-matrix';
import { AdminRefreshDto } from '../dto/admin-refresh.dto';
import { ChangePasswordDto } from '../dto/admin-lifecycle.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminEnableTwoFactorDto } from '../dto/admin-enable-2fa.dto';
import { AdminTwoFactorSetupGuard } from '../guards/admin-two-factor-setup.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';

function clientOf(req: Request): AdminClientContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

/**
 * Platform-admin auth (RAKHAL-224/225, PRD §32.5/§35.1). `admin-api` surface —
 * `POST /admin/auth/login` is the only unguarded admin route. Rate-limited to
 * blunt credential stuffing. **2FA is mandatory**: a first-time login returns a
 * setup-scoped token instead of access; `2fa/setup` + `2fa/enable` (both gated
 * by that setup token, not a real session) complete onboarding before any
 * `/admin/*` route becomes reachable.
 */
@ApiTags('Admin — Auth')
@Controller('admin/auth')
@UseGuards(AdminIpAllowlistGuard)
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly sessions: AdminSessionService,
  ) {}

  @Post('login')
  @ThrottleAuth()
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(
      dto.email,
      dto.password,
      dto.code,
      clientOf(req),
    );
  }

  /** Rotates the refresh token (reuse of an old one revokes the session). */
  @Post('refresh')
  @HttpCode(200)
  @ThrottleAuth()
  refresh(@Body() dto: AdminRefreshDto, @Req() req: Request) {
    return this.adminAuth.refresh(dto.refreshToken, clientOf(req));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  async logout(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Req() req: Request,
  ) {
    await this.sessions.revoke(admin.id, admin.sessionId!, 'LOGOUT', req.ip);
    return { loggedOut: true };
  }

  /**
   * Self-service password change (P2-05). Reachable while a temporary password
   * is in force — this controller doesn't run `AdminPermissionGuard`, which is
   * what blocks every other route with `PASSWORD_CHANGE_REQUIRED`.
   */
  @Post('change-password')
  @ThrottleAuth()
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  changePassword(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.adminAuth.changePassword(
      admin.id,
      admin.sessionId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Revokes every other session of the calling admin, keeping this one. */
  @Post('logout-others')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  async logoutOthers(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Req() req: Request,
  ) {
    const revoked = await this.sessions.revokeAll(
      admin.id,
      'LOGOUT_OTHERS',
      admin.sessionId,
      req.ip,
    );
    return { revoked };
  }

  /**
   * The signed-in admin's identity + grants, for the admin UI to gate navigation.
   * UX only — every route still enforces its own permission server-side. Reachable
   * while a temporary password is in force (this controller skips
   * `AdminPermissionGuard`) so the UI can route to change-password.
   */
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  me(@CurrentAdmin() admin: CurrentAdminContext) {
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword ?? false,
      permissions: adminRoleGrants(admin.role),
    };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  async listSessions(@CurrentAdmin() admin: CurrentAdminContext) {
    const sessions = await this.sessions.listActive(admin.id);
    return sessions.map((s) => ({ ...s, current: s.id === admin.sessionId }));
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(PlatformAdminGuard)
  async revokeSession(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const revoked = await this.sessions.revoke(
      admin.id,
      id,
      'REVOKED_BY_ADMIN',
      req.ip,
    );
    if (!revoked) throw new NotFoundException('Session not found');
    return { revoked: true };
  }

  @Post('2fa/setup')
  @ApiBearerAuth()
  @UseGuards(AdminTwoFactorSetupGuard)
  setupTwoFactor(@CurrentAdmin() admin: CurrentAdminContext) {
    return this.adminAuth.beginTwoFactorSetup(admin.id);
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @UseGuards(AdminTwoFactorSetupGuard)
  enableTwoFactor(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: AdminEnableTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.adminAuth.enableTwoFactor(admin.id, dto.code, req.ip);
  }
}
