import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { EmailService } from 'src/modules/email/application/services/email.service';
export interface RenderedReceipt {
    fileName: string;
    buffer: Buffer;
    invoiceNumber: string;
}
export declare class ReceiptService {
    private readonly prisma;
    private readonly email;
    private readonly log;
    constructor(prisma: PrismaService, email: EmailService, logger: LoggerService);
    renderForDownload(farmId: string, invoiceId: string): Promise<RenderedReceipt>;
    emailReceipt(invoiceId: string): Promise<void>;
    private render;
}
