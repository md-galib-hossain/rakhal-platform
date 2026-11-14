import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Resend } from 'resend';
import { emailConfig } from 'src/core/config/env';
import { EmailProvider } from '../../application/ports/email-provider.port';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
  ) {
    this.client = new Resend(this.config.resendApiKey);
  }

  async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<void> {
    await this.client.emails.send({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });
  }
}
