import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CacheService } from 'src/core/cache/cache.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface TelegramUpdate {
    update_id?: number;
    message?: {
        message_id?: number;
        chat: {
            id: number | string;
            first_name?: string;
            username?: string;
        };
        from?: {
            id: number;
            first_name?: string;
            username?: string;
        };
        text?: string;
    };
}
export declare class TelegramLinkService {
    private readonly jwtService;
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly log;
    constructor(jwtService: JwtService, prisma: PrismaService, cache: CacheService, config: ConfigType<typeof telegramConfig>, logger: LoggerService);
    isWebhookSecretValid(headerValue: string | undefined): boolean;
    mintConnectSession(userId: string, farmId: string): Promise<{
        configured: boolean;
        botUsername: string;
        code: string;
        expiresIn: number;
        deepLink: string;
        qrPayload: string;
    }>;
    mintLinkToken(userId: string, farmId: string): Promise<{
        configured: boolean;
        deepLink: string | null;
    }>;
    getUserStatus(userId: string): Promise<{
        configured: boolean;
        linked: boolean;
        count: number;
        chats: {
            id: string;
            createdAt: Date;
        }[];
    }>;
    unlinkUser(userId: string): Promise<{
        unlinked: boolean;
        count: number;
    }>;
    unlinkChat(chatId: number | string): Promise<{
        unlinked: boolean;
    }>;
    handleUpdate(update: TelegramUpdate): Promise<void>;
    private handleLinkWithCode;
    private handleStartWithToken;
    private handleStartWelcome;
    private handleStatus;
    private handleHelp;
    private handleUnlink;
    private handleAiQueryFallback;
    private verifyLinkToken;
    private escapeHtml;
    reply(chatId: number | string, text: string): Promise<void>;
}
