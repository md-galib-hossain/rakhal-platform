import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CacheService } from 'src/core/cache/cache.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

const TELEGRAM_PROVIDER = 'telegram';
const LINK_TOKEN_TTL = '10m';

interface TelegramLinkPayload {
  purpose: 'telegram_link';
  userId: string;
  farmId: string;
}

interface TelegramLinkCodeSession {
  userId: string;
  farmId: string;
}

/** Minimal shape of a Telegram Bot API `Update` */
export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat: { id: number | string; first_name?: string; username?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
}

/**
 * Telegram account-linking & command flow (RAKHAL-257, PRD §20.1/§28.3).
 *
 * 1. Linking: A signed, short-lived JWT stands in for a one-time link code.
 *    `mintLinkToken` embeds `userId`/`farmId`, the user opens `t.me/<bot>?start=<token>`
 *    from the app, and the webhook's `/start <token>` verifies it and stores the chat id
 *    in `DeviceToken` (`provider: 'telegram'`).
 * 2. Commands: Supports `/start`, `/status`, `/help`, `/unlink`, and natural language queries.
 * 3. AI Seam: Non-command queries are received and greeted with a V2 preview notice,
 *    establishing the forward-compatible integration point for the LLM farm query engine.
 */
@Injectable()
export class TelegramLinkService {
  private readonly log: LoggerService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
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

  async mintConnectSession(userId: string, farmId: string) {
    const code = randomInt(100000, 1000000).toString();
    await this.cache.set<TelegramLinkCodeSession>(
      `telegram:link_code:${code}`,
      { userId, farmId },
      900,
    );
    const botUsername = this.config.botUsername ?? '';
    const configured = Boolean(this.config.botToken && botUsername);
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=${code}`
      : '';
    return {
      configured,
      botUsername,
      code,
      expiresIn: 900,
      deepLink,
      qrPayload: deepLink || code,
    };
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

  /** Check if a user has linked Telegram chats */
  async getUserStatus(userId: string) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, provider: TELEGRAM_PROVIDER },
      select: { id: true, token: true, createdAt: true, lastSeenAt: true },
    });
    return {
      configured: Boolean(this.config.botToken && this.config.botUsername),
      linked: tokens.length > 0,
      count: tokens.length,
      chats: tokens.map((t) => ({ id: t.id, createdAt: t.createdAt })),
    };
  }

  /** Unlink all Telegram chats for a user (web self-service) */
  async unlinkUser(userId: string) {
    const result = await this.prisma.deviceToken.deleteMany({
      where: { userId, provider: TELEGRAM_PROVIDER },
    });
    this.log.info('User unlinked all Telegram chats', {
      userId,
      count: result.count,
    });
    return { unlinked: true, count: result.count };
  }

  /** Unlink a single chat ID (bot command) */
  async unlinkChat(chatId: number | string) {
    const result = await this.prisma.deviceToken.deleteMany({
      where: { token: String(chatId), provider: TELEGRAM_PROVIDER },
    });
    this.log.info('Telegram chat unlinked', {
      chatId: String(chatId),
      count: result.count,
    });
    return { unlinked: result.count > 0 };
  }

  /** Handle one incoming Telegram webhook update. Never throws — always 200s. */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const chatId = update.message?.chat.id;
    const text = update.message?.text?.trim();
    if (chatId === undefined || !text) return;

    if (/^\d{6}$/.test(text)) {
      await this.handleLinkWithCode(chatId, text);
      return;
    }

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const arg = parts[1];
      if (arg) {
        if (/^\d{6}$/.test(arg)) {
          await this.handleLinkWithCode(chatId, arg);
        } else {
          await this.handleStartWithToken(chatId, arg);
        }
      } else {
        await this.handleStartWelcome(chatId);
      }
      return;
    }

    if (text.startsWith('/status')) {
      await this.handleStatus(chatId);
      return;
    }

    if (text.startsWith('/help')) {
      await this.handleHelp(chatId);
      return;
    }

    if (text.startsWith('/unlink')) {
      await this.handleUnlink(chatId);
      return;
    }

    // Fallback for natural language text queries (V2 AI assistant seam)
    await this.handleAiQueryFallback(chatId, text);
  }

  private async handleLinkWithCode(
    chatId: number | string,
    code: string,
  ): Promise<void> {
    const cacheKey = `telegram:link_code:${code}`;
    const session = await this.cache.get<TelegramLinkCodeSession>(cacheKey);

    if (!session) {
      this.log.warn('Telegram link code rejected or expired', {
        chatId: String(chatId),
        code,
      });
      await this.reply(
        chatId,
        '⚠️ এই কোডটি সঠিক নয় অথবা এর মেয়াদ শেষ হয়ে গেছে। দয়া করে রাখাল অ্যাপ থেকে নতুন কোড নিন।',
      );
      return;
    }

    await this.prisma.deviceToken.upsert({
      where: { token: String(chatId) },
      create: {
        userId: session.userId,
        farmId: session.farmId,
        token: String(chatId),
        platform: 'telegram',
        provider: TELEGRAM_PROVIDER,
      },
      update: {
        userId: session.userId,
        farmId: session.farmId,
        lastSeenAt: new Date(),
      },
    });

    await this.cache.delete(cacheKey);

    this.log.info('Telegram account linked via code', {
      userId: session.userId,
      chatId: String(chatId),
    });

    await this.reply(
      chatId,
      '✅ <b>অভিনন্দন! আপনার টেলিগ্রাম অ্যাকাউন্ট সফলভাবে রাখাল (Rakhal) অ্যাকাউন্টের সাথে যুক্ত হয়েছে।</b>',
    );
  }

  private async handleStartWithToken(
    chatId: number | string,
    token: string,
  ): Promise<void> {
    const payload = await this.verifyLinkToken(token);
    if (!payload) {
      this.log.warn('Telegram link token rejected', { chatId: String(chatId) });
      await this.reply(
        chatId,
        '⚠️ <b>Link Failed</b>\n\nThis connection link is invalid or has expired (valid for 10 minutes).\n\nPlease generate a new connection link from your <b>Rakhal Web or Mobile App</b> (Settings → Notifications).',
      );
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

    await this.reply(
      chatId,
      '✅ <b>Rakhal Connected Successfully!</b>\n\nYour Telegram account is now linked to your Rakhal farm profile. You will receive real-time alerts for milk yields, cattle health, reproduction events, and tasks here.\n\nType /status to verify your connection or /help for more commands.',
    );
  }

  private async handleStartWelcome(chatId: number | string): Promise<void> {
    await this.reply(
      chatId,
      '👋 <b>Welcome to Rakhal (রাখাল)!</b>\n\nTo connect this bot to your dairy farm account:\n1. Open your <b>Rakhal Web or Mobile App</b>.\n2. Navigate to <b>Settings → Notifications</b>.\n3. Click <b>"Connect Telegram"</b>.\n\nOnce linked, you will receive real-time farm alerts and critical notifications directly in this chat!',
    );
  }

  private async handleStatus(chatId: number | string): Promise<void> {
    const token = await this.prisma.deviceToken.findFirst({
      where: { token: String(chatId), provider: TELEGRAM_PROVIDER },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!token) {
      await this.reply(
        chatId,
        '⚠️ <b>Not Connected</b>\n\nThis Telegram chat is not linked to any Rakhal account.\n\nTo connect, please visit <b>Settings → Notifications</b> in your Rakhal app and click "Connect Telegram".',
      );
      return;
    }

    const userName = token.user?.name ?? 'Farm Member';
    await this.reply(
      chatId,
      `📊 <b>Rakhal Connection Status</b>\n\n• User: <b>${this.escapeHtml(userName)}</b>\n• Status: <b>Active & Linked</b>\n• Notifications: <b>Enabled</b>\n\nTo disconnect this chat from Rakhal, type /unlink.`,
    );
  }

  private async handleHelp(chatId: number | string): Promise<void> {
    await this.reply(
      chatId,
      '📖 <b>Rakhal Telegram Bot Commands:</b>\n\n/start - Connect or view setup guide\n/status - Check connection status\n/unlink - Disconnect this chat from Rakhal\n/help - View this help menu\n\n<i>Note: V2 conversational AI queries (e.g. asking "What is the milk collection today?" or cow health summaries) will be available in the upcoming release!</i>',
    );
  }

  private async handleUnlink(chatId: number | string): Promise<void> {
    const res = await this.unlinkChat(chatId);
    if (res.unlinked) {
      await this.reply(
        chatId,
        '👋 <b>Disconnected Successfully</b>\n\nYour Telegram account has been unlinked from Rakhal. You will no longer receive notifications here.\n\nYou can reconnect anytime from your Rakhal app settings.',
      );
    } else {
      await this.reply(
        chatId,
        'ℹ️ This chat is not currently connected to any Rakhal account.',
      );
    }
  }

  private async handleAiQueryFallback(
    chatId: number | string,
    userQuery: string,
  ): Promise<void> {
    // Forward-compatible seam for V2 Conversational AI Assistant
    const truncated = userQuery.slice(0, 80);
    await this.reply(
      chatId,
      `🐮 <b>Rakhal Assistant (V2 Preview)</b>\n\nWe received: <i>"${this.escapeHtml(truncated)}"</i>\n\nConversational AI queries (such as answering milk production numbers, cow health status, or feed stock) are currently in active development for V2.\n\nFor now, this bot delivers real-time farm alerts and critical notifications.`,
    );
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

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async reply(chatId: number | string, text: string): Promise<void> {
    if (!this.config.botToken) return;
    try {
      await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        },
      );
    } catch (err) {
      this.log.warn('Telegram reply failed', { err: (err as Error).message });
    }
  }
}
