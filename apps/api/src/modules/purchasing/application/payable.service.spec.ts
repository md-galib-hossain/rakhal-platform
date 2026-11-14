import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PayableService } from './payable.service';
import { PayableStatus } from '../domain/payable-status';

/**
 * RAKHAL-348 — `PayableService` unit coverage. Mirrors
 * `ReceivableService.spec.ts` (RAKHAL-340) exactly, on the liability side of
 * the books. The e2e specs (`test/purchasing-purchase.e2e-spec.ts`,
 * `test/purchasing-expense.e2e-spec.ts`) prove the real DB + HTTP surface
 * end to end; this spec proves the derivation rule
 * (`FINANCE_V2_DESIGN.md` §4.6) in isolation with a mocked Prisma client,
 * covering all four states — `UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`.
 */
describe('PayableService', () => {
  let prisma: {
    payable: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    paymentAllocation: { aggregate: jest.Mock; groupBy: jest.Mock };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const payable = (overrides: Record<string, unknown> = {}) => ({
    id: 'pay-1',
    farmId: 'farm-1',
    purchaseId: 'purchase-1',
    expenseId: null,
    supplierId: null,
    totalAmount: new Prisma.Decimal(30000),
    dueDate: null,
    closedAt: null,
    createdAt: new Date('2026-08-22T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      payable: {
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

  const make = () => new PayableService(prisma as never, logger as never);

  const mockFigures = (
    payableRow: ReturnType<typeof payable>,
    allocated: Prisma.Decimal.Value,
  ) => {
    prisma.payable.findFirst.mockResolvedValue(payableRow);
    prisma.paymentAllocation.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(allocated) },
    });
  };

  describe('createPayable', () => {
    it('creates the row with a Decimal-storage-safe totalAmount for a purchaseId', async () => {
      prisma.payable.create.mockResolvedValue(payable());
      const service = make();

      await service.createPayable('farm-1', {
        purchaseId: 'purchase-1',
        totalAmount: 30000,
      });

      const createArgs = (
        prisma.payable.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          farmId: string;
          purchaseId: string | null;
          expenseId: string | null;
          totalAmount: Prisma.Decimal;
        };
      };
      expect(createArgs.data.farmId).toBe('farm-1');
      expect(createArgs.data.purchaseId).toBe('purchase-1');
      expect(createArgs.data.expenseId).toBeNull();
      expect(createArgs.data.totalAmount).toBeInstanceOf(Prisma.Decimal);
    });

    it('creates the row for an expenseId', async () => {
      prisma.payable.create.mockResolvedValue(
        payable({ purchaseId: null, expenseId: 'expense-1' }),
      );
      const service = make();

      await service.createPayable('farm-1', {
        expenseId: 'expense-1',
        totalAmount: 4500,
      });

      const createArgs = (
        prisma.payable.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { purchaseId: string | null; expenseId: string | null };
      };
      expect(createArgs.data.purchaseId).toBeNull();
      expect(createArgs.data.expenseId).toBe('expense-1');
    });

    it('rejects when neither purchaseId nor expenseId is set', async () => {
      const service = make();
      await expect(
        service.createPayable('farm-1', { totalAmount: 100 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payable.create).not.toHaveBeenCalled();
    });

    it('rejects when both purchaseId and expenseId are set', async () => {
      const service = make();
      await expect(
        service.createPayable('farm-1', {
          purchaseId: 'purchase-1',
          expenseId: 'expense-1',
          totalAmount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payable.create).not.toHaveBeenCalled();
    });

    it('rejects a zero/negative totalAmount', async () => {
      const service = make();
      await expect(
        service.createPayable('farm-1', {
          purchaseId: 'purchase-1',
          totalAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payable.create).not.toHaveBeenCalled();
    });
  });

  describe('getOutstanding / getStatus — the four derived states', () => {
    it('UNPAID: allocated == 0', async () => {
      mockFigures(payable(), 0);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'pay-1')).toString()).toBe(
        '30000',
      );
      expect(await service.getStatus('farm-1', 'pay-1')).toBe(
        PayableStatus.UNPAID,
      );
    });

    it("PARTIALLY_PAID: 0 < allocated < total (the ticket's own worked example)", async () => {
      mockFigures(payable(), 20000);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'pay-1')).toString()).toBe(
        '10000',
      );
      expect(await service.getStatus('farm-1', 'pay-1')).toBe(
        PayableStatus.PARTIALLY_PAID,
      );
    });

    it('PAID: allocated == total exactly', async () => {
      mockFigures(payable(), 30000);
      const service = make();

      expect((await service.getOutstanding('farm-1', 'pay-1')).toString()).toBe(
        '0',
      );
      expect(await service.getStatus('farm-1', 'pay-1')).toBe(
        PayableStatus.PAID,
      );
    });

    it('OVERDUE: past dueDate and not fully paid takes priority over PARTIALLY_PAID', async () => {
      const past = new Date(Date.now() - 86_400_000);
      mockFigures(payable({ dueDate: past }), 20000);
      const service = make();

      expect(await service.getStatus('farm-1', 'pay-1')).toBe(
        PayableStatus.OVERDUE,
      );
    });

    it('past dueDate but fully PAID never reports OVERDUE', async () => {
      const past = new Date(Date.now() - 86_400_000);
      mockFigures(payable({ dueDate: past }), 30000);
      const service = make();

      expect(await service.getStatus('farm-1', 'pay-1')).toBe(
        PayableStatus.PAID,
      );
    });

    it('throws NotFoundException for a cross-farm/unknown payable id', async () => {
      prisma.payable.findFirst.mockResolvedValue(null);
      const service = make();

      await expect(service.getOutstanding('farm-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertWithinOutstanding', () => {
    it('passes when the amount is within outstanding', async () => {
      mockFigures(payable(), 20000);
      const service = make();

      await expect(
        service.assertWithinOutstanding('farm-1', 'pay-1', 10000),
      ).resolves.toBeUndefined();
    });

    it('rejects when the amount exceeds outstanding', async () => {
      mockFigures(payable(), 20000);
      const service = make();

      await expect(
        service.assertWithinOutstanding('farm-1', 'pay-1', 10000.01),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeIfSettled', () => {
    it('sets closedAt once outstanding reaches zero', async () => {
      mockFigures(payable(), 30000);
      const service = make();

      await service.closeIfSettled('farm-1', 'pay-1');

      const updateArgs = (
        prisma.payable.update.mock.calls as unknown[][]
      )[0][0] as { where: { id: string }; data: { closedAt: Date } };
      expect(updateArgs.where).toEqual({ id: 'pay-1' });
      expect(updateArgs.data.closedAt).toBeInstanceOf(Date);
    });

    it('is a no-op while still outstanding', async () => {
      mockFigures(payable(), 20000);
      const service = make();

      await service.closeIfSettled('farm-1', 'pay-1');

      expect(prisma.payable.update).not.toHaveBeenCalled();
    });

    it('is a no-op if already closed', async () => {
      mockFigures(payable({ closedAt: new Date() }), 30000);
      const service = make();

      await service.closeIfSettled('farm-1', 'pay-1');

      expect(prisma.payable.update).not.toHaveBeenCalled();
    });
  });
});
