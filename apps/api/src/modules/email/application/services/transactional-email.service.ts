import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { EmailService } from './email.service';

export interface TransactionalEmailInput {
  /** Stable key per (event, entity) — a replay with the same key is dropped. */
  idempotencyKey: string;
  to: string;
  subject: string;
  template: EmailTemplate;
  templateData: Record<string, unknown>;
  tenantId: string;
  farmId: string | null;
  userId: string | null;
}

/**
 * Transactional email dispatcher (RAKHAL-238, PRD §36.3). Wraps the BullMQ email
 * pipeline with **idempotency**: a stable `idempotencyKey` (unique on `EmailLog`)
 * makes a replayed trigger — a re-run sweep, a retried webhook — a no-op, so a
 * customer never gets a duplicate receipt/expiry/welcome mail (COM-02). Billing +
 * legal mails are transactional and always send (they bypass marketing opt-out).
 * Best-effort by design: callers wrap in try/catch so a mail hiccup never breaks
 * the business action that triggered it.
 */
@Injectable()
export class TransactionalEmailService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TransactionalEmailService.name);
  }

  /** Queue the email once. Returns whether it was sent (false = already sent). */
  async sendOnce(input: TransactionalEmailInput): Promise<{ sent: boolean }> {
    const existing = await this.prisma.emailLog.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      this.log.info('Transactional email deduped', {
        idempotencyKey: input.idempotencyKey,
        template: input.template,
      });
      return { sent: false };
    }

    try {
      await this.email.queue({
        to: input.to,
        subject: input.subject,
        template: input.template,
        templateData: input.templateData,
        tenantId: input.tenantId,
        farmId: input.farmId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      });
      return { sent: true };
    } catch (err) {
      // A concurrent caller won the unique-key race — treat as already sent.
      if ((err as { code?: string }).code === 'P2002') {
        return { sent: false };
      }
      throw err;
    }
  }
}
