import { EmailTemplate } from '../../domain/enums/email-template.enum';

/**
 * A pre-rendered attachment carried on the queued job. `contentBase64` keeps the
 * payload JSON-serializable through BullMQ/Redis (a raw Buffer isn't). Used by the
 * billing receipt PDF (RAKHAL-237); the processor decodes it back to a Buffer.
 */
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
  sendAt?: Date;
  includePdf?: boolean;
  attachments?: QueueEmailAttachment[];
  /** Transactional idempotency key (RAKHAL-238) — a duplicate is dropped. */
  idempotencyKey?: string;
}
