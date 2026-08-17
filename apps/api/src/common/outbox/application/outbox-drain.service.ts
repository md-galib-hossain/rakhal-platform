import { Injectable } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OutboxDrainResult } from '../domain/outbox-types';
import { OutboxHandlerRegistryService } from './outbox-handler-registry.service';

export const OUTBOX_DEFAULT_BATCH_SIZE = 25;
export const OUTBOX_MAX_ATTEMPTS = 5;

/**
 * Core drain logic for the outbox — deliberately separate from `OutboxProcessor`
 * (the BullMQ worker) so it is unit-testable without a real queue/Redis,
 * mirroring `ReportsQueueService`/`ReportsProcessor`'s split.
 *
 * At-least-once delivery: a row is claimed with a conditional
 * `updateMany({ where: { id, status: PENDING } })` — if another concurrent
 * drain (or a second worker process) already claimed it, `count` is 0 and this
 * pass skips it, so the same row is never dispatched twice concurrently. A
 * handler that throws leaves the row `PENDING` again (picked up on the next
 * drain tick) until `attempts` reaches `OUTBOX_MAX_ATTEMPTS`, at which point it
 * is dead-lettered to `FAILED` and stops being retried automatically.
 */
@Injectable()
export class OutboxDrainService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly handlers: OutboxHandlerRegistryService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OutboxDrainService.name);
  }

  async drainBatch(
    batchSize = OUTBOX_DEFAULT_BATCH_SIZE,
    maxAttempts = OUTBOX_MAX_ATTEMPTS,
  ): Promise<OutboxDrainResult> {
    const candidates = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const result: OutboxDrainResult = {
      claimed: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const candidate of candidates) {
      const claim = await this.prisma.outboxEvent.updateMany({
        where: { id: candidate.id, status: OutboxEventStatus.PENDING },
        data: {
          status: OutboxEventStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });
      if (claim.count === 0) continue; // lost the race to another worker/pass
      result.claimed += 1;

      const attemptsMade = candidate.attempts + 1;
      try {
        await this.handlers.dispatch(
          candidate.eventType,
          candidate.payload as Record<string, unknown>,
        );
        await this.prisma.outboxEvent.update({
          where: { id: candidate.id },
          data: {
            status: OutboxEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        });
        result.processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const deadLetter = attemptsMade >= maxAttempts;
        await this.prisma.outboxEvent.update({
          where: { id: candidate.id },
          data: {
            status: deadLetter
              ? OutboxEventStatus.FAILED
              : OutboxEventStatus.PENDING,
            lastError: message.slice(0, 2000),
          },
        });
        if (deadLetter) {
          this.log.error(
            'Outbox event dead-lettered after max attempts',
            error,
            {
              outboxEventId: candidate.id,
              eventType: candidate.eventType,
              attempts: attemptsMade,
            },
          );
          result.deadLettered += 1;
        } else {
          this.log.warn('Outbox event dispatch failed, will retry', {
            outboxEventId: candidate.id,
            eventType: candidate.eventType,
            attempts: attemptsMade,
            error: message,
          });
          result.failed += 1;
        }
      }
    }

    return result;
  }
}
