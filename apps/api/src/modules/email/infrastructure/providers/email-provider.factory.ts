import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { EmailProvider } from '../../application/ports/email-provider.port';
import { ResendEmailProvider } from './resend-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

@Injectable()
export class EmailProviderFactory {
  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
    private readonly resendProvider: ResendEmailProvider,
    private readonly smtpProvider: SmtpEmailProvider,
  ) {}

  getProvider(): EmailProvider {
    switch (this.config.provider) {
      case 'smtp':
        return this.smtpProvider;
      case 'resend':
      default:
        return this.resendProvider;
    }
  }
}
