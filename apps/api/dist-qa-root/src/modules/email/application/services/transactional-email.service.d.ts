import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { EmailService } from './email.service';
import { AppLanguage } from 'src/common/i18n/language';
export interface TransactionalEmailInput {
    idempotencyKey: string;
    to: string;
    subject: string;
    template: EmailTemplate;
    templateData: Record<string, unknown>;
    tenantId: string;
    farmId: string | null;
    userId: string | null;
    locale?: AppLanguage;
}
export declare class TransactionalEmailService {
    private readonly prisma;
    private readonly email;
    private readonly log;
    constructor(prisma: PrismaService, email: EmailService, logger: LoggerService);
    sendOnce(input: TransactionalEmailInput): Promise<{
        sent: boolean;
    }>;
}
