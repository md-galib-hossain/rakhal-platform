import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminSupportActionsService } from '../../application/services/admin-support-actions.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import {
  AdminSendPasswordResetDto,
  AdminSupportActionDto,
} from '../dto/admin-support-action.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminFarmActionResponseDto,
  AdminPasswordResetSentResponseDto,
  AdminRevokeSessionsResponseDto,
  AdminUserBlockResponseDto,
} from '../dto/admin-directory-response.dto';

/**
 * Phase 4 controlled support operations. Farm suspension needs `farm.manage`
 * (SUPER_ADMIN only); user actions need `user.manage` (SUPPORT_ADMIN too). Every
 * body carries a `reason` and a `confirm` matching the target — see the service.
 */
@ApiTags('Admin — Support actions')
@ApiBearerAuth()
@Controller('admin')
@ThrottleWrite()
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminSupportActionsController {
  constructor(private readonly actions: AdminSupportActionsService) {}

  @Post('farms/:id/suspend')
  @ApiEnvelopeResponse(AdminFarmActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('farm.manage')
  suspendFarm(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSupportActionDto,
  ) {
    return this.actions.suspendFarm(admin.id, id, dto);
  }

  @Post('farms/:id/reactivate')
  @ApiEnvelopeResponse(AdminFarmActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('farm.manage')
  reactivateFarm(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSupportActionDto,
  ) {
    return this.actions.reactivateFarm(admin.id, id, dto);
  }

  @Post('users/:id/block')
  @ApiEnvelopeResponse(AdminUserBlockResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('user.manage')
  blockUser(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSupportActionDto,
  ) {
    return this.actions.blockUser(admin.id, id, dto);
  }

  @Post('users/:id/unblock')
  @ApiEnvelopeResponse(AdminUserBlockResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('user.manage')
  unblockUser(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSupportActionDto,
  ) {
    return this.actions.unblockUser(admin.id, id, dto);
  }

  @Post('users/:id/send-password-reset')
  @ApiEnvelopeResponse(AdminPasswordResetSentResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('user.manage')
  sendPasswordReset(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSendPasswordResetDto,
  ) {
    return this.actions.sendPasswordReset(admin.id, id, dto);
  }

  @Post('users/:id/revoke-sessions')
  @ApiEnvelopeResponse(AdminRevokeSessionsResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('user.manage')
  revokeSessions(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: AdminSupportActionDto,
  ) {
    return this.actions.revokeUserSessions(admin.id, id, dto);
  }
}
