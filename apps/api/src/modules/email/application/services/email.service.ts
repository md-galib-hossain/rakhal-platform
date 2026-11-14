import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueueEmailDto } from '../dto/queue-email.dto';
import { QueueEmailUseCase } from '../use-cases/queue-email.use-case';

@Injectable()
export class EmailService {
  constructor(private readonly queueEmailUseCase: QueueEmailUseCase) {}

  async queue(input: Omit<QueueEmailDto, 'emailId'>): Promise<string> {
    const emailId = randomUUID();
    await this.queueEmailUseCase.execute({
      ...input,
      emailId,
    });

    return emailId;
  }
}
