import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransferService } from './transfer.service';

/**
 * RAKHAL-338 — `TransferService` unit coverage. The e2e spec
 * (`test/finance-v2-transfers.e2e-spec.ts`) proves the real DB wiring end to
 * end; this spec proves the service's own contract in isolation with mocked
 * Prisma/`FinancialAccountService`/`BalanceService`/`LedgerAccountService`/
 * `JournalService` — specifically the exact debit/credit lines
 * `FINANCE_V2_DESIGN.md` §4.4's worked example requires: a ৳10,000 transfer
 * bKash→Bank with a ৳100 fee leaves Bank +10,000, bKash −10,100 (two credit
 * lines against the same ledger account), Transfer Fee Expense +100.
 */
describe('TransferService', () => {
  let prisma: {
    financialAccount: { findFirst: jest.Mock };
    transfer: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let financialAccountService: { assertAccountActive: jest.Mock };
  let balanceService: { getAccountBalance: jest.Mock };
  let ledgerAccountService: { findByCode: jest.Mock };
  let journalService: { postJournal: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let activityLog: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      financialAccount: { findFirst: jest.fn() },
      transfer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(prisma)),
    };
    financialAccountService = { assertAccountActive: jest.fn() };
    balanceService = { getAccountBalance: jest.fn() };
    ledgerAccountService = { findByCode: jest.fn() };
    journalService = { postJournal: jest.fn() };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    // RAKHAL-353: `ActivityLogService.record(...)` mocked as a no-op —
    // this spec covers `TransferService`'s own contract, not the Activity
    // Log's behaviour.
    activityLog = { record: jest.fn().mockResolvedValue(undefined) };
  });

  const make = () =>
    new TransferService(
      prisma as never,
      financialAccountService as never,
      balanceService as never,
      ledgerAccountService as never,
      journalService as never,
      activityLog as never,
      logger as never,
    );

  const baseDto = {
    fromFinancialAccountId: 'fa-bkash',
    toFinancialAccountId: 'fa-bank',
    amount: 10_000,
    transactionDate: '2026-08-17T00:00:00.000Z',
  };

  const mockAccounts = (balance: number = 1_000_000): void => {
    prisma.financialAccount.findFirst.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'fa-bkash') {
          return Promise.resolve({
            id: 'fa-bkash',
            ledgerAccountId: 'ledger-bkash',
          });
        }
        if (where.id === 'fa-bank') {
          return Promise.resolve({
            id: 'fa-bank',
            ledgerAccountId: 'ledger-bank',
          });
        }
        return Promise.resolve(null);
      },
    );
    balanceService.getAccountBalance.mockResolvedValue({
      id: 'fa-bkash',
      name: 'bKash',
      type: 'MFS',
      balance: new Prisma.Decimal(balance),
    });
  };

  describe('createTransfer', () => {
    it('rejects a same-account transfer before touching the DB', async () => {
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', {
          ...baseDto,
          toFinancialAccountId: baseDto.fromFinancialAccountId,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transfer.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive amount', async () => {
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', { ...baseDto, amount: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transfer.create).not.toHaveBeenCalled();
    });

    it('rejects a negative fee', async () => {
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', {
          ...baseDto,
          feeAmount: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates assertAccountActive rejecting an archived account', async () => {
      financialAccountService.assertAccountActive.mockRejectedValue(
        new BadRequestException('archived'),
      );
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', baseDto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transfer.create).not.toHaveBeenCalled();
    });

    it('rejects a transfer that exceeds the source account balance', async () => {
      mockAccounts(50); // less than the 10,000 amount
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', baseDto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transfer.create).not.toHaveBeenCalled();
    });

    it('rejects when the balance covers the amount but not amount + fee', async () => {
      mockAccounts(10_050); // covers 10,000 but not 10,000 + 100 fee
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', {
          ...baseDto,
          feeAmount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no-fee transfer: debits destination, credits source — exactly 2 balanced lines', async () => {
      mockAccounts();
      prisma.transfer.create.mockResolvedValue({
        id: 'tr-1',
        farmId: 'farm-1',
        fromFinancialAccountId: 'fa-bkash',
        toFinancialAccountId: 'fa-bank',
        amount: new Prisma.Decimal(10_000),
        feeAmount: new Prisma.Decimal(0),
        transactionDate: new Date('2026-08-17T00:00:00.000Z'),
      });
      const service = make();

      await service.createTransfer('farm-1', 'user-1', baseDto);

      expect(ledgerAccountService.findByCode).not.toHaveBeenCalled();
      expect(journalService.postJournal).toHaveBeenCalledTimes(1);
      const [input] = journalService.postJournal.mock.calls[0] as [
        {
          entries: {
            ledgerAccountId: string;
            debit?: Prisma.Decimal;
            credit?: Prisma.Decimal;
          }[];
          sourceType: string;
          sourceId: string;
        },
      ];
      expect(input.sourceType).toBe('FINANCE_TRANSFER');
      expect(input.sourceId).toBe('tr-1');
      expect(input.entries).toHaveLength(2);
      expect(input.entries[0]).toMatchObject({
        ledgerAccountId: 'ledger-bank',
      });
      expect(input.entries[0].debit?.toString()).toBe('10000');
      expect(input.entries[1]).toMatchObject({
        ledgerAccountId: 'ledger-bkash',
      });
      expect(input.entries[1].credit?.toString()).toBe('10000');
    });

    it('fee transfer: the design doc worked example — Bank +10,000, bKash -10,100, Transfer Fee Expense +100', async () => {
      mockAccounts();
      ledgerAccountService.findByCode.mockResolvedValue({
        id: 'ledger-transfer-fee',
        code: '5500',
      });
      prisma.transfer.create.mockResolvedValue({
        id: 'tr-2',
        farmId: 'farm-1',
        fromFinancialAccountId: 'fa-bkash',
        toFinancialAccountId: 'fa-bank',
        amount: new Prisma.Decimal(10_000),
        feeAmount: new Prisma.Decimal(100),
        transactionDate: new Date('2026-08-17T00:00:00.000Z'),
      });
      const service = make();

      await service.createTransfer('farm-1', 'user-1', {
        ...baseDto,
        feeAmount: 100,
      });

      expect(ledgerAccountService.findByCode).toHaveBeenCalledWith(
        'farm-1',
        '5500',
      );
      const [input] = journalService.postJournal.mock.calls[0] as [
        {
          entries: {
            ledgerAccountId: string;
            debit?: Prisma.Decimal;
            credit?: Prisma.Decimal;
          }[];
        },
      ];
      expect(input.entries).toHaveLength(4);

      // Line 1: Debit Bank (destination) 10,000
      expect(input.entries[0]).toMatchObject({
        ledgerAccountId: 'ledger-bank',
      });
      expect(input.entries[0].debit?.toString()).toBe('10000');

      // Line 2: Credit bKash (source) 10,000 — the transfer itself
      expect(input.entries[1]).toMatchObject({
        ledgerAccountId: 'ledger-bkash',
      });
      expect(input.entries[1].credit?.toString()).toBe('10000');

      // Line 3: Debit Transfer Fee Expense 100
      expect(input.entries[2]).toMatchObject({
        ledgerAccountId: 'ledger-transfer-fee',
      });
      expect(input.entries[2].debit?.toString()).toBe('100');

      // Line 4: Credit bKash (source) 100 — the fee
      expect(input.entries[3]).toMatchObject({
        ledgerAccountId: 'ledger-bkash',
      });
      expect(input.entries[3].credit?.toString()).toBe('100');

      // Total debit (10,000 + 100) === total credit (10,000 + 100) — balanced.
      const totalDebit = input.entries.reduce(
        (t, e) => t.plus(e.debit ?? 0),
        new Prisma.Decimal(0),
      );
      const totalCredit = input.entries.reduce(
        (t, e) => t.plus(e.credit ?? 0),
        new Prisma.Decimal(0),
      );
      expect(totalDebit.toString()).toBe(totalCredit.toString());

      // bKash's own net movement: -10,000 - 100 = -10,100.
      const bkashCredits = input.entries
        .filter((e) => e.ledgerAccountId === 'ledger-bkash')
        .reduce((t, e) => t.plus(e.credit ?? 0), new Prisma.Decimal(0));
      expect(bkashCredits.toString()).toBe('10100');
    });

    it('throws NotFoundException when the source account does not resolve for this farm', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);
      balanceService.getAccountBalance.mockResolvedValue({
        id: 'fa-bkash',
        name: 'bKash',
        type: 'MFS',
        balance: new Prisma.Decimal(1_000_000),
      });
      const service = make();

      await expect(
        service.createTransfer('farm-1', 'user-1', baseDto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
