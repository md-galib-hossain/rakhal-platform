import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ReferralService } from '../../application/services/referral.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Self-serve referrals (RAKHAL-223, PRD §33.2, REF-07). `/api/v1/referrals`.
 * Farm-scoped: shows the member their own code/link, referred farms, and
 * credit — never another farm's. Program config (REF-08) and any
 * approve/clawback console are platform-admin actions with no HTTP surface
 * yet (RD-025-style deferral; RAKHAL-224/225/231).
 */
@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class ReferralController {
  constructor(private readonly referrals: ReferralService) {}

  @Get()
  @RequirePermission('referral.read')
  getMine(@CurrentFarmId() farmId: string, @CurrentUserId() userId: string) {
    return this.referrals.getReferralsForFarm(farmId, userId);
  }

  @Get('commissions')
  @RequirePermission('referral.read')
  commissions(@CurrentFarmId() farmId: string) {
    return this.referrals.getCommissionsForFarm(farmId);
  }
}
