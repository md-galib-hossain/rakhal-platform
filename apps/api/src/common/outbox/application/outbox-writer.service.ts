import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { OutboxEvent, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { WriteOutboxEventInput } from '../domain/outbox-types';
import {
  OUTBOX_NUDGE_DELAY_MS,
  OUTBOX_NUDGE_JOB,
  OUTBOX_QUEUE,
} from '../infrastructure/queue/outbox.queue.constants';

/** Prisma client or an interactive-transaction client, mirrors `CreditWalletService`'s `Db` seam. */
type Db = PrismaService | Prisma.TransactionClient;

/**
 * Writes `OutboxEvent` rows. The whole point of the outbox pattern is that
 * this is called with the caller's own `Prisma.TransactionClient` — never
 * fire-and-forget after a commit — so the event and the business row it
 * describes either both land or both roll back together. See
 * `FINANCE_V2_DESIGN.md` §1.2 for the exact bug class this prevents (a milk
 * dispatch committed, its finance post silently swallowed in a post-commit
 * try/catch).
 */
@Injectable()
export class OutboxWriterService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue(OUTBOX_QUEUE) private readonly queue?: Queue,
  ) {}

  /**
   * Idempotent by `(farmId, idempotencyKey)`: a replayed/duplicated write
   * with the same key returns the original row untouched (`update: {}`)
   * instead of inserting a second row — so a retried command can never cause
   * the event to be dispatched twice.
   */
  async write(
    input: WriteOutboxEventInput,
    db: Db = this.prisma,
  ): Promise<OutboxEvent> {
    const row = await db.outboxEvent.upsert({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        farmId: input.farmId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
      },
      update: {},
    });
    this.nudgeDrain();
    return row;
  }

  /**
   * Queue a delayed drain so the new row is dispatched within seconds instead
   * of waiting for the slow safety-net poll. Best effort: the caller's
   * transaction must never fail on a Redis hiccup, and the poll is the backstop.
   */
  private nudgeDrain(): void {
    this.queue
      ?.add(
        OUTBOX_NUDGE_JOB,
        {},
        {
          jobId: OUTBOX_NUDGE_JOB, // one pending nudge covers every row written in the window
          delay: OUTBOX_NUDGE_DELAY_MS,
          removeOnComplete: true,
          removeOnFail: true,
        },
      )
      .catch(() => undefined);
  }
}
