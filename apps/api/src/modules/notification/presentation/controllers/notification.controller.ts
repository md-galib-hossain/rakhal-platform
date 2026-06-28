import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { NotificationService } from '../../application/services/notification.service';
import { ListNotificationQueryDto } from '../dto/list-notification-query.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';

/**
 * Notifications (PRD §20 / API §17). `/api/v1/notifications`. The bell feed is
 * each user's own notifications — list/mark-read need only `notification.read`
 * (every role, including Worker); changing preferences needs `notification.update`.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @RequirePermission('notification.read')
  list(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query() query: ListNotificationQueryDto,
  ) {
    return this.notifications.list(farmId, userId, query);
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
}
