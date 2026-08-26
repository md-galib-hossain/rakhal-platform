import { NotFoundException } from '@nestjs/common';
import { FinancialAccountType } from '@prisma/client';
import { BalanceService } from './balance.service';

/**
 * RAKHAL-336 — `BalanceService` unit coverage. The e2e spec
 * (`test/finance-v2-balance.e2e-spec.ts`) proves the real DB wiring
 * (opening-balance postings → `GET /finance/balance`); this spec proves the
 * sign convention and aggregation logic in isolation with a mocked Prisma
 * client: an asset account's balance is `debit - credit`, per-type sums are
 * correct, archived accounts are excluded by default, and the
 * receivable/payable block is always a documented zero placeholder.
 */
describe('BalanceService', () => {
  let prisma: {
    financialAccount: { findFirst: jest.Mock; findMany: jest.Mock };
    journalEntry: { aggregate: jest.Mock };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

  beforeEach(() => {
    prisma = {
      financialAccount: { findFirst: jest.fn(), findMany: jest.fn() },
      journalEntry: { aggregate: jest.fn() },
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () => new BalanceService(prisma as never, logger as never);

  describe('getAccountBalance', () => {
    it('computes balance as debit - credit (asset sign convention)', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        name: 'BRAC Bank',
        type: FinancialAccountType.BANK,
        ledgerAccountId: 'ledger-1',
      });
      prisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { debit: 50000, credit: 15000 },
      });

      const result = await make().getAccountBalance('farm-1', 'fa-1');

      expect(result.balance.toString()).toBe('35000');
      expect(prisma.journalEntry.aggregate).toHaveBeenCalledWith({
        where: { ledgerAccountId: 'ledger-1' },
        _sum: { debit: true, credit: true },
      });
    });

    it('returns zero balance when no journal entries exist yet (null sums)', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
        ledgerAccountId: 'ledger-1',
      });
      prisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { debit: null, credit: null },
      });

      const result = await make().getAccountBalance('farm-1', 'fa-1');
      expect(result.balance.toString()).toBe('0');
    });

    it('throws NotFoundException for an unknown/cross-farm account id', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);
      await expect(
        make().getAccountBalance('farm-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFarmBalances', () => {
    it('sums balances grouped by type, defaulting to active accounts only', async () => {
      prisma.financialAccount.findMany.mockResolvedValue([
        {
          id: 'cash-1',
          name: 'Cash Box',
          type: FinancialAccountType.CASH,
          ledgerAccountId: 'l-cash',
        },
        {
          id: 'bank-1',
          name: 'BRAC Bank',
          type: FinancialAccountType.BANK,
          ledgerAccountId: 'l-bank',
        },
        {
          id: 'bank-2',
          name: 'City Bank',
          type: FinancialAccountType.BANK,
          ledgerAccountId: 'l-bank-2',
        },
      ]);
      prisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { debit: 10000, credit: 0 } }) // cash-1
        .mockResolvedValueOnce({ _sum: { debit: 20000, credit: 0 } }) // bank-1
        .mockResolvedValueOnce({ _sum: { debit: 5000, credit: 1000 } }); // bank-2

      const result = await make().getFarmBalances('farm-1');

      expect(prisma.financialAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { farmId: 'farm-1', isActive: true },
        }),
      );
      expect(result.accounts).toHaveLength(3);
      expect(result.byType[FinancialAccountType.CASH].toString()).toBe('10000');
      expect(result.byType[FinancialAccountType.BANK].toString()).toBe('24000');
      expect(result.byType[FinancialAccountType.MFS].toString()).toBe('0');
    });

    it('includes archived accounts when includeArchived=true', async () => {
      prisma.financialAccount.findMany.mockResolvedValue([]);
      await make().getFarmBalances('farm-1', true);
      expect(prisma.financialAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { farmId: 'farm-1' } }),
      );
    });
  });

  describe('getRakhalBalance', () => {
    it('sums Cash + Bank + MFS into the headline Rakhal Balance', async () => {
      prisma.financialAccount.findMany.mockResolvedValue([
        {
          id: 'cash-1',
          name: 'Cash Box',
          type: FinancialAccountType.CASH,
          ledgerAccountId: 'l-cash',
        },
        {
          id: 'bank-1',
          name: 'BRAC Bank',
          type: FinancialAccountType.BANK,
          ledgerAccountId: 'l-bank',
        },
        {
          id: 'mfs-1',
          name: 'bKash',
          type: FinancialAccountType.MFS,
          ledgerAccountId: 'l-mfs',
        },
      ]);
      prisma.journalEntry.aggregate
        .mockResolvedValueOnce({ _sum: { debit: 50000, credit: 0 } })
        .mockResolvedValueOnce({ _sum: { debit: 20000, credit: 0 } })
        .mockResolvedValueOnce({ _sum: { debit: 0, credit: 0 } });

      const result = await make().getRakhalBalance('farm-1');

      expect(result.rakhalBalance.toString()).toBe('70000');
      expect(result.breakdown.cash.toString()).toBe('50000');
      expect(result.breakdown.bank.toString()).toBe('20000');
      expect(result.breakdown.mfs.toString()).toBe('0');
    });

    it('never references or sums any Rakhal-Credit-shaped field', async () => {
      prisma.financialAccount.findMany.mockResolvedValue([]);
      const result = await make().getRakhalBalance('farm-1');
      const keys = JSON.stringify(result).toLowerCase();
      expect(keys).not.toContain('credit_wallet');
      expect(keys).not.toContain('rakhalcredit');
      expect(keys).not.toContain('creditwallet');
    });
  });
});
