import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

const TELEGRAM_PROVIDER = 'telegram';
const LINK_TOKEN_TTL = '10m';

interface TelegramLinkPayload {
  purpose: 'telegram_link';
  userId: string;
  farmId: string;
}

/** Minimal shape of a Telegram Bot API `Update` — only what `/start` needs. */
export interface TelegramUpdate {
  message?: {
    chat: { id: number | string };
    text?: string;
  };
}

/**
 * Telegram account-linking flow (RAKHAL-257, PRD §20.1/§28.3). A signed,
 * short-lived JWT stands in for a one-time link code: `mintLinkToken` embeds
 * `userId`/`farmId`, the user opens `t.me/<bot>?start=<token>` from the app,
 * and the webhook's `/start <token>` message verifies it and stores the chat
 * id in `DeviceToken` (`provider: 'telegram'`) — the same table FCM uses, no
 * new schema. No DB round-trip needed to mint the link; the JWT itself is
 * the state, so a stale/replayed token past its 10-minute TTL just fails.
 */
@Injectable()
export class TelegramLinkService {
  private readonly log: LoggerService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(telegramConfig.KEY)
    private readonly config: ConfigType<typeof telegramConfig>,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TelegramLinkService.name);
  }

  isWebhookSecretValid(headerValue: string | undefined): boolean {
    return (
      Boolean(this.config.webhookSecret) &&
      headerValue === this.config.webhookSecret
    );
  }

  async mintLinkToken(userId: string, farmId: string) {
    const payload: TelegramLinkPayload = {
      purpose: 'telegram_link',
      userId,
      farmId,
    };
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: LINK_TOKEN_TTL,
    });
    const botUsername = this.config.botUsername;
    return {
      configured: Boolean(this.config.botToken && botUsername),
      deepLink: botUsername
        ? `https://t.me/${botUsername}?start=${token}`
        : null,
    };
  }

  /** Handle one incoming Telegram webhook update. Never throws — always 200s. */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const chatId = update.message?.chat.id;
    const text = update.message?.text?.trim();
    if (chatId === undefined || !text?.startsWith('/start')) return;

    const token = text.split(/\s+/)[1];
    if (!token) return;

    const payload = await this.verifyLinkToken(token);
    if (!payload) {
      this.log.warn('Telegram link token rejected', { chatId: String(chatId) });
      return;
    }

    await this.prisma.deviceToken.upsert({
      where: { token: String(chatId) },
      create: {
        userId: payload.userId,
        farmId: payload.farmId,
        token: String(chatId),
        platform: 'telegram',
        provider: TELEGRAM_PROVIDER,
      },
      update: {
        userId: payload.userId,
        farmId: payload.farmId,
        lastSeenAt: new Date(),
      },
    });
    this.log.info('Telegram account linked', { userId: payload.userId });

    await this.reply(chatId, 'Rakhal linked. You will receive alerts here.');
  }

  private async verifyLinkToken(
    token: string,
  ): Promise<TelegramLinkPayload | null> {
    try {
      const payload =
        await this.jwtService.verifyAsync<TelegramLinkPayload>(token);
      if (payload.purpose !== 'telegram_link') return null;
      return payload;
    } catch (err) {
      this.log.warn('Telegram link token verify failed', {
        err: (err as Error).message,
      });
      return null;
    }
  }

  private async reply(chatId: number | string, text: string): Promise<void> {
    if (!this.config.botToken) return;
    try {
      await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        },
      );
    } catch (err) {
      this.log.warn('Telegram reply failed', { err: (err as Error).message });
    }
  }
}
