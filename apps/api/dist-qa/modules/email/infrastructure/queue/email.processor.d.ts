import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { QueueEmailDto } from '../../application/dto/queue-email.dto';
import type { EmailRepository } from '../../domain/repositories/email.repository';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { EmailProviderFactory } from '../providers/email-provider.factory';
import { EmailTemplateService } from '../templates/email-template.service';
export declare class EmailProcessor extends WorkerHost {
    private readonly repository;
    private readonly templateService;
    private readonly providerFactory;
    private readonly pdfGenerator;
    private readonly log;
    constructor(repository: EmailRepository, templateService: EmailTemplateService, providerFactory: EmailProviderFactory, pdfGenerator: PdfGeneratorService, logger: LoggerService);
    process(job: Job<QueueEmailDto>): Promise<void>;
    private logMeta;
}
