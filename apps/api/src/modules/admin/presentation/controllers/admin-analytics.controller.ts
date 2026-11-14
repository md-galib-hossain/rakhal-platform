import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ThrottleExpensive } from 'src/common/decorators';
import {
  AdminAnalyticsService,
  type ExportKind,
} from '../../application/services/admin-analytics.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { adminRoleHasPermission } from '../../domain/admin-permission-matrix';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import {
  AdminAuthenticatedOnly,
  RequireAdminPermission,
} from '../decorators/require-admin-permission.decorator';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ForbiddenException } from '@nestjs/common';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import { AdminUsageResponseDto } from '../dto/admin-insights-response.dto';

enum ExportKindParam {
  farms = 'farms',
  users = 'users',
  subscriptions = 'subscriptions',
}

/**
 * Phase 6 analytics and exports. Analytics need `analytics.read`. Exports are per-kind permissions
 * (`export.farms` covers farms + subscriptions; `export.users` — PII — is SUPER_ADMIN only), are rate-limited
 * hard, and every export is audited with its row count.
 */
@ApiTags('Admin — Analytics')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('analytics/usage')
  @ApiEnvelopeResponse(AdminUsageResponseDto)
  @ThrottleExpensive()
  @RequireAdminPermission('analytics.read')
  usage() {
    return this.analytics.usage();
  }

  /** The per-kind permission is checked in the handler (a route-level key cannot depend on the path param). */
  @Get('exports/:kind')
  @ThrottleExpensive()
  @AdminAuthenticatedOnly()
  async export(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('kind', new ParseEnumPipe(ExportKindParam)) kind: ExportKind,
    @Res() res: Response,
  ) {
    const needed = kind === 'users' ? 'export.users' : 'export.farms';
    if (!adminRoleHasPermission(admin.role, needed)) {
      throw new ForbiddenException(
        `Admin role ${admin.role} lacks permission ${needed}`,
      );
    }
    const { filename, csv } = await this.analytics.export(admin.id, kind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }
}
