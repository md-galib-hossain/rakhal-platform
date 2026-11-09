import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
export declare class RenewalReminderService {
    private readonly prisma;
    private readonly notifications;
    private readonly txEmail;
    private readonly log;
    constructor(prisma: PrismaService, notifications: NotificationService, txEmail: TransactionalEmailService, logger: LoggerService);
    runRenewalSweep(now?: Date): Promise<{
        preExpiry: number;
        winback: number;
    }>;
    private fire;
    private copyFor;
}
