import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentFarmId,
  CurrentUserId,
  ThrottleWrite,
} from 'src/common/decorators';
import { IdParamDto } from 'src/common/dto';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import {
  Actor,
  NotificationScheduleService,
} from '../../application/services/notification-schedule.service';
import { CreateNotificationScheduleDto } from '../dto/create-notification-schedule.dto';
import { ListNotificationSchedulesQueryDto } from '../dto/list-notification-schedules-query.dto';
import { UpcomingNotificationsQueryDto } from '../dto/upcoming-notifications-query.dto';
import { UpdateNotificationScheduleDto } from '../dto/update-notification-schedule.dto';

type AuthedRequest = Request & {
  auth: { user: { permissionsVersion: number } };
};

/**
 * Manual notifications (RAKHAL-494, docs/EPIC_NOTIFICATIONS_V2.md §4): the composer's schedules, the preview and the
 * Upcoming tab. `notification.create` covers a user's own schedules (Worker: only for themselves);
 * `notification.manage` (Owner, Manager) targets other users or roles and sees/edits every USER schedule in the farm.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class NotificationScheduleController {
  constructor(
    private readonly schedules: NotificationScheduleService,
    private readonly permissions: PermissionService,
  ) {}

  private async actor(
    req: AuthedRequest,
    farmId: string,
    userId: string,
  ): Promise<Actor> {
    const canManage = await this.permissions.hasPermission(
      userId,
      farmId,
      req.auth.user.permissionsVersion,
      ['notification.manage'],
    );
    return { userId, canManage };
  }

  @Get('upcoming')
  @RequirePermission('notification.read')
  async upcoming(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query() query: UpcomingNotificationsQueryDto,
  ) {
    return this.schedules.upcoming(
      farmId,
      await this.actor(req, farmId, userId),
      query,
    );
  }

  @Get('schedules')
  @RequirePermission('notification.read')
  async list(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query() query: ListNotificationSchedulesQueryDto,
  ) {
    return this.schedules.list(
      farmId,
      await this.actor(req, farmId, userId),
      query,
    );
  }

  /** Declared before the `:id` routes. No write; the same body as create. */
  @Post('schedules/preview')
  @RequirePermission('notification.create')
  @ThrottleWrite()
  async preview(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateNotificationScheduleDto,
  ) {
    return this.schedules.preview(
      farmId,
      await this.actor(req, farmId, userId),
      dto,
    );
  }

  @Post('schedules')
  @RequirePermission('notification.create')
  @ThrottleWrite()
  async create(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateNotificationScheduleDto,
  ) {
    return this.schedules.create(
      farmId,
      await this.actor(req, farmId, userId),
      dto,
    );
  }

  @Get('schedules/:id')
  @RequirePermission('notification.read')
  async get(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param() { id }: IdParamDto,
  ) {
    return this.schedules.get(
      farmId,
      await this.actor(req, farmId, userId),
      id,
    );
  }

  @Patch('schedules/:id')
  @RequirePermission('notification.create')
  @ThrottleWrite()
  async update(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param() { id }: IdParamDto,
    @Body() dto: UpdateNotificationScheduleDto,
  ) {
    return this.schedules.update(
      farmId,
      await this.actor(req, farmId, userId),
      id,
      dto,
    );
  }

  @Post('schedules/:id/pause')
  @RequirePermission('notification.create')
  async pause(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param() { id }: IdParamDto,
  ) {
    return this.schedules.pause(
      farmId,
      await this.actor(req, farmId, userId),
      id,
    );
  }

  @Post('schedules/:id/resume')
  @RequirePermission('notification.create')
  async resume(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param() { id }: IdParamDto,
  ) {
    return this.schedules.resume(
      farmId,
      await this.actor(req, farmId, userId),
      id,
    );
  }

  @Delete('schedules/:id')
  @RequirePermission('notification.create')
  async cancel(
    @Req() req: AuthedRequest,
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param() { id }: IdParamDto,
  ) {
    return this.schedules.cancel(
      farmId,
      await this.actor(req, farmId, userId),
      id,
    );
  }
}
