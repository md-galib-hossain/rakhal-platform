"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TelegramLinkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramLinkService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const jwt_1 = require("@nestjs/jwt");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const cache_service_1 = require("src/core/cache/cache.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const TELEGRAM_PROVIDER = 'telegram';
const LINK_TOKEN_TTL = '10m';
let TelegramLinkService = TelegramLinkService_1 = class TelegramLinkService {
    jwtService;
    prisma;
    cache;
    config;
    log;
    constructor(jwtService, prisma, cache, config, logger) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.log = logger.setContext(TelegramLinkService_1.name);
    }
    isWebhookSecretValid(headerValue) {
        return (Boolean(this.config.webhookSecret) &&
            headerValue === this.config.webhookSecret);
    }
    async mintConnectSession(userId, farmId) {
        const code = (0, crypto_1.randomInt)(100000, 1000000).toString();
        await this.cache.set(`telegram:link_code:${code}`, { userId, farmId }, 900);
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
    async mintLinkToken(userId, farmId) {
        const payload = {
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
    async getUserStatus(userId) {
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
    async unlinkUser(userId) {
        const result = await this.prisma.deviceToken.deleteMany({
            where: { userId, provider: TELEGRAM_PROVIDER },
        });
        this.log.info('User unlinked all Telegram chats', {
            userId,
            count: result.count,
        });
        return { unlinked: true, count: result.count };
    }
    async unlinkChat(chatId) {
        const result = await this.prisma.deviceToken.deleteMany({
            where: { token: String(chatId), provider: TELEGRAM_PROVIDER },
        });
        this.log.info('Telegram chat unlinked', {
            chatId: String(chatId),
            count: result.count,
        });
        return { unlinked: result.count > 0 };
    }
    async handleUpdate(update) {
        const chatId = update.message?.chat.id;
        const text = update.message?.text?.trim();
        if (chatId === undefined || !text)
            return;
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
                }
                else {
                    await this.handleStartWithToken(chatId, arg);
                }
            }
            else {
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
        await this.handleAiQueryFallback(chatId, text);
    }
    async handleLinkWithCode(chatId, code) {
        const cacheKey = `telegram:link_code:${code}`;
        const session = await this.cache.get(cacheKey);
        if (!session) {
            this.log.warn('Telegram link code rejected or expired', {
                chatId: String(chatId),
                code,
            });
            await this.reply(chatId, '⚠️ এই কোডটি সঠিক নয় অথবা এর মেয়াদ শেষ হয়ে গেছে। দয়া করে রাখাল অ্যাপ থেকে নতুন কোড নিন।');
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
        await this.reply(chatId, '✅ <b>অভিনন্দন! আপনার টেলিগ্রাম অ্যাকাউন্ট সফলভাবে রাখাল (Rakhal) অ্যাকাউন্টের সাথে যুক্ত হয়েছে।</b>');
    }
    async handleStartWithToken(chatId, token) {
        const payload = await this.verifyLinkToken(token);
        if (!payload) {
            this.log.warn('Telegram link token rejected', { chatId: String(chatId) });
            await this.reply(chatId, '⚠️ <b>Link Failed</b>\n\nThis connection link is invalid or has expired (valid for 10 minutes).\n\nPlease generate a new connection link from your <b>Rakhal Web or Mobile App</b> (Settings → Notifications).');
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
        await this.reply(chatId, '✅ <b>Rakhal Connected Successfully!</b>\n\nYour Telegram account is now linked to your Rakhal farm profile. You will receive real-time alerts for milk yields, cattle health, reproduction events, and tasks here.\n\nType /status to verify your connection or /help for more commands.');
    }
    async handleStartWelcome(chatId) {
        await this.reply(chatId, '👋 <b>Welcome to Rakhal (রাখাল)!</b>\n\nTo connect this bot to your dairy farm account:\n1. Open your <b>Rakhal Web or Mobile App</b>.\n2. Navigate to <b>Settings → Notifications</b>.\n3. Click <b>"Connect Telegram"</b>.\n\nOnce linked, you will receive real-time farm alerts and critical notifications directly in this chat!');
    }
    async handleStatus(chatId) {
        const token = await this.prisma.deviceToken.findFirst({
            where: { token: String(chatId), provider: TELEGRAM_PROVIDER },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!token) {
            await this.reply(chatId, '⚠️ <b>Not Connected</b>\n\nThis Telegram chat is not linked to any Rakhal account.\n\nTo connect, please visit <b>Settings → Notifications</b> in your Rakhal app and click "Connect Telegram".');
            return;
        }
        const userName = token.user?.name ?? 'Farm Member';
        await this.reply(chatId, `📊 <b>Rakhal Connection Status</b>\n\n• User: <b>${this.escapeHtml(userName)}</b>\n• Status: <b>Active & Linked</b>\n• Notifications: <b>Enabled</b>\n\nTo disconnect this chat from Rakhal, type /unlink.`);
    }
    async handleHelp(chatId) {
        await this.reply(chatId, '📖 <b>Rakhal Telegram Bot Commands:</b>\n\n/start - Connect or view setup guide\n/status - Check connection status\n/unlink - Disconnect this chat from Rakhal\n/help - View this help menu\n\n<i>Note: V2 conversational AI queries (e.g. asking "What is the milk collection today?" or cow health summaries) will be available in the upcoming release!</i>');
    }
    async handleUnlink(chatId) {
        const res = await this.unlinkChat(chatId);
        if (res.unlinked) {
            await this.reply(chatId, '👋 <b>Disconnected Successfully</b>\n\nYour Telegram account has been unlinked from Rakhal. You will no longer receive notifications here.\n\nYou can reconnect anytime from your Rakhal app settings.');
        }
        else {
            await this.reply(chatId, 'ℹ️ This chat is not currently connected to any Rakhal account.');
        }
    }
    async handleAiQueryFallback(chatId, userQuery) {
        const truncated = userQuery.slice(0, 80);
        await this.reply(chatId, `🐮 <b>Rakhal Assistant (V2 Preview)</b>\n\nWe received: <i>"${this.escapeHtml(truncated)}"</i>\n\nConversational AI queries (such as answering milk production numbers, cow health status, or feed stock) are currently in active development for V2.\n\nFor now, this bot delivers real-time farm alerts and critical notifications.`);
    }
    async verifyLinkToken(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token);
            if (payload.purpose !== 'telegram_link')
                return null;
            return payload;
        }
        catch (err) {
            this.log.warn('Telegram link token verify failed', {
                err: err.message,
            });
            return null;
        }
    }
    escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    async reply(chatId, text) {
        if (!this.config.botToken)
            return;
        try {
            await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML',
                }),
            });
        }
        catch (err) {
            this.log.warn('Telegram reply failed', { err: err.message });
        }
    }
};
exports.TelegramLinkService = TelegramLinkService;
exports.TelegramLinkService = TelegramLinkService = TelegramLinkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(env_1.telegramConfig.KEY)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService,
        cache_service_1.CacheService, void 0, logger_service_1.LoggerService])
], TelegramLinkService);
//# sourceMappingURL=telegram-link.service.js.map