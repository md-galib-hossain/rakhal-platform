import { NotificationChannel } from '../../domain/notification-events';

/** The content a channel provider needs to deliver one notification to one user. */
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
  /** True if the message was accepted by the provider for at least one destination. */
  delivered: boolean;
  /** Free-text detail for logs (e.g. `2/3 tokens`, `no_devices`, `not_configured`). */
  detail?: string;
}

/**
 * A pluggable outbound delivery channel (PRD §20.1). The notification engine is
 * channel-agnostic: it resolves *which* channels a notification should go to from
 * the user's preferences, then hands each one to the matching provider here.
 *
 * To add a channel (SMS, WhatsApp, Telegram, …): implement this interface and add
 * the class to the `CHANNEL_PROVIDERS` array in `NotificationModule` — nothing in
 * the engine, the catalogue, the preferences, or any emitter changes. The in-app
 * channel has no provider (the `Notification` row *is* the delivery).
 */
export interface ChannelProvider {
  /** The channel this provider serves. Must be unique across registered providers. */
  readonly channel: NotificationChannel;

  /** True when the provider has the credentials/config it needs to actually send. */
  isConfigured(): boolean;

  /** Deliver the message. Must not throw — return `delivered:false` on failure. */
  send(msg: ChannelMessage): Promise<DeliveryResult>;
}

/** DI token for the array of registered channel providers. */
export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
