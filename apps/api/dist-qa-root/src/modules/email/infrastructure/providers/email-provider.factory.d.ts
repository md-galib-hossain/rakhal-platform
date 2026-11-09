import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { EmailProvider } from '../../application/ports/email-provider.port';
import { ResendEmailProvider } from './resend-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
export declare class EmailProviderFactory {
    private readonly config;
    private readonly resendProvider;
    private readonly smtpProvider;
    constructor(config: ConfigType<typeof emailConfig>, resendProvider: ResendEmailProvider, smtpProvider: SmtpEmailProvider);
    getProvider(): EmailProvider;
}
