import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TelegramLinkService } from '../../application/services/telegram-link.service';
import type { TelegramUpdate } from '../../application/services/telegram-link.service';

const WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Telegram account linking & status management (RAKHAL-257).
 * - `/notifications/telegram/link-token`: mints a 10m JWT deep link.
 * - `/notifications/telegram/status`: checks if user has active Telegram link.
 * - `/notifications/telegram/link`: unlinks user's Telegram connection.
 * - `/notifications/telegram/webhook`: inbound update receiver from Telegram Bot API.
 */
@ApiTags('Notifications')
@Controller('notifications/telegram')
export class TelegramLinkController {
  constructor(private readonly telegramLink: TelegramLinkService) {}

  @Get('connect-session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('notification.read')
  getConnectSession(
    @CurrentUserId() userId: string,
    @CurrentFarmId() farmId: string,
  ) {
    return this.telegramLink.mintConnectSession(userId, farmId);
  }

  @Get('link-token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('notification.read')
  getLinkToken(
    @CurrentUserId() userId: string,
    @CurrentFarmId() farmId: string,
  ) {
    return this.telegramLink.mintLinkToken(userId, farmId);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('notification.read')
  getStatus(@CurrentUserId() userId: string) {
    return this.telegramLink.getUserStatus(userId);
  }

  @Delete('link')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('notification.read')
  unlink(@CurrentUserId() userId: string) {
    return this.telegramLink.unlinkUser(userId);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers(WEBHOOK_SECRET_HEADER) secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    if (!this.telegramLink.isWebhookSecretValid(secret)) {
      return { ok: true };
    }
    await this.telegramLink.handleUpdate(update);
    return { ok: true };
  }
}
