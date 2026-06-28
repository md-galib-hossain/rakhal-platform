import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';

/**
 * External-channel delivery seam (PRD §20.1). SMS / WhatsApp / Email all require
 * a provider that has not been chosen yet (blocked — see DECISIONS), so this is a
 * **stub**: it records intent in the log and returns. The in-app channel needs no
 * provider (the `Notification` row *is* the delivery), so it never reaches here.
 * Swap the body for a real provider (RAKHAL-110) with no change to callers.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly log: LoggerService;

  constructor(logger: LoggerService) {
    this.log = logger.setContext(NotificationDeliveryService.name);
  }

  deliver(
    channel: NotificationChannel,
    userId: string,
    eventKey: string,
  ): void {
    if (channel === 'in_app') return;
    // No provider yet — record the intent so it's observable and forward-compatible.
    this.log.info('External notification deferred (no provider)', {
      channel,
      userId,
      eventKey,
    });
  }
}
