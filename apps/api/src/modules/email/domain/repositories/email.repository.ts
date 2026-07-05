import type { EmailLog } from '@prisma/client';
import { EmailTemplate } from '../enums/email-template.enum';

export const EMAIL_REPOSITORY = Symbol('EMAIL_REPOSITORY');

export interface EmailRepository {
  create(data: {
    id: string;
    to: string;
    subject: string;
    template: EmailTemplate;
    tenantId: string;
    farmId: string | null;
    userId: string | null;
    correlationId?: string;
    scheduledAt?: Date;
    idempotencyKey?: string;
  }): Promise<EmailLog>;

  markProcessing(emailId: string): Promise<EmailLog>;

  markSent(emailId: string, provider: string): Promise<EmailLog>;

  markFailed(
    emailId: string,
    errorMessage: string,
    retries: number,
  ): Promise<EmailLog>;
}
