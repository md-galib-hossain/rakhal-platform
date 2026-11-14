import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminPlatformConfigService } from '../../application/services/admin-platform-config.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import {
  ConfigReasonDto,
  CreateFlagDto,
  SetSettingDto,
  UpdateFlagDto,
} from '../dto/admin-config.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminFeatureFlagDto,
  AdminFlagDeletedResponseDto,
  AdminPlatformSettingDto,
} from '../dto/admin-config-response.dto';

/**
 * Feature flags and platform settings (Phase 5). Reading needs `config.read` (SUPPORT_ADMIN too); every change
 * needs `config.manage` (SUPER_ADMIN only) and a written reason, and is audited with before/after.
 */
@ApiTags('Admin — Platform config')
@ApiBearerAuth()
@Controller('admin/config')
@ThrottleWrite()
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminConfigController {
  constructor(private readonly config: AdminPlatformConfigService) {}

  @Get('flags')
  @ApiEnvelopeResponse(AdminFeatureFlagDto, { isArray: true })
  @RequireAdminPermission('config.read')
  listFlags() {
    return this.config.listFlags();
  }

  @Post('flags')
  @ApiEnvelopeResponse(AdminFeatureFlagDto, { status: 201 })
  @RequireAdminPermission('config.manage')
  createFlag(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: CreateFlagDto,
  ) {
    return this.config.createFlag(admin.id, dto);
  }

  @Patch('flags/:key')
  @ApiEnvelopeResponse(AdminFeatureFlagDto)
  @RequireAdminPermission('config.manage')
  updateFlag(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('key') key: string,
    @Body() dto: UpdateFlagDto,
  ) {
    return this.config.updateFlag(admin.id, key, dto);
  }

  @Delete('flags/:key')
  @ApiEnvelopeResponse(AdminFlagDeletedResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('config.manage')
  deleteFlag(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('key') key: string,
    @Body() dto: ConfigReasonDto,
  ) {
    return this.config.deleteFlag(admin.id, key, dto.reason);
  }

  @Get('settings')
  @ApiEnvelopeResponse(AdminPlatformSettingDto, { isArray: true })
  @RequireAdminPermission('config.read')
  listSettings() {
    return this.config.listSettings();
  }

  @Put('settings/:key')
  @ApiEnvelopeResponse(AdminPlatformSettingDto)
  @HttpCode(200)
  @RequireAdminPermission('config.manage')
  setSetting(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
  ) {
    return this.config.setSetting(admin.id, key, dto);
  }
}
