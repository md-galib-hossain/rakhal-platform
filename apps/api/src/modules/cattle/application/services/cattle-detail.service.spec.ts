import { CattleDetailService } from './cattle-detail.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SaleStatus } from '@prisma/client';

describe('CattleDetailService - cattleFinance', () => {
  let service: CattleDetailService;
  let mockPrisma: any;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      cattle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cow-1',
          farmId: 'farm-1',
          tagNumber: 'TAG-101',
        }),
      },
      saleLine: {
        findFirst: jest.fn().mockResolvedValue({
          unitPrice: 80,
        }),
      },
      milkDispatch: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      milkBuyer: {
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
      milkLogEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockLogger = {
      setContext: jest.fn().mockReturnThis(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new CattleDetailService(
      mockPrisma as unknown as PrismaService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('populates milk_sales in income_breakdown and monthly_chart when milk is produced and sold', async () => {
    // Current period: 2026-10
    const testPeriod = '2026-10';

    // 100L of saleable milk in 2026-10
    mockPrisma.milkLogEntry.findMany
      // 1st call: sumSaleableMilkLitres in computeCattleFinance
      .mockResolvedValueOnce([{ yieldL: 100 }])
      // 2nd call: milkEntries for the 6-month chart in cattleFinance
      .mockResolvedValueOnce([
        { yieldL: 100, logDate: new Date('2026-10-15T06:00:00Z') },
        { yieldL: 80, logDate: new Date('2026-09-15T06:00:00Z') },
      ]);

    // Feed cost in October: 2500
    mockPrisma.feedDistributionCattleItem.findMany
      // 1st call: in computeCattleFinance
      .mockResolvedValueOnce([{ costTk: 2500 }])
      // 2nd call: for chart in cattleFinance
      .mockResolvedValueOnce([
        {
          costTk: 2500,
          distribution: { distributedAt: new Date('2026-10-10T08:00:00Z') },
        },
      ]);

    const res = await service.cattleFinance('farm-1', 'cow-1', testPeriod);

    // 100L * 80 Tk = 8000 Tk milk income
    expect(res.income_breakdown.milk_sales).toBe(8000);
    expect(res.total_income).toBe(8000);
    expect(res.total_cost).toBe(2500);
    expect(res.net_profit).toBe(5500);

    // Check monthly chart
    expect(res.monthly_chart).toHaveLength(6);
    const octData = res.monthly_chart.find((m) => m.month === '2026-10');
    expect(octData).toBeDefined();
    expect(octData!.income).toBe(8000); // 100L * 80
    expect(octData!.cost).toBe(2500); // 2500 feed

    const sepData = res.monthly_chart.find((m) => m.month === '2026-09');
    expect(sepData).toBeDefined();
    expect(sepData!.income).toBe(6400); // 80L * 80
  });
});
