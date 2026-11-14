import {
  ExpenseCategory,
  MilkDisposition,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  computeCattleFinance,
  resolveEffectiveMilkRate,
  sumSaleableMilkLitres,
} from './cattle-finance-aggregation';

describe('cattle-finance-aggregation', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      saleLine: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      milkDispatch: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      milkBuyer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      milkLogEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      animalSaleLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      expense: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      feedDistributionCattleItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  });

  describe('resolveEffectiveMilkRate', () => {
    it('prefers the latest confirmed SaleLine of type MILK', async () => {
      mockPrisma.saleLine.findFirst.mockResolvedValueOnce({
        unitPrice: 85,
      });

      const rate = await resolveEffectiveMilkRate(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        new Date('2026-10-27T00:00:00Z'),
      );

      expect(rate).toBe(85);
      expect(mockPrisma.saleLine.findFirst).toHaveBeenCalledWith({
        where: {
          type: SaleLineType.MILK,
          sale: {
            farmId: 'farm-1',
            status: SaleStatus.CONFIRMED,
            saleDate: { lte: expect.any(Date) },
          },
        },
        orderBy: { sale: { saleDate: 'desc' } },
        select: { unitPrice: true },
      });
    });

    it('falls back to latest MilkDispatch when no SaleLine exists', async () => {
      mockPrisma.saleLine.findFirst.mockResolvedValueOnce(null);
      mockPrisma.milkDispatch.findFirst.mockResolvedValueOnce({
        basePricePerLitre: 80,
      });

      const rate = await resolveEffectiveMilkRate(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        new Date('2026-10-27T00:00:00Z'),
      );

      expect(rate).toBe(80);
    });

    it('falls back to average MilkBuyer basePrice when no dispatch or sale exists', async () => {
      mockPrisma.saleLine.findFirst.mockResolvedValueOnce(null);
      mockPrisma.milkDispatch.findFirst.mockResolvedValueOnce(null);
      mockPrisma.milkBuyer.findMany.mockResolvedValueOnce([
        { basePricePerLitre: 70 },
        { basePricePerLitre: 80 },
      ]);

      const rate = await resolveEffectiveMilkRate(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        new Date('2026-10-27T00:00:00Z'),
      );

      expect(rate).toBe(75);
    });

    it('returns 0 when no rates exist', async () => {
      mockPrisma.saleLine.findFirst.mockResolvedValueOnce(null);
      mockPrisma.milkDispatch.findFirst.mockResolvedValueOnce(null);
      mockPrisma.milkBuyer.findMany.mockResolvedValueOnce([]);

      const rate = await resolveEffectiveMilkRate(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        new Date('2026-10-27T00:00:00Z'),
      );

      expect(rate).toBe(0);
    });
  });

  describe('sumSaleableMilkLitres', () => {
    it('sums only SALEABLE entries in the date range', async () => {
      mockPrisma.milkLogEntry.findMany.mockResolvedValueOnce([
        { yieldL: 12.5 },
        { yieldL: 10.0 },
      ]);

      const start = new Date('2026-10-01T00:00:00Z');
      const end = new Date('2026-11-01T00:00:00Z');

      const litres = await sumSaleableMilkLitres(
        mockPrisma as unknown as PrismaService,
        'cow-1',
        start,
        end,
      );

      expect(litres).toBe(22.5);
      expect(mockPrisma.milkLogEntry.findMany).toHaveBeenCalledWith({
        where: {
          cattleId: 'cow-1',
          disposition: MilkDisposition.SALEABLE,
          logDate: { gte: start, lt: end },
        },
        select: { yieldL: true },
      });
    });
  });

  describe('computeCattleFinance', () => {
    it('calculates milk sales revenue, calf sales, and costs', async () => {
      const start = new Date('2026-10-01T00:00:00Z');
      const end = new Date('2026-11-01T00:00:00Z');

      // Animal sales: 50000
      mockPrisma.animalSaleLine.findMany.mockResolvedValueOnce([
        { saleLine: { totalAmount: 50000 } },
      ]);

      // Feed cost: 3500
      mockPrisma.feedDistributionCattleItem.findMany.mockResolvedValueOnce([
        { costTk: 2000 },
        { costTk: 1500 },
      ]);

      // Effective milk rate: 80/L
      mockPrisma.saleLine.findFirst.mockResolvedValueOnce({
        unitPrice: 80,
      });

      // Saleable milk: 150 L
      mockPrisma.milkLogEntry.findMany.mockResolvedValueOnce([
        { yieldL: 100 },
        { yieldL: 50 },
      ]);

      const result = await computeCattleFinance(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        'cow-1',
        start,
        end,
      );

      // Expected milk revenue = 150 * 80 = 12000
      expect(result.income.milk_sales).toBe(12000);
      expect(result.income.calf_sales).toBe(50000);
      expect(result.totalIncome).toBe(62000);
      expect(result.expense.feed).toBe(3500);
      expect(result.totalCost).toBe(3500);
    });

    it('returns honest 0 for milk sales when no saleable milk was logged', async () => {
      const start = new Date('2026-10-01T00:00:00Z');
      const end = new Date('2026-11-01T00:00:00Z');

      mockPrisma.saleLine.findFirst.mockResolvedValueOnce({
        unitPrice: 80,
      });
      mockPrisma.milkLogEntry.findMany.mockResolvedValueOnce([]);

      const result = await computeCattleFinance(
        mockPrisma as unknown as PrismaService,
        'farm-1',
        'cow-1',
        start,
        end,
      );

      expect(result.income.milk_sales).toBe(0);
      expect(result.income.calf_sales).toBe(0);
      expect(result.totalIncome).toBe(0);
    });
  });
});
