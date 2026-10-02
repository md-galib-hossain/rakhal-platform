import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { CurrentLanguage } from 'src/common/decorators/current-language.decorator';
import type { AppLanguage } from 'src/common/i18n/language';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { NotificationService } from '../../application/services/notification.service';
import { DeviceTokenService } from '../../application/services/device-token.service';
import { ChannelRouterService } from '../../application/services/channel-router.service';
import { ListNotificationQueryDto } from '../dto/list-notification-query.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { SetRoutingDto } from '../dto/set-routing.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Notifications (PRD §20 / API §17). `/api/v1/notifications`. The bell feed is
 * each user's own notifications — list/mark-read need only `notification.read`
 * (every role, including Worker); changing preferences needs `notification.update`.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly devices: DeviceTokenService,
    private readonly routing: ChannelRouterService,
  ) {}

  // ---- Push device tokens (PRD §20.1) ------------------------------------
  @Post('devices')
  @RequirePermission('notification.read')
  registerDevice(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.register(userId, farmId, dto);
  }

  @Get('devices')
  @RequirePermission('notification.read')
  listDevices(@CurrentUserId() userId: string) {
    return this.devices.list(userId);
  }

  @Delete('devices')
  @RequirePermission('notification.read')
  unregisterDevice(
    @CurrentUserId() userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.unregister(userId, dto.token);
  }

  @Get()
  @RequirePermission('notification.read')
  list(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query() query: ListNotificationQueryDto,
    @CurrentLanguage() lang: AppLanguage,
  ) {
    return this.notifications.list(farmId, userId, query, lang);
  }

  @Post(':id/read')
  @RequirePermission('notification.read')
  markRead(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(farmId, userId, id);
  }

  @Post('read-all')
  @RequirePermission('notification.read')
  markAllRead(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.notifications.markAllRead(farmId, userId);
  }

  @Get('preferences')
  @RequirePermission('notification.read')
  getPreferences(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.notifications.getPreferences(farmId, userId);
  }

  @Patch('preferences')
  @RequirePermission('notification.update')
  updatePreferences(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notifications.updatePreferences(farmId, userId, dto);
  }

  // ---- Channel routing (RAKHAL-256, §20.1a) — per-farm overrides ----------
  @Get('routing')
  @RequirePermission('notification.read')
  getRouting(@CurrentFarmId() farmId: string) {
    return this.routing.getFarmRouting(farmId);
  }

  @Put('routing/:eventKey')
  @RequirePermission('notification.update')
  setRouting(
    @CurrentFarmId() farmId: string,
    @Param('eventKey') eventKey: string,
    @Body() dto: SetRoutingDto,
  ) {
    return this.routing.setFarmRule(farmId, eventKey, dto.channels);
  }

  @Delete('routing/:eventKey')
  @RequirePermission('notification.update')
  deleteRouting(
    @CurrentFarmId() farmId: string,
    @Param('eventKey') eventKey: string,
  ) {
    return this.routing.deleteFarmRule(farmId, eventKey);
  }
}
