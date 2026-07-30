import {
  Body,
  Controller,
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
 * Telegram account linking (RAKHAL-257). `/notifications/telegram/link-token`
 * is a normal farm-scoped route (self-service, own account only). The webhook
 * is called by Telegram itself — no farm guard chain — authenticated instead
 * by the `X-Telegram-Bot-Api-Secret-Token` header set on `setWebhook`.
 */
@ApiTags('Notifications')
@Controller('notifications/telegram')
export class TelegramLinkController {
  constructor(private readonly telegramLink: TelegramLinkService) {}

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
