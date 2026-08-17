import { OutboxEventStatus } from '@prisma/client';
import { OutboxDrainService } from './outbox-drain.service';

describe('OutboxDrainService', () => {
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'row-1',
    farmId: 'farm-1',
    eventType: 'sale.recorded',
    payload: { amount: 100 },
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    lastError: null,
    idempotencyKey: 'op-1',
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('marks a successfully dispatched row PROCESSED', async () => {
    const found = [row()];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(found),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const handlers = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const service = new OutboxDrainService(
      prisma as never,
      handlers as never,
      logger as never,
    );

    const result = await service.drainBatch();

    expect(handlers.dispatch).toHaveBeenCalledWith('sale.recorded', {
      amount: 100,
    });
    const updateCall = (
      prisma.outboxEvent.update.mock.calls[0] as unknown[]
    )[0] as {
      where: { id: string };
      data: { status: OutboxEventStatus };
    };
    expect(updateCall.where).toEqual({ id: 'row-1' });
    expect(updateCall.data.status).toBe(OutboxEventStatus.PROCESSED);
    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      failed: 0,
      deadLettered: 0,
    });
  });

  it('claims a row with a conditional updateMany so a concurrently-claimed row is skipped, never double-dispatched', async () => {
    const found = [row()];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(found),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // another worker already claimed it
        update: jest.fn(),
      },
    };
    const handlers = { dispatch: jest.fn() };
    const service = new OutboxDrainService(
      prisma as never,
      handlers as never,
      logger as never,
    );

    const result = await service.drainBatch();

    expect(handlers.dispatch).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      claimed: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
    });
  });

  it('a throwing consumer leaves the row PENDING for retry without the drain pass itself throwing', async () => {
    const found = [row({ attempts: 0 })];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(found),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const handlers = {
      dispatch: jest.fn().mockRejectedValue(new Error('consumer boom')),
    };
    const service = new OutboxDrainService(
      prisma as never,
      handlers as never,
      logger as never,
    );

    await expect(service.drainBatch(25, 5)).resolves.toEqual({
      claimed: 1,
      processed: 0,
      failed: 1,
      deadLettered: 0,
    });
    const updateCall = (
      prisma.outboxEvent.update.mock.calls[0] as unknown[]
    )[0] as {
      where: { id: string };
      data: { status: OutboxEventStatus; lastError: string };
    };
    expect(updateCall.where).toEqual({ id: 'row-1' });
    expect(updateCall.data.status).toBe(OutboxEventStatus.PENDING);
    expect(updateCall.data.lastError).toBe('consumer boom');
  });

  it('dead-letters to FAILED once attempts reach maxAttempts', async () => {
    // 4 prior attempts + this claim (which increments to 5) hits maxAttempts=5.
    const found = [row({ attempts: 4 })];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(found),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const handlers = {
      dispatch: jest.fn().mockRejectedValue(new Error('still failing')),
    };
    const service = new OutboxDrainService(
      prisma as never,
      handlers as never,
      logger as never,
    );

    const result = await service.drainBatch(25, 5);

    expect(result).toEqual({
      claimed: 1,
      processed: 0,
      failed: 0,
      deadLettered: 1,
    });
    const updateCall = (
      prisma.outboxEvent.update.mock.calls[0] as unknown[]
    )[0] as {
      where: { id: string };
      data: { status: OutboxEventStatus; lastError: string };
    };
    expect(updateCall.where).toEqual({ id: 'row-1' });
    expect(updateCall.data.status).toBe(OutboxEventStatus.FAILED);
    expect(updateCall.data.lastError).toBe('still failing');
  });

  it('only queries PENDING rows, so an already-PROCESSED row from a replayed write is never re-dispatched', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const handlers = { dispatch: jest.fn() };
    const service = new OutboxDrainService(
      prisma as never,
      handlers as never,
      logger as never,
    );

    await service.drainBatch();

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OutboxEventStatus.PENDING },
      }),
    );
    expect(handlers.dispatch).not.toHaveBeenCalled();
  });
});
