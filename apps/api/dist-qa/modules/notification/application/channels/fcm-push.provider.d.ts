import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import { ChannelMessage, ChannelProvider, DeliveryResult } from './channel-provider.port';
export declare class FcmPushProvider implements ChannelProvider {
    private readonly prisma;
    readonly channel: NotificationChannel;
    private readonly log;
    private readonly creds;
    private accessToken;
    constructor(prisma: PrismaService, logger: LoggerService);
    isConfigured(): boolean;
    send(msg: ChannelMessage): Promise<DeliveryResult>;
    private sendToToken;
    private getAccessToken;
    private loadCredentials;
}
