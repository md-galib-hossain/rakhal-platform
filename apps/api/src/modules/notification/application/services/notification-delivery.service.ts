import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import {
  ChannelMessage,
  ChannelProvider,
  CHANNEL_PROVIDERS,
  DeliveryResult,
} from '../channels/channel-provider.port';

/**
 * Outbound-channel dispatcher (PRD §20.1). Channel-agnostic: it routes each
 * external channel to its registered `ChannelProvider` and never throws. A
 * channel with no provider — or a provider that isn't configured (no creds yet,
 * e.g. SMS/WhatsApp/Telegram) — is **deferred** (logged), so the rest of the
 * notification still goes out. `in_app` never reaches here (the row is the
 * delivery). Add a channel by registering its provider in `CHANNEL_PROVIDERS`.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly log: LoggerService;
  private readonly byChannel: Map<NotificationChannel, ChannelProvider>;

  constructor(
    @Inject(CHANNEL_PROVIDERS) providers: ChannelProvider[],
    logger: LoggerService,
  ) {
    this.log = logger.setContext(NotificationDeliveryService.name);
    this.byChannel = new Map(providers.map((p) => [p.channel, p]));
  }

  async deliver(
    channel: NotificationChannel,
    msg: ChannelMessage,
  ): Promise<DeliveryResult> {
    if (channel === 'in_app') return { delivered: true };

    const provider = this.byChannel.get(channel);
    if (!provider || !provider.isConfigured()) {
      this.log.info('Channel deferred (no provider configured)', {
        channel,
        userId: msg.userId,
        eventKey: msg.eventKey,
      });
      return { delivered: false, detail: 'not_configured' };
    }

    const result = await provider.send(msg);
    this.log.info('Channel dispatched', {
      channel,
      userId: msg.userId,
      eventKey: msg.eventKey,
      delivered: result.delivered,
      detail: result.detail,
    });
    return result;
  }
}
