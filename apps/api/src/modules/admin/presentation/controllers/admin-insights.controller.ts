import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleExpensive } from 'src/common/decorators';
import { AdminInsightsService } from '../../application/services/admin-insights.service';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminEngagementResponseDto,
  AdminSecurityOverviewResponseDto,
} from '../dto/admin-insights-response.dto';

/**
 * Product-usage insight (`analytics.read`) and the account-security picture (`security.read`). Both are
 * read-only aggregates over the live tables, so they are rate-limited like the other heavy admin reads.
 */
@ApiTags('Admin — Insights')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminInsightsController {
  constructor(private readonly insights: AdminInsightsService) {}

  @Get('analytics/engagement')
  @ApiEnvelopeResponse(AdminEngagementResponseDto)
  @ThrottleExpensive()
  @RequireAdminPermission('analytics.read')
  engagement() {
    return this.insights.engagement();
  }

  @Get('security/overview')
  @ApiEnvelopeResponse(AdminSecurityOverviewResponseDto)
  @ThrottleExpensive()
  @RequireAdminPermission('security.read')
  security() {
    return this.insights.security();
  }
}
