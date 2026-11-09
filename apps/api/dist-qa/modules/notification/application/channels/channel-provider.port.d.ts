import { NotificationChannel } from '../../domain/notification-events';
export interface ChannelMessage {
    userId: string;
    eventKey: string;
    category: string;
    priority: string;
    title: string;
    message: string;
    link?: string | null;
}
export interface DeliveryResult {
    delivered: boolean;
    detail?: string;
}
export interface ChannelProvider {
    readonly channel: NotificationChannel;
    isConfigured(): boolean;
    send(msg: ChannelMessage): Promise<DeliveryResult>;
}
export declare const CHANNEL_PROVIDERS: unique symbol;
