import { EmailTemplate } from '../../domain/enums/email-template.enum';

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
  sendAt?: Date;
  includePdf?: boolean;
}
