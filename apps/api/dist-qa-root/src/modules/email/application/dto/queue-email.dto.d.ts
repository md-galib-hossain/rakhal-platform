import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { AppLanguage } from 'src/common/i18n/language';
export interface QueueEmailAttachment {
    filename: string;
    contentBase64: string;
    contentType?: string;
}
export interface QueueEmailDto {
    emailId: string;
    to: string;
    subject: string;
    template: EmailTemplate;
    tenantId: string;
    farmId: string | null;
    userId: string | null;
    correlationId?: string;
    templateData: Record<string, unknown>;
    locale?: AppLanguage;
    sendAt?: Date;
    includePdf?: boolean;
    attachments?: QueueEmailAttachment[];
    idempotencyKey?: string;
}
