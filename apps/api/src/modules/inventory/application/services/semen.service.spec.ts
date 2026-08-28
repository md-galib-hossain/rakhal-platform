import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SemenService } from './semen.service';

/**
 * RAKHAL-302 — straw stock ledger (`decrementStraw` writing `AI_USE`
 * movements, new `restoreStraw` writing `REVERSAL` movements). `$transaction`
 * is mocked as the array-batch form used by this service — resolves each
 * already-invoked mock call.
 */
describe('SemenService', () => {
  let prisma: {
    semenBatch: { findFirst: jest.Mock; update: jest.Mock };
    semenStrawMovement: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  const batchRow = {
    id: 'batch-1',
    farmId: 'farm-1',
    strawQuantity: 10,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      semenBatch: {
        findFirst: jest.fn().mockResolvedValue(batchRow),
        update: jest.fn(),
      },
      semenStrawMovement: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () => new SemenService(prisma as never, logger as never);

  describe('decrementStraw', () => {
    it('404s when the batch is not found', async () => {
      prisma.semenBatch.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.decrementStraw('farm-1', 'batch-x', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects going below zero', async () => {
      prisma.semenBatch.findFirst.mockResolvedValueOnce({
        ...batchRow,
        strawQuantity: 0,
      });
      const service = make();

      await expect(
        service.decrementStraw('farm-1', 'batch-1', 1),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.semenBatch.update).not.toHaveBeenCalled();
    });

    it('writes a -by AI_USE movement and updates strawQuantity atomically', async () => {
      prisma.semenBatch.update.mockResolvedValueOnce({
        ...batchRow,
        strawQuantity: 9,
      });
      const service = make();

      await service.decrementStraw('farm-1', 'batch-1', 1, 'user-1', 'evt-1');

      expect(prisma.semenBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { strawQuantity: 9 },
      });
      expect(prisma.semenStrawMovement.create).toHaveBeenCalledWith({
        data: {
          batchId: 'batch-1',
          farmId: 'farm-1',
          reason: 'AI_USE',
          delta: -1,
          balanceAfter: 9,
          sourceEventId: 'evt-1',
          createdBy: 'user-1',
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoreStraw', () => {
    it('404s when the batch is not found', async () => {
      prisma.semenBatch.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.restoreStraw('farm-1', 'batch-x', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes a +by REVERSAL movement, no warning for an active batch', async () => {
      prisma.semenBatch.update.mockResolvedValueOnce({
        ...batchRow,
        strawQuantity: 11,
      });
      const service = make();

      const result = await service.restoreStraw(
        'farm-1',
        'batch-1',
        1,
        'breeding event edited',
        'evt-1',
        'user-1',
      );

      expect(prisma.semenBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { strawQuantity: 11 },
      });
      expect(prisma.semenStrawMovement.create).toHaveBeenCalledWith({
        data: {
          batchId: 'batch-1',
          farmId: 'farm-1',
          reason: 'REVERSAL',
          delta: 1,
          balanceAfter: 11,
          notes: 'breeding event edited',
          sourceEventId: 'evt-1',
          createdBy: 'user-1',
        },
      });
      expect(result.warning).toBeNull();
    });

    it('returns a warning instead of throwing when the batch is archived', async () => {
      prisma.semenBatch.findFirst.mockResolvedValueOnce({
        ...batchRow,
        deletedAt: new Date(),
      });
      prisma.semenBatch.update.mockResolvedValueOnce({
        ...batchRow,
        deletedAt: new Date(),
        strawQuantity: 11,
      });
      const service = make();

      const result = await service.restoreStraw('farm-1', 'batch-1', 1);

      expect(result.warning).toMatch(/archived/i);
      expect(result.batch.strawQuantity).toBe(11);
    });
  });
});
