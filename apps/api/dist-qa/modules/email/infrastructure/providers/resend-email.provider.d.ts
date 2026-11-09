import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { EmailProvider } from '../../application/ports/email-provider.port';
export declare class ResendEmailProvider implements EmailProvider {
    private readonly config;
    private readonly client;
    constructor(config: ConfigType<typeof emailConfig>);
    sendEmail(input: {
        to: string;
        subject: string;
        html: string;
        attachments?: Array<{
            filename: string;
            content: Buffer;
            contentType: string;
        }>;
    }): Promise<void>;
}
