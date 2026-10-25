import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminCommunicationsService } from '../../application/services/admin-communications.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import {
  AdminBroadcastMessageDto,
  AdminSendMessageDto,
} from '../dto/admin-communication.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

@ApiTags('Admin — Communications')
@ApiBearerAuth()
@Controller('admin/communications')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminCommunicationsController {
  constructor(private readonly communications: AdminCommunicationsService) {}

  @Get('stats')
  @RequireAdminPermission('user.read')
  getChannelStats() {
    return this.communications.getChannelStats();
  }

  @Post('users/:id/message')
  @HttpCode(200)
  @ThrottleWrite()
  @RequireAdminPermission('user.manage')
  sendMessageToUser(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') userId: string,
    @Body() dto: AdminSendMessageDto,
  ) {
    return this.communications.sendDirectMessage(admin.id, userId, dto);
  }

  @Post('broadcast')
  @HttpCode(200)
  @ThrottleWrite()
  @RequireAdminPermission('user.manage')
  broadcast(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: AdminBroadcastMessageDto,
  ) {
    return this.communications.broadcast(admin.id, dto);
  }
}
