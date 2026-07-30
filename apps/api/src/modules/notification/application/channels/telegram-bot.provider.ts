import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import {
  ChannelMessage,
  ChannelProvider,
  DeliveryResult,
} from './channel-provider.port';

const TELEGRAM_PROVIDER = 'telegram';

interface TelegramApiError {
  ok: false;
  error_code: number;
  description: string;
}

/**
 * Telegram bot push channel (RAKHAL-257, PRD §20.1/§28.3). Talks the Telegram
 * Bot API directly via `fetch` — no SDK, mirrors `FcmPushProvider`'s shape.
 * Chat ids are captured by `TelegramLinkService` via the `/start` deep-link
 * webhook and stored in `DeviceToken` (`provider: 'telegram'`); this provider
 * only reads them. Unset `TELEGRAM_BOT_TOKEN` → `isConfigured() === false`,
 * so the channel silently defers (in-app still delivers), same as FCM.
 */
@Injectable()
export class TelegramBotProvider implements ChannelProvider {
  readonly channel: NotificationChannel = 'telegram';

  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(telegramConfig.KEY)
    private readonly config: ConfigType<typeof telegramConfig>,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TelegramBotProvider.name);
  }

  isConfigured(): boolean {
    return Boolean(this.config.botToken);
  }

  async send(msg: ChannelMessage): Promise<DeliveryResult> {
    if (!this.config.botToken) {
      return { delivered: false, detail: 'not_configured' };
    }

    const chats = await this.prisma.deviceToken.findMany({
      where: { userId: msg.userId, provider: TELEGRAM_PROVIDER },
      select: { id: true, token: true },
    });
    if (chats.length === 0) return { delivered: false, detail: 'no_chats' };

    let success = 0;
    const stale: string[] = [];
    for (const chat of chats) {
      const ok = await this.sendToChat(chat.token, msg);
      if (ok === 'sent') success += 1;
      else if (ok === 'stale') stale.push(chat.id);
    }
    if (stale.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { id: { in: stale } },
      });
    }
    return {
      delivered: success > 0,
      detail: `${success}/${chats.length} chats`,
    };
  }

  private async sendToChat(
    chatId: string,
    msg: ChannelMessage,
  ): Promise<'sent' | 'stale' | 'failed'> {
    const text = msg.link
      ? `${msg.title}\n${msg.message}\n${msg.link}`
      : `${msg.title}\n${msg.message}`;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        },
      );
      if (res.ok) return 'sent';

      const body = (await res
        .json()
        .catch(() => null)) as TelegramApiError | null;
      const blocked =
        body?.error_code === 403 ||
        (body?.error_code === 400 && /chat not found/i.test(body.description));
      this.log.warn('Telegram send rejected', {
        status: res.status,
        errorCode: body?.error_code,
      });
      return blocked ? 'stale' : 'failed';
    } catch (err) {
      this.log.warn('Telegram send error', { err: (err as Error).message });
      return 'failed';
    }
  }
}
