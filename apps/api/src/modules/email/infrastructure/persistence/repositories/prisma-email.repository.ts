import { Injectable } from '@nestjs/common';
import type {
  EmailLog,
  EmailTemplate as PrismaEmailTemplate,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EmailRepository } from 'src/modules/email/domain/repositories/email.repository';
import { EmailStatus } from 'src/modules/email/domain/enums/email-status.enum';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';

@Injectable()
export class PrismaEmailRepository implements EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    id: string;
    to: string;
    subject: string;
    template: EmailTemplate;
    tenantId: string;
    farmId: string | null;
    userId: string | null;
    correlationId?: string;
    scheduledAt?: Date;
  }): Promise<EmailLog> {
    const result = await this.prisma.emailLog.create({
      data: {
        id: data.id,
        to: data.to,
        subject: data.subject,
        tenantId: data.tenantId,
        farmId: data.farmId,
        userId: data.userId,
        correlationId: data.correlationId,
        template: data.template as unknown as PrismaEmailTemplate,
        status: EmailStatus.QUEUED,
        scheduledAt: data.scheduledAt,
      },
    });
    return result;
  }

  async markProcessing(emailId: string): Promise<EmailLog> {
    const result = await this.prisma.emailLog.update({
      where: { id: emailId },
      data: { status: EmailStatus.PROCESSING },
    });
    return result;
  }

  async markSent(emailId: string, provider: string): Promise<EmailLog> {
    const result = await this.prisma.emailLog.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        provider,
        sentAt: new Date(),
      },
    });
    return result;
  }

  async markFailed(
    emailId: string,
    errorMessage: string,
    retries: number,
  ): Promise<EmailLog> {
    const result = await this.prisma.emailLog.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.FAILED,
        errorMessage,
        retries,
      },
    });
    return result;
  }
}
