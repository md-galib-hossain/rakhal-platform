import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReceivableService } from './receivable.service';
import { ReceivableStatus } from '../domain/receivable-status';

/**
 * RAKHAL-340 — `ReceivableService` unit coverage. The e2e spec
 * (`test/finance-v2-receivables.e2e-spec.ts`) proves the real DB + HTTP
 * surface end to end; this spec proves the derivation rule
 * (`FINANCE_V2_DESIGN.md` §4.6) in isolation with a mocked Prisma client,
 * covering all four states — `UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE` —
 * plus Decimal-precision edge cases (exact-equal allocation, fractional
 * cents) and the `assertWithinOutstanding` cross-payment guard.
 */
describe('ReceivableService', () => {
  let prisma: {
    receivable: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    paymentAllocation: { aggregate: jest.Mock; groupBy: jest.Mock };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const receivable = (overrides: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    farmId: 'farm-1',
    saleId: 'sale-1',
    customerId: null,
    totalAmount: new Prisma.Decimal(10000),
    dueDate: null,
    closedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      receivable: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      paymentAllocation: { aggregate: jest.fn(), groupBy: jest.fn() },
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () => new ReceivableService(prisma as never, logger as never);

  const mockFigures = (
    receivableRow: ReturnType<typeof receivable>,
    allocated: Prisma.Decimal.Value,
  ) => {
    prisma.receivable.findFirst.mockResolvedValue(receivableRow);
    prisma.paymentAllocation.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(allocated) },
    });
  };

  describe('createReceivable', () => {
    it('creates the row with a Decimal-storage-safe totalAmount', async () => {
      prisma.receivable.create.mockResolvedValue(receivable());
      const service = make();

      await service.createReceivable('farm-1', 'sale-1', 10000);

      const createArgs = (
        prisma.receivable.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          farmId: string;
          saleId: string;
          totalAmount: Prisma.Decimal;
          dueDate: Date | null;
        };
      };
      expect(createArgs.data.farmId).toBe('farm-1');
      expect(createArgs.data.saleId).toBe('sale-1');
      expect(createArgs.data.totalAmount).toBeInstanceOf(Prisma.Decimal);
      expect(createArgs.data.dueDate).toBeNull();
    });

    it('rejects a zero/negative totalAmount', async () => {
      const service = make();
      await expect(
        service.createReceivable('farm-1', 'sale-1', 0),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.receivable.create).not.toHaveBeenCalled();
    });
  });

  describe('getOutstanding / getStatus — the four derived states', () => {
    it('UNPAID: allocated == 0', async () => {
      mockFigures(receivable(), 0);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'rec-1')).toString()).toBe(
        '10000',
      );
      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.UNPAID,
      );
    });

    it('PARTIALLY_PAID: 0 < allocated < total', async () => {
      mockFigures(receivable(), 6000);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'rec-1')).toString()).toBe(
        '4000',
      );
      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.PARTIALLY_PAID,
      );
    });

    it('PAID: allocated == total exactly', async () => {
      mockFigures(receivable(), 10000);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'rec-1')).toString()).toBe(
        '0',
      );
      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.PAID,
      );
    });

    it('PAID: allocated > total (defensive — should never happen, guard prevents it)', async () => {
      mockFigures(receivable(), 10000.5);
      const service = make();

      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.PAID,
      );
    });

    it('OVERDUE: past dueDate and not fully paid takes priority over PARTIALLY_PAID', async () => {
      const past = new Date(Date.now() - 86_400_000);
      mockFigures(receivable({ dueDate: past }), 3000);
      const service = make();

      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.OVERDUE,
      );
    });

    it('OVERDUE: past dueDate and completely unpaid also reports OVERDUE, not UNPAID', async () => {
      const past = new Date(Date.now() - 86_400_000);
      mockFigures(receivable({ dueDate: past }), 0);
      const service = make();

      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.OVERDUE,
      );
    });

    it('past dueDate but fully PAID never reports OVERDUE', async () => {
      const past = new Date(Date.now() - 86_400_000);
      mockFigures(receivable({ dueDate: past }), 10000);
      const service = make();

      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.PAID,
      );
    });

    it('future dueDate never reports OVERDUE even when unpaid', async () => {
      const future = new Date(Date.now() + 86_400_000);
      mockFigures(receivable({ dueDate: future }), 0);
      const service = make();

      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.UNPAID,
      );
    });

    it('Decimal precision: fractional-cent allocation never mis-rounds to PAID', async () => {
      mockFigures(
        receivable({ totalAmount: new Prisma.Decimal('100.00') }),
        '99.99',
      );
      const service = make();

      expect((await service.getOutstanding('farm-1', 'rec-1')).toString()).toBe(
        '0.01',
      );
      expect(await service.getStatus('farm-1', 'rec-1')).toBe(
        ReceivableStatus.PARTIALLY_PAID,
      );
    });

    it('throws NotFoundException for a cross-farm/unknown receivable id', async () => {
      prisma.receivable.findFirst.mockResolvedValue(null);
      const service = make();

      await expect(service.getOutstanding('farm-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertWithinOutstanding', () => {
    it('passes when the amount is within outstanding', async () => {
      mockFigures(receivable(), 6000);
      const service = make();

      await expect(
        service.assertWithinOutstanding('farm-1', 'rec-1', 4000),
      ).resolves.toBeUndefined();
    });

    it('passes when the amount exactly equals outstanding', async () => {
      mockFigures(receivable(), 6000);
      const service = make();

      await expect(
        service.assertWithinOutstanding('farm-1', 'rec-1', 4000),
      ).resolves.toBeUndefined();
    });

    it('rejects when the amount exceeds outstanding', async () => {
      mockFigures(receivable(), 6000);
      const service = make();

      await expect(
        service.assertWithinOutstanding('farm-1', 'rec-1', 4000.01),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeIfSettled', () => {
    it('sets closedAt once outstanding reaches zero', async () => {
      mockFigures(receivable(), 10000);
      const service = make();

      await service.closeIfSettled('farm-1', 'rec-1');

      const updateArgs = (
        prisma.receivable.update.mock.calls as unknown[][]
      )[0][0] as { where: { id: string }; data: { closedAt: Date } };
      expect(updateArgs.where).toEqual({ id: 'rec-1' });
      expect(updateArgs.data.closedAt).toBeInstanceOf(Date);
    });

    it('is a no-op while still outstanding', async () => {
      mockFigures(receivable(), 6000);
      const service = make();

      await service.closeIfSettled('farm-1', 'rec-1');

      expect(prisma.receivable.update).not.toHaveBeenCalled();
    });

    it('is a no-op if already closed', async () => {
      mockFigures(receivable({ closedAt: new Date() }), 10000);
      const service = make();

      await service.closeIfSettled('farm-1', 'rec-1');

      expect(prisma.receivable.update).not.toHaveBeenCalled();
    });
  });
});
