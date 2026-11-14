import { LedgerAccountCategory } from '@prisma/client';
import { LedgerAccountService } from './ledger-account.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../domain/default-chart-of-accounts';

/**
 * RAKHAL-333 — `LedgerAccountService.seedDefaultChart` unit coverage. The
 * e2e spec (`test/finance-v2-ledger-accounts.e2e-spec.ts`) proves the real
 * bootstrap wiring end to end; this spec proves the service's own contract
 * in isolation: every default account is written as `isSystem: true`,
 * duplicates are skipped (idempotent re-seed), and an external
 * `Prisma.TransactionClient` is honored when supplied.
 */
describe('LedgerAccountService', () => {
  let prisma: {
    ledgerAccount: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  beforeEach(() => {
    prisma = {
      ledgerAccount: {
        createMany: jest
          .fn()
          .mockResolvedValue({ count: DEFAULT_CHART_OF_ACCOUNTS.length }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () => new LedgerAccountService(prisma as never, logger as never);

  describe('seedDefaultChart', () => {
    it('writes every default account, all isSystem:true, with skipDuplicates set', async () => {
      const service = make();
      await service.seedDefaultChart('farm-1');

      expect(prisma.ledgerAccount.createMany).toHaveBeenCalledTimes(1);
      const calls = prisma.ledgerAccount.createMany.mock.calls as unknown[][];
      const call = calls[0][0] as {
        data: {
          farmId: string;
          category: LedgerAccountCategory;
          code: string;
          name: string;
          isSystem: boolean;
        }[];
        skipDuplicates: boolean;
      };
      expect(call.skipDuplicates).toBe(true);
      expect(call.data).toHaveLength(DEFAULT_CHART_OF_ACCOUNTS.length);
      expect(call.data.every((row) => row.farmId === 'farm-1')).toBe(true);
      expect(call.data.every((row) => row.isSystem === true)).toBe(true);

      // Every AC-named account is present.
      const names = call.data.map((row) => row.name);
      for (const expected of [
        'Cash',
        'Bank',
        'MFS',
        'Accounts Receivable',
        'Inventory',
        'Accounts Payable',
        'Loans',
        'Opening Balance Equity',
        'Milk Sales',
        'Animal Sales',
        'Manure Sales',
        'Inventory Sales',
        'Other Income',
        'Feed',
        'Medicine',
        'Salary',
        'Breeding',
        'Utilities',
        'Transfer Fee',
        'Depreciation',
      ]) {
        expect(names).toContain(expected);
      }
    });

    it('uses the supplied transaction client instead of the default prisma instance', async () => {
      const tx = {
        ledgerAccount: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const service = make();

      await service.seedDefaultChart('farm-1', tx as never);

      expect(tx.ledgerAccount.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.ledgerAccount.createMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findByCode', () => {
    it('orders findAll by code', async () => {
      const service = make();
      await service.findAll('farm-1');
      expect(prisma.ledgerAccount.findMany).toHaveBeenCalledWith({
        where: { farmId: 'farm-1' },
        orderBy: { code: 'asc' },
      });
    });

    it('looks up findByCode by the (farmId, code) composite key', async () => {
      const service = make();
      await service.findByCode('farm-1', '1000');
      expect(prisma.ledgerAccount.findUnique).toHaveBeenCalledWith({
        where: { farmId_code: { farmId: 'farm-1', code: '1000' } },
      });
    });
  });

  describe('findByCodeOrSeed', () => {
    it('returns the existing account without re-seeding', async () => {
      prisma.ledgerAccount.findUnique.mockResolvedValue({ id: 'a1' });
      const service = make();

      const result = await service.findByCodeOrSeed('farm-1', '5300');

      expect(result).toEqual({ id: 'a1' });
      expect(prisma.ledgerAccount.createMany).not.toHaveBeenCalled();
    });

    it('re-seeds the default chart and re-reads when the account is missing', async () => {
      prisma.ledgerAccount.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'a2' });
      const service = make();

      const result = await service.findByCodeOrSeed('farm-1', '5300');

      expect(prisma.ledgerAccount.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.ledgerAccount.findUnique).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: 'a2' });
    });

    it('returns null for a code that is not in the default chart', async () => {
      const service = make();
      expect(await service.findByCodeOrSeed('farm-1', '9999')).toBeNull();
    });
  });
});

describe('DEFAULT_CHART_OF_ACCOUNTS', () => {
  it('has 21 accounts (RAKHAL-333 AC + RAKHAL-367 5900 Other Expense)', () => {
    expect(DEFAULT_CHART_OF_ACCOUNTS).toHaveLength(21);
  });

  it('has unique codes', () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every code falls in its category's standard range (1xxx-5xxx)", () => {
    const rangeByCategory: Record<LedgerAccountCategory, string> = {
      [LedgerAccountCategory.ASSET]: '1',
      [LedgerAccountCategory.LIABILITY]: '2',
      [LedgerAccountCategory.EQUITY]: '3',
      [LedgerAccountCategory.REVENUE]: '4',
      [LedgerAccountCategory.EXPENSE]: '5',
    };
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      expect(account.code[0]).toBe(rangeByCategory[account.category]);
    }
  });
});
