import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminOpsService } from '../../application/services/admin-ops.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { RetryJobDto } from '../dto/admin-config.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminEmailStatusResponseDto,
  AdminFailedJobsResponseDto,
  AdminIntegrationsResponseDto,
  AdminQueuesResponseDto,
  AdminRetryJobResponseDto,
} from '../dto/admin-ops-response.dto';

/**
 * Phase 5 reliability visibility: queues + failed jobs (one audited retry), email delivery status and
 * integration health. Reads need `system.read`; the retry needs `system.manage` (SUPER_ADMIN only).
 */
@ApiTags('Admin — Operations')
@ApiBearerAuth()
@Controller('admin/ops')
@ThrottleWrite()
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminOpsController {
  constructor(private readonly ops: AdminOpsService) {}

  @Get('queues')
  @ApiEnvelopeResponse(AdminQueuesResponseDto)
  @RequireAdminPermission('system.read')
  queues() {
    return this.ops.listQueues();
  }

  @Get('queues/:name/failed')
  @ApiEnvelopeResponse(AdminFailedJobsResponseDto)
  @RequireAdminPermission('system.read')
  failed(
    @Param('name') name: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.ops.failedJobs(name, limit);
  }

  @Post('queues/:name/failed/:jobId/retry')
  @ApiEnvelopeResponse(AdminRetryJobResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('system.manage')
  retry(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('name') name: string,
    @Param('jobId') jobId: string,
    @Body() dto: RetryJobDto,
  ) {
    return this.ops.retryJob(admin.id, name, jobId, dto.reason);
  }

  @Get('email-status')
  @ApiEnvelopeResponse(AdminEmailStatusResponseDto)
  @RequireAdminPermission('system.read')
  emailStatus() {
    return this.ops.emailStatus();
  }

  @Get('integrations')
  @ApiEnvelopeResponse(AdminIntegrationsResponseDto)
  @RequireAdminPermission('system.read')
  integrations() {
    return this.ops.integrations();
  }
}
