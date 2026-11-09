import { TelegramLinkService } from '../../application/services/telegram-link.service';
import type { TelegramUpdate } from '../../application/services/telegram-link.service';
export declare class TelegramLinkController {
    private readonly telegramLink;
    constructor(telegramLink: TelegramLinkService);
    getConnectSession(userId: string, farmId: string): Promise<{
        configured: boolean;
        botUsername: string;
        code: string;
        expiresIn: number;
        deepLink: string;
        qrPayload: string;
    }>;
    getLinkToken(userId: string, farmId: string): Promise<{
        configured: boolean;
        deepLink: string | null;
    }>;
    getStatus(userId: string): Promise<{
        configured: boolean;
        linked: boolean;
        count: number;
        chats: {
            id: string;
            createdAt: Date;
        }[];
    }>;
    unlink(userId: string): Promise<{
        unlinked: boolean;
        count: number;
    }>;
    webhook(secret: string | undefined, update: TelegramUpdate): Promise<{
        ok: boolean;
    }>;
}
