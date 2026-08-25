import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FinancialAccountType, MfsProvider } from '@prisma/client';
import { FinancialAccountService } from './financial-account.service';

/**
 * RAKHAL-335 — `FinancialAccountService` unit coverage. The e2e spec
 * (`test/finance-v2-accounts.e2e-spec.ts`) proves the real DB wiring end to
 * end (RBAC, HTTP shapes, real journal postings); this spec proves the
 * service's own contract in isolation with mocked Prisma/`LedgerAccountService`/
 * `JournalService`: opening balance produces the correct debit/credit pair,
 * an archived account rejects `assertAccountActive`, and `type`/`ledgerAccountId`
 * are never accepted as update targets.
 */
describe('FinancialAccountService', () => {
  let prisma: {
    financialAccount: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    bankAccountDetail: { create: jest.Mock; update: jest.Mock };
    mfsAccountDetail: { create: jest.Mock; update: jest.Mock };
    ledgerAccount: { create: jest.Mock };
    farmCounter: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let ledgerAccountService: { findByCode: jest.Mock };
  let journalService: { postJournal: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let activityLog: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      financialAccount: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      bankAccountDetail: { create: jest.fn(), update: jest.fn() },
      mfsAccountDetail: { create: jest.fn(), update: jest.fn() },
      ledgerAccount: { create: jest.fn() },
      farmCounter: { upsert: jest.fn() },
      $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(prisma)),
    };
    ledgerAccountService = { findByCode: jest.fn() };
    journalService = { postJournal: jest.fn() };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    // RAKHAL-353: `ActivityLogService.record(...)` mocked as a no-op — this
    // spec covers `FinancialAccountService`'s own contract, not the Activity
    // Log's behaviour.
    activityLog = { record: jest.fn().mockResolvedValue(undefined) };
  });

  const make = () =>
    new FinancialAccountService(
      prisma as never,
      ledgerAccountService as never,
      journalService as never,
      activityLog as never,
      logger as never,
    );

  describe('createAccount', () => {
    it('creates a CASH account with no detail row and no journal posting when openingBalance is omitted', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9000 });
      prisma.ledgerAccount.create.mockResolvedValue({
        id: 'ledger-1',
        code: '9000',
      });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
        ledgerAccountId: 'ledger-1',
        currency: 'BDT',
        isActive: true,
      });
      const service = make();

      const result = await service.createAccount('farm-1', 'user-1', {
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
      });

      const ledgerCreateArgs = (
        prisma.ledgerAccount.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { farmId: string; code: string; isSystem: boolean };
      };
      expect(ledgerCreateArgs.data).toMatchObject({
        farmId: 'farm-1',
        code: '9000',
        isSystem: false,
      });
      expect(prisma.bankAccountDetail.create).not.toHaveBeenCalled();
      expect(prisma.mfsAccountDetail.create).not.toHaveBeenCalled();
      expect(journalService.postJournal).not.toHaveBeenCalled();
      expect(result.bankDetail).toBeNull();
      expect(result.mfsDetail).toBeNull();
    });

    it('rejects a BANK account with no bankDetail', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9000 });
      prisma.ledgerAccount.create.mockResolvedValue({ id: 'ledger-1' });
      const service = make();

      await expect(
        service.createAccount('farm-1', 'user-1', {
          name: 'BRAC Bank',
          type: FinancialAccountType.BANK,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.financialAccount.create).not.toHaveBeenCalled();
    });

    it('creates a BANK account with its detail row', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9001 });
      prisma.ledgerAccount.create.mockResolvedValue({
        id: 'ledger-2',
        code: '9001',
      });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-2',
        farmId: 'farm-1',
        name: 'BRAC Bank',
        type: FinancialAccountType.BANK,
        ledgerAccountId: 'ledger-2',
      });
      prisma.bankAccountDetail.create.mockResolvedValue({
        id: 'bd-1',
        financialAccountId: 'fa-2',
        bankName: 'BRAC Bank',
        accountNumber: '1234567890',
        branch: null,
      });
      const service = make();

      const result = await service.createAccount('farm-1', 'user-1', {
        name: 'BRAC Bank',
        type: FinancialAccountType.BANK,
        bankDetail: { bankName: 'BRAC Bank', accountNumber: '1234567890' },
      });

      const bankDetailArgs = (
        prisma.bankAccountDetail.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          financialAccountId: string;
          bankName: string;
          accountNumber: string;
        };
      };
      expect(bankDetailArgs.data).toMatchObject({
        financialAccountId: 'fa-2',
        bankName: 'BRAC Bank',
        accountNumber: '1234567890',
      });
      expect(result.bankDetail?.bankName).toBe('BRAC Bank');
      expect(result.mfsDetail).toBeNull();
    });

    it('creates an MFS account with its detail row', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9002 });
      prisma.ledgerAccount.create.mockResolvedValue({
        id: 'ledger-3',
        code: '9002',
      });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-3',
        farmId: 'farm-1',
        name: 'bKash Merchant',
        type: FinancialAccountType.MFS,
        ledgerAccountId: 'ledger-3',
      });
      prisma.mfsAccountDetail.create.mockResolvedValue({
        id: 'md-1',
        financialAccountId: 'fa-3',
        provider: MfsProvider.BKASH,
        phoneNumber: '01700000000',
        accountType: 'merchant',
      });
      const service = make();

      const result = await service.createAccount('farm-1', 'user-1', {
        name: 'bKash Merchant',
        type: FinancialAccountType.MFS,
        mfsDetail: {
          provider: MfsProvider.BKASH,
          phoneNumber: '01700000000',
          accountType: 'merchant',
        },
      });

      const mfsDetailArgs = (
        prisma.mfsAccountDetail.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          financialAccountId: string;
          provider: MfsProvider;
          phoneNumber: string;
        };
      };
      expect(mfsDetailArgs.data).toMatchObject({
        financialAccountId: 'fa-3',
        provider: MfsProvider.BKASH,
        phoneNumber: '01700000000',
      });
      expect(result.mfsDetail?.provider).toBe(MfsProvider.BKASH);
    });

    it('posts a journal debiting the new account and crediting Opening Balance Equity for a non-zero opening balance', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9000 });
      prisma.ledgerAccount.create.mockResolvedValue({
        id: 'ledger-1',
        code: '9000',
      });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
        ledgerAccountId: 'ledger-1',
      });
      ledgerAccountService.findByCode.mockResolvedValue({
        id: 'ledger-equity',
        code: '3000',
      });
      journalService.postJournal.mockResolvedValue({ id: 'jt-1' });
      const service = make();

      await service.createAccount('farm-1', 'user-1', {
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
        openingBalance: 50000,
      });

      expect(ledgerAccountService.findByCode).toHaveBeenCalledWith(
        'farm-1',
        '3000',
      );
      expect(journalService.postJournal).toHaveBeenCalledTimes(1);
      const [input, client] = journalService.postJournal.mock.calls[0] as [
        {
          farmId: string;
          entries: {
            ledgerAccountId: string;
            debit?: unknown;
            credit?: unknown;
          }[];
        },
        unknown,
      ];
      expect(input.farmId).toBe('farm-1');
      expect(input.entries).toHaveLength(2);
      expect(input.entries[0].ledgerAccountId).toBe('ledger-1');
      expect(input.entries[0].debit).toBeDefined();
      expect(input.entries[1].ledgerAccountId).toBe('ledger-equity');
      expect(input.entries[1].credit).toBeDefined();
      expect(
        (input.entries[0].debit as { toString(): string }).toString(),
      ).toBe('50000');
      expect(client).toBe(prisma);
    });

    it('never posts a journal when openingBalance is 0', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9000 });
      prisma.ledgerAccount.create.mockResolvedValue({ id: 'ledger-1' });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        type: FinancialAccountType.CASH,
        ledgerAccountId: 'ledger-1',
      });
      const service = make();

      await service.createAccount('farm-1', 'user-1', {
        name: 'Cash Box',
        type: FinancialAccountType.CASH,
        openingBalance: 0,
      });

      expect(journalService.postJournal).not.toHaveBeenCalled();
    });

    it('honors a supplied external tx instead of opening its own $transaction', async () => {
      const tx = {
        farmCounter: { upsert: jest.fn().mockResolvedValue({ value: 9000 }) },
        ledgerAccount: {
          create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
        },
        financialAccount: {
          create: jest.fn().mockResolvedValue({
            id: 'fa-1',
            type: FinancialAccountType.CASH,
            ledgerAccountId: 'ledger-1',
          }),
        },
      };
      const service = make();

      await service.createAccount(
        'farm-1',
        'user-1',
        { name: 'Cash Box', type: FinancialAccountType.CASH },
        tx as never,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.financialAccount.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('nextCustomLedgerCode (RD-061 — bound + range)', () => {
    it('rejects account creation once the counter walks past the dedicated 9000-9999 range instead of colliding with whatever code comes next', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 10000 });
      const service = make();

      await expect(
        service.createAccount('farm-1', 'user-1', {
          name: 'One Too Many',
          type: FinancialAccountType.CASH,
        }),
      ).rejects.toThrow(ConflictException);
      // Never reaches ledgerAccount.create with a code outside the dedicated range.
      expect(prisma.ledgerAccount.create).not.toHaveBeenCalled();
    });

    it('allocates exactly the counter value as the code, never a fixed/stale constant', async () => {
      prisma.farmCounter.upsert.mockResolvedValue({ value: 9042 });
      prisma.ledgerAccount.create.mockResolvedValue({
        id: 'ledger-42',
        code: '9042',
      });
      prisma.financialAccount.create.mockResolvedValue({
        id: 'fa-42',
        type: FinancialAccountType.CASH,
        ledgerAccountId: 'ledger-42',
      });
      const service = make();

      await service.createAccount('farm-1', 'user-1', {
        name: 'Petty Cash',
        type: FinancialAccountType.CASH,
      });

      const ledgerCreateArgs = (
        prisma.ledgerAccount.create.mock.calls as unknown[][]
      )[0][0] as { data: { code: string } };
      expect(ledgerCreateArgs.data.code).toBe('9042');
      // The counter allocation happens on the SAME transaction client used
      // for the rest of the create — an aborted create (e.g. a later
      // failure inside the same $transaction) rolls the counter back too,
      // so no code is ever burned by a failed attempt (matches
      // `SaleNumberAllocator`'s documented "a rolled-back create releases
      // the number" guarantee).
      expect(prisma.farmCounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scope: 'finance-v2-account:farm-1' },
        }),
      );
    });
  });

  describe('archiveAccount', () => {
    it('archives an active account (isActive:false + archivedAt set), never deletes', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        isActive: true,
      });
      prisma.financialAccount.update.mockResolvedValue({
        id: 'fa-1',
        isActive: false,
        archivedAt: new Date(),
        bankDetail: null,
        mfsDetail: null,
      });
      const service = make();

      const result = await service.archiveAccount('farm-1', 'fa-1');

      const updateArgs = (
        prisma.financialAccount.update.mock.calls as unknown[][]
      )[0][0] as { where: { id: string }; data: { isActive: boolean } };
      expect(updateArgs.where).toEqual({ id: 'fa-1' });
      expect(updateArgs.data.isActive).toBe(false);
      expect(result.isActive).toBe(false);
      expect(prisma.financialAccount).not.toHaveProperty('delete');
    });

    it('rejects re-archiving an already-archived account', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        isActive: false,
      });
      const service = make();

      await expect(service.archiveAccount('farm-1', 'fa-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.financialAccount.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a cross-farm/unknown id', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);
      const service = make();

      await expect(service.archiveAccount('farm-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertAccountActive', () => {
    it('resolves silently for an active account', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        isActive: true,
      });
      const service = make();

      await expect(
        service.assertAccountActive('farm-1', 'fa-1'),
      ).resolves.toBeUndefined();
    });

    it('rejects an archived account', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        isActive: false,
      });
      const service = make();

      await expect(
        service.assertAccountActive('farm-1', 'fa-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAccount', () => {
    it('updates only the editable name field, leaving type/ledgerAccountId untouched (not accepted by the DTO)', async () => {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce({
          id: 'fa-1',
          farmId: 'farm-1',
          type: FinancialAccountType.CASH,
          isActive: true,
          bankDetail: null,
          mfsDetail: null,
        })
        .mockResolvedValueOnce({
          id: 'fa-1',
          farmId: 'farm-1',
          name: 'Renamed',
          type: FinancialAccountType.CASH,
          isActive: true,
          bankDetail: null,
          mfsDetail: null,
        });
      const service = make();

      await service.updateAccount('farm-1', 'fa-1', { name: 'Renamed' });

      expect(prisma.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fa-1' },
          data: { name: 'Renamed' },
        }),
      );
    });

    it('rejects a bankDetail update against a non-BANK account', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        farmId: 'farm-1',
        type: FinancialAccountType.CASH,
        isActive: true,
        bankDetail: null,
        mfsDetail: null,
      });
      const service = make();

      await expect(
        service.updateAccount('farm-1', 'fa-1', {
          bankDetail: { bankName: 'X' },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bankAccountDetail.update).not.toHaveBeenCalled();
    });
  });
});
