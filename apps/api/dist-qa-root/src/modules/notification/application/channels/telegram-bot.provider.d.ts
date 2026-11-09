import type { ConfigType } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import { ChannelMessage, ChannelProvider, DeliveryResult } from './channel-provider.port';
export declare class TelegramBotProvider implements ChannelProvider {
    private readonly prisma;
    private readonly config;
    readonly channel: NotificationChannel;
    private readonly log;
    constructor(prisma: PrismaService, config: ConfigType<typeof telegramConfig>, logger: LoggerService);
    isConfigured(): boolean;
    send(msg: ChannelMessage): Promise<DeliveryResult>;
    private getBadge;
    private escapeHtml;
    private sendToChat;
}
