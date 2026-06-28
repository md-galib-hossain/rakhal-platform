import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { OnboardingService } from '../../application/services/onboarding.service';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ConfigureOnboardingDto } from '../dto/configure-onboarding.dto';

/** Onboarding (PRD §5.1 / API §2). `/api/v1/onboarding`. */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // ── Wizard steps (farm-scoped: the user is already a member) ───────────────

  @Get('status')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.read')
  status(@CurrentFarmId() farmId: string) {
    return this.onboarding.status(farmId);
  }

  @Post('configure')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.update')
  configure(
    @CurrentFarmId() farmId: string,
    @Body() dto: ConfigureOnboardingDto,
  ) {
    return this.onboarding.configure(farmId, dto);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.update')
  complete(@CurrentFarmId() farmId: string) {
    return this.onboarding.complete(farmId);
  }

  // ── Accept invite (pre-membership: authenticated, but no farm context yet) ─

  @Post('accept-invite')
  @UseGuards(JwtAuthGuard, SessionGuard)
  acceptInvite(@CurrentUserId() userId: string, @Body() dto: AcceptInviteDto) {
    return this.onboarding.acceptInvite(userId, dto.token);
  }
}
