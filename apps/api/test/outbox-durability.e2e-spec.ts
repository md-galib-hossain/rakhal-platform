import { randomUUID } from 'crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { OutboxWriterService } from '../src/common/outbox/application/outbox-writer.service';
import { OutboxDrainService } from '../src/common/outbox/application/outbox-drain.service';
import { OutboxHandlerRegistryService } from '../src/common/outbox/application/outbox-handler-registry.service';
import { OUTBOX_QUEUE } from '../src/common/outbox/infrastructure/queue/outbox.queue.constants';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-332 — durable transactional outbox (repays RD-014). Proves the two
 * behaviors the whole primitive exists for (`FINANCE_V2_DESIGN.md` §1.2 /
 * PROJECT_PROGRESS.md AC):
 *
 *  1. A replayed/duplicated write with the same `idempotencyKey` never
 *     produces a second row, and therefore never dispatches twice.
 *  2. `OutboxWriterService.write` is bound to the caller's own
 *     `$transaction` — a rollback there rolls the outbox row back with it —
 *     while a *downstream* dispatch failure (a throwing consumer, running
 *     well after the producer already committed) never rolls back or
 *     corrupts that producer commit; it only marks the row for retry /
 *     dead-letters it after `OUTBOX_MAX_ATTEMPTS`.
 *
 * Requires the dev stack (Postgres + Redis) up and a seeded DB. Every row
 * this spec creates uses an `eventType` prefixed `rakhal332.test.` and is
 * deleted in `afterAll`.
 */
describe('Outbox durability (RAKHAL-332)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let writer: OutboxWriterService;
  let drainer: OutboxDrainService;
  let handlers: OutboxHandlerRegistryService;
  let owner: AuthedUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    writer = ctx.app.get(OutboxWriterService);
    drainer = ctx.app.get(OutboxDrainService);
    handlers = ctx.app.get(OutboxHandlerRegistryService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    // This spec calls `OutboxDrainService.drainBatch()` directly to get
    // deterministic, synchronous assertions on `attempts`/`status`. The real
    // app also runs `OutboxProcessor`'s repeatable BullMQ trigger (every
    // `OUTBOX_DRAIN_INTERVAL_MS`) — pause that queue's worker for the
    // duration of this spec so it can never race a manual `drainBatch()`
    // call and double-claim/double-count a row this spec is asserting on.
    const queue = ctx.app.get<Queue>(getQueueToken(OUTBOX_QUEUE));
    await queue.pause();
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({
      where: { eventType: { startsWith: 'rakhal332.test.' } },
    });
    const queue = ctx.app.get<Queue>(getQueueToken(OUTBOX_QUEUE));
    await queue.resume();
    await ctx.app.close();
  });

  it('a replayed write with the same idempotencyKey never inserts a second row', async () => {
    const idempotencyKey = `rakhal332:${randomUUID()}`;
    const input = {
      farmId: owner.farmId,
      eventType: 'rakhal332.test.replay',
      payload: { amount: 100 },
      idempotencyKey,
    };

    const first = await writer.write(input);
    const second = await writer.write(input); // simulated retried request

    expect(second.id).toBe(first.id);
    const rows = await prisma.outboxEvent.findMany({
      where: { farmId: owner.farmId, idempotencyKey },
    });
    expect(rows).toHaveLength(1);
  });

  it('a row written inside a $transaction that rolls back never persists', async () => {
    const idempotencyKey = `rakhal332:${randomUUID()}`;

    await expect(
      prisma.$transaction(async (tx) => {
        await writer.write(
          {
            farmId: owner.farmId,
            eventType: 'rakhal332.test.rollback',
            payload: { amount: 50 },
            idempotencyKey,
          },
          tx,
        );
        throw new Error('simulated producer failure after the outbox write');
      }),
    ).rejects.toThrow('simulated producer failure');

    const rows = await prisma.outboxEvent.findMany({
      where: { farmId: owner.farmId, idempotencyKey },
    });
    expect(rows).toHaveLength(0);
  });

  it('a throwing consumer does not roll back the producer commit and does not double-process on replay', async () => {
    const idempotencyKey = `rakhal332:${randomUUID()}`;
    const eventType = 'rakhal332.test.throwing-consumer';
    let attempts = 0;
    handlers.register(eventType, () => {
      attempts += 1;
      throw new Error('downstream consumer boom');
    });

    // Producer commits normally — this is the row a failing downstream
    // handler must never be able to touch.
    const created = await writer.write({
      farmId: owner.farmId,
      eventType,
      payload: { amount: 75 },
      idempotencyKey,
    });

    // First drain: handler throws, but the drain pass itself must not throw
    // (proves the producer-side commit above is never at risk from a later
    // consumer failure) and the row survives for retry.
    await expect(drainer.drainBatch(50, 5)).resolves.toMatchObject({
      failed: 1,
    });

    let row = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.status).toBe('PENDING');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain('downstream consumer boom');

    // Drain until the row dead-letters. Looped (rather than a fixed call
    // count) so this stays correct even if the app's own background
    // repeatable drain job (paused above, but bounded, not disabled) happens
    // to interleave — the claim mechanism makes concurrent drains safe, this
    // loop just avoids asserting an exact call count that isn't this test's
    // point.
    for (let i = 0; row.status === 'PENDING' && i < 10; i += 1) {
      await drainer.drainBatch(50, 5);
      row = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: created.id },
      });
    }

    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(5); // dead-lettered exactly at maxAttempts, never beyond
    expect(attempts).toBe(row.attempts); // one handler invocation per attempt — no double-processing

    // A duplicated/replayed write against an already-terminal row must not
    // resurrect it into another delivery attempt.
    const replay = await writer.write({
      farmId: owner.farmId,
      eventType,
      payload: { amount: 75 },
      idempotencyKey,
    });
    expect(replay.id).toBe(created.id);
    row = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.status).toBe('FAILED'); // untouched by the replayed write
  });

  it('a successful handler processes a duplicated request exactly once', async () => {
    const idempotencyKey = `rakhal332:${randomUUID()}`;
    const eventType = 'rakhal332.test.success-once';
    let calls = 0;
    handlers.register(eventType, () => {
      calls += 1;
    });

    const first = await writer.write({
      farmId: owner.farmId,
      eventType,
      payload: { n: 1 },
      idempotencyKey,
    });
    // Simulated replay before the first one has drained.
    await writer.write({
      farmId: owner.farmId,
      eventType,
      payload: { n: 1 },
      idempotencyKey,
    });

    await drainer.drainBatch();
    await drainer.drainBatch(); // second pass must find nothing PENDING left

    expect(calls).toBe(1);
    const row = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(row.status).toBe('PROCESSED');
    const rows = await prisma.outboxEvent.findMany({
      where: { farmId: owner.farmId, idempotencyKey },
    });
    expect(rows).toHaveLength(1);
  });
});
