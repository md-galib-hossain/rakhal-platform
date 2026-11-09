import type { EmailLog } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EmailRepository } from 'src/modules/email/domain/repositories/email.repository';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
export declare class PrismaEmailRepository implements EmailRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
    markFailed(emailId: string, errorMessage: string, retries: number): Promise<EmailLog>;
}
