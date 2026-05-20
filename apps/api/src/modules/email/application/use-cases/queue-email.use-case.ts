import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';

import {
  EMAIL_JOB,
  EMAIL_QUEUE,
} from '../../infrastructure/queue/email.queue.constants';
import { QueueEmailDto } from '../dto/queue-email.dto';
import { EMAIL_REPOSITORY } from 'src/modules/email/domain/repositories/email.repository';
import type { EmailRepository } from 'src/modules/email/domain/repositories/email.repository';

@Injectable()
export class QueueEmailUseCase {
  private readonly log: LoggerService;

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue,
    @Inject(EMAIL_REPOSITORY)
    private readonly repository: EmailRepository,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(QueueEmailUseCase.name);
  }

  async execute(input: QueueEmailDto): Promise<void> {
    await this.repository.create({
      id: input.emailId,
      to: input.to,
      subject: input.subject,
      template: input.template,
      tenantId: input.tenantId,
      farmId: input.farmId,
      userId: input.userId,
      correlationId: input.correlationId,
      scheduledAt: input.sendAt,
    });

    await this.queue.add(EMAIL_JOB, input, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      delay: input.sendAt
        ? Math.max(input.sendAt.getTime() - Date.now(), 0)
        : undefined,
      jobId: input.emailId,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    this.log.info('Email queued for sending', {
      emailId: input.emailId,
      userId: input.userId,
      tenantId: input.tenantId,
      farmId: input.farmId,
      correlationId: input.correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
