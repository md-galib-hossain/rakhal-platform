import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EmailTemplate } from '../enums/email-template.enum';
import { EmailStatus } from '../enums/email-status.enum';

@Injectable()
export class EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  }) {
    return (this.prisma as PrismaService & { emailLog: any }).emailLog.create({
      data: {
        id: data.id,
        to: data.to,
        subject: data.subject,
        tenantId: data.tenantId,
        farmId: data.farmId,
        userId: data.userId,
        correlationId: data.correlationId,
        template: data.template,
        status: EmailStatus.QUEUED,
        scheduledAt: data.scheduledAt,
      },
    });
  }

  markProcessing(emailId: string) {
    return (this.prisma as PrismaService & { emailLog: any }).emailLog.update({
      where: { id: emailId },
      data: { status: EmailStatus.PROCESSING },
    });
  }

  markSent(emailId: string, provider: string) {
    return (this.prisma as PrismaService & { emailLog: any }).emailLog.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        provider,
        sentAt: new Date(),
      },
    });
  }

  markFailed(emailId: string, errorMessage: string, retries: number) {
    return (this.prisma as PrismaService & { emailLog: any }).emailLog.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.FAILED,
        errorMessage,
        retries,
      },
    });
  }
}
