import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EmailService } from 'src/modules/email/application/services/email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import {
  OtpDeliveryChannel,
  OtpDeliveryRequest,
} from '../ports/otp-delivery-channel.port';

/**
 * Email OTP delivery (RAKHAL-215/216) — the live channel while MimSMS creds are
 * pending. Queues an `OTP_VERIFICATION` email via the existing BullMQ email
 * pipeline. The code is never logged.
 */
@Injectable()
export class EmailOtpChannel implements OtpDeliveryChannel {
  readonly channel = 'email' as const;

  constructor(private readonly email: EmailService) {}

  async send(request: OtpDeliveryRequest): Promise<void> {
    await this.email.queue({
      to: request.email,
      subject: 'Your Rakhal verification code',
      template: EmailTemplate.OTP_VERIFICATION,
      templateData: {
        name: request.name,
        code: request.code,
        minutes: Math.round(request.ttlSeconds / 60),
      },
      tenantId: request.userId,
      farmId: null,
      userId: request.userId,
      correlationId: randomUUID(),
    });
  }
}
