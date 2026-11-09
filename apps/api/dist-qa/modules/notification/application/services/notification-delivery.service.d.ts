import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import { ChannelMessage, ChannelProvider, DeliveryResult } from '../channels/channel-provider.port';
export declare class NotificationDeliveryService {
    private readonly log;
    private readonly byChannel;
    constructor(providers: ChannelProvider[], logger: LoggerService);
    deliver(channel: NotificationChannel, msg: ChannelMessage): Promise<DeliveryResult>;
}
