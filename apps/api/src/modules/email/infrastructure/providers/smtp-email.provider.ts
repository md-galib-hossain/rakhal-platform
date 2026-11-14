import { Injectable } from '@nestjs/common';
import { EmailProvider } from '../../application/ports/email-provider.port';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  sendEmail(): Promise<void> {
    throw new Error('SMTP provider is not configured in this deployment');
  }
}
