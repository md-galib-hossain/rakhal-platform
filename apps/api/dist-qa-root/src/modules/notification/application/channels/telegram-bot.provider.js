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
var TelegramBotProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotProvider = void 0;
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const TELEGRAM_PROVIDER = 'telegram';
let TelegramBotProvider = TelegramBotProvider_1 = class TelegramBotProvider {
    prisma;
    config;
    channel = 'telegram';
    log;
    constructor(prisma, config, logger) {
        this.prisma = prisma;
        this.config = config;
        this.log = logger.setContext(TelegramBotProvider_1.name);
    }
    isConfigured() {
        return Boolean(this.config.botToken);
    }
    async send(msg) {
        if (!this.config.botToken) {
            return { delivered: false, detail: 'not_configured' };
        }
        const chats = await this.prisma.deviceToken.findMany({
            where: { userId: msg.userId, provider: TELEGRAM_PROVIDER },
            select: { id: true, token: true },
        });
        if (chats.length === 0)
            return { delivered: false, detail: 'no_chats' };
        let success = 0;
        const stale = [];
        for (const chat of chats) {
            const ok = await this.sendToChat(chat.token, msg);
            if (ok === 'sent')
                success += 1;
            else if (ok === 'stale')
                stale.push(chat.id);
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
    getBadge(category, priority) {
        const isUrgent = priority?.toLowerCase() === 'urgent' ||
            priority?.toLowerCase() === 'high';
        switch (category?.toLowerCase()) {
            case 'health':
                return isUrgent ? '🚨 <b>[URGENT HEALTH]</b>' : '🩺 <b>[HEALTH]</b>';
            case 'milk':
                return isUrgent ? '🥛 <b>[MILK ALERT]</b>' : '🥛 <b>[MILK]</b>';
            case 'reproduction':
                return isUrgent
                    ? '🐂 <b>[REPRODUCTION ALERT]</b>'
                    : '🐂 <b>[REPRODUCTION]</b>';
            case 'feed':
            case 'inventory':
                return isUrgent
                    ? '📦 <b>[INVENTORY ALERT]</b>'
                    : '📦 <b>[INVENTORY]</b>';
            case 'finance':
                return '৳ <b>[FINANCE]</b>';
            case 'task':
                return isUrgent ? '📋 <b>[TASK OVERDUE]</b>' : '📋 <b>[TASK]</b>';
            default:
                return isUrgent ? '🔔 <b>[ALERT]</b>' : '🔔 <b>[RAKHAL]</b>';
        }
    }
    escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    async sendToChat(chatId, msg) {
        const badge = this.getBadge(msg.category, msg.priority);
        const escapedTitle = this.escapeHtml(msg.title);
        const escapedMessage = this.escapeHtml(msg.message);
        let text = `${badge} ${escapedTitle}\n\n${escapedMessage}`;
        const isHttpLink = Boolean(msg.link && /^https?:\/\//i.test(msg.link));
        const payload = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        };
        if (isHttpLink && msg.link) {
            payload.reply_markup = {
                inline_keyboard: [
                    [
                        {
                            text: '🔗 Open in Rakhal',
                            url: msg.link,
                        },
                    ],
                ],
            };
        }
        else if (msg.link) {
            text += `\n\n🔗 ${this.escapeHtml(msg.link)}`;
            payload.text = text;
        }
        try {
            const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok)
                return 'sent';
            const body = (await res
                .json()
                .catch(() => null));
            if (res.status === 429) {
                this.log.warn('Telegram rate limited (429)', {
                    chatId,
                    retryAfter: body?.parameters?.retry_after,
                });
                return 'failed';
            }
            const blocked = body?.error_code === 403 ||
                (body?.error_code === 400 && /chat not found/i.test(body.description));
            this.log.warn('Telegram send rejected', {
                status: res.status,
                errorCode: body?.error_code,
                description: body?.description,
            });
            return blocked ? 'stale' : 'failed';
        }
        catch (err) {
            this.log.warn('Telegram send error', { err: err.message });
            return 'failed';
        }
    }
};
exports.TelegramBotProvider = TelegramBotProvider;
exports.TelegramBotProvider = TelegramBotProvider = TelegramBotProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(env_1.telegramConfig.KEY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, void 0, logger_service_1.LoggerService])
], TelegramBotProvider);
//# sourceMappingURL=telegram-bot.provider.js.map