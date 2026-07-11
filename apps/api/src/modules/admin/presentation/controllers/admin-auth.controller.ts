import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminEnableTwoFactorDto } from '../dto/admin-enable-2fa.dto';
import { AdminTwoFactorSetupGuard } from '../guards/admin-two-factor-setup.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';

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
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { ttl: 60_000, limit: 5 } })
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(dto.email, dto.password, dto.code, req.ip);
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
