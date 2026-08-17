import { JournalTransactionStatus } from '@prisma/client';
import { JournalService } from './journal.service';
import {
  JournalAlreadyReversedError,
  JournalNotFoundError,
  JournalUnbalancedError,
} from '../domain/journal-balance';

/**
 * RAKHAL-334 — `JournalService.postJournal`/`reverseJournal` unit coverage.
 * The e2e spec (`test/finance-v2-journal.e2e-spec.ts`) proves the real DB
 * wiring + atomicity end to end; this spec proves the service's own
 * contract in isolation with a mocked Prisma client: an unbalanced posting
 * never reaches `create`, a replayed idempotency key is a no-op, an
 * external `tx` is honored instead of opening a new `$transaction`, and a
 * reversal mirrors debit/credit while never calling `update`/`delete` on
 * either model.
 */
describe('JournalService', () => {
  let prisma: {
    journalTransaction: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  beforeEach(() => {
    prisma = {
      journalTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(prisma)),
    };
    logger = { setContext: jest.fn().mockReturnThis(), info: jest.fn() };
  });

  const make = () => new JournalService(prisma as never, logger as never);

  const balancedEntries = [
    { ledgerAccountId: 'acct-cash', debit: '100.00' },
    { ledgerAccountId: 'acct-revenue', credit: '100.00' },
  ];

  const baseInput = {
    farmId: 'farm-1',
    sourceType: 'SALE',
    sourceId: 'sale-1',
    transactionDate: new Date('2026-08-17T00:00:00.000Z'),
    description: 'Test sale',
    idempotencyKey: 'SALE:sale-1',
    createdById: 'user-1',
    entries: balancedEntries,
  };

  describe('postJournal', () => {
    it('rejects an unbalanced posting before any DB write', async () => {
      const service = make();
      await expect(
        service.postJournal({
          ...baseInput,
          entries: [
            { ledgerAccountId: 'acct-cash', debit: '100.00' },
            { ledgerAccountId: 'acct-revenue', credit: '99.00' },
          ],
        }),
      ).rejects.toThrow(JournalUnbalancedError);

      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
      expect(prisma.journalTransaction.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('wraps the write in its own $transaction when no external tx is supplied', async () => {
      prisma.journalTransaction.create.mockResolvedValue({
        id: 'jt-1',
        entries: [],
      });
      const service = make();

      await service.postJournal(baseInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.journalTransaction.create).toHaveBeenCalledTimes(1);
      const createArgs = (
        prisma.journalTransaction.create.mock.calls as unknown[][]
      )[0][0] as {
        data: Record<string, unknown>;
      };
      expect(createArgs.data.status).toBe(JournalTransactionStatus.POSTED);
      expect(createArgs.data.farmId).toBe('farm-1');
      expect(createArgs.data.idempotencyKey).toBe('SALE:sale-1');
    });

    it('uses the supplied external tx instead of opening its own $transaction', async () => {
      const tx = {
        journalTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'jt-1', entries: [] }),
        },
      };
      const service = make();

      await service.postJournal(baseInput, tx as never);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.journalTransaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
    });

    it('is idempotent: a replayed (farmId, idempotencyKey) returns the original without calling create again', async () => {
      const original = {
        id: 'jt-existing',
        status: JournalTransactionStatus.POSTED,
        entries: balancedEntries,
      };
      prisma.journalTransaction.findUnique.mockResolvedValue(original);
      const service = make();

      const result = await service.postJournal(baseInput);

      expect(result).toBe(original);
      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
    });

    it('rounds each line to 2dp via the shared money module before writing', async () => {
      prisma.journalTransaction.create.mockResolvedValue({
        id: 'jt-1',
        entries: [],
      });
      const service = make();

      await service.postJournal({
        ...baseInput,
        entries: [
          { ledgerAccountId: 'acct-cash', debit: '100.005' },
          { ledgerAccountId: 'acct-revenue', credit: '100.005' },
        ],
      });

      const createArgs = (
        prisma.journalTransaction.create.mock.calls as unknown[][]
      )[0][0] as {
        data: { entries: { create: { debit: unknown; credit: unknown }[] } };
      };
      const lines = createArgs.data.entries.create as {
        debit: { toString(): string };
        credit: { toString(): string };
      }[];
      expect(lines[0].debit.toString()).toBe('100.01');
      expect(lines[1].credit.toString()).toBe('100.01');
    });
  });

  describe('reverseJournal', () => {
    const reverseInput = {
      farmId: 'farm-1',
      journalTransactionId: 'jt-original',
      createdById: 'user-1',
      idempotencyKey: 'REVERSE:jt-original',
    };

    it('throws JournalNotFoundError when the target transaction does not exist for the farm', async () => {
      prisma.journalTransaction.findFirst.mockResolvedValueOnce(null); // original lookup
      const service = make();

      await expect(service.reverseJournal(reverseInput)).rejects.toThrow(
        JournalNotFoundError,
      );
      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
    });

    it('creates a mirrored, balanced reversal transaction linked via reversalOfId, never touching the original', async () => {
      const original = {
        id: 'jt-original',
        farmId: 'farm-1',
        sourceType: 'SALE',
        sourceId: 'sale-1',
        description: 'Original sale',
        entries: [
          { ledgerAccountId: 'acct-cash', debit: '100.00', credit: '0.00' },
          { ledgerAccountId: 'acct-revenue', debit: '0.00', credit: '100.00' },
        ],
      };
      prisma.journalTransaction.findFirst
        .mockResolvedValueOnce(original) // original lookup
        .mockResolvedValueOnce(null); // already-reversed check
      prisma.journalTransaction.create.mockResolvedValue({
        id: 'jt-reversal',
        status: JournalTransactionStatus.REVERSED,
        reversalOfId: 'jt-original',
        entries: [],
      });
      const service = make();

      await service.reverseJournal(reverseInput);

      expect(prisma.journalTransaction.create).toHaveBeenCalledTimes(1);
      const createArgs = (
        prisma.journalTransaction.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          status: JournalTransactionStatus;
          reversalOfId: string;
          entries: {
            create: {
              ledgerAccountId: string;
              debit: unknown;
              credit: unknown;
            }[];
          };
        };
      };
      expect(createArgs.data.status).toBe(JournalTransactionStatus.REVERSED);
      expect(createArgs.data.reversalOfId).toBe('jt-original');
      const lines = createArgs.data.entries.create;
      expect(
        (
          lines.find((l) => l.ledgerAccountId === 'acct-cash')?.credit as {
            toFixed(dp: number): string;
          }
        ).toFixed(2),
      ).toBe('100.00');
      expect(
        (
          lines.find((l) => l.ledgerAccountId === 'acct-revenue')?.debit as {
            toFixed(dp: number): string;
          }
        ).toFixed(2),
      ).toBe('100.00');

      // The original was only ever read, never updated or deleted.
      expect(prisma.journalTransaction).not.toHaveProperty('update');
      expect(prisma.journalTransaction).not.toHaveProperty('delete');
    });

    it('throws JournalAlreadyReversedError when a reversal of the target already exists', async () => {
      const original = {
        id: 'jt-original',
        farmId: 'farm-1',
        sourceType: 'SALE',
        sourceId: 'sale-1',
        description: 'Original sale',
        entries: [
          { ledgerAccountId: 'acct-cash', debit: '100.00', credit: '0.00' },
          { ledgerAccountId: 'acct-revenue', debit: '0.00', credit: '100.00' },
        ],
      };
      prisma.journalTransaction.findFirst
        .mockResolvedValueOnce(original) // original lookup
        .mockResolvedValueOnce({ id: 'jt-existing-reversal' }); // already-reversed check
      const service = make();

      await expect(service.reverseJournal(reverseInput)).rejects.toThrow(
        JournalAlreadyReversedError,
      );
      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
    });

    it('is idempotent: a replayed reversal idempotencyKey returns the existing reversal without re-reversing', async () => {
      const existingReversal = {
        id: 'jt-reversal',
        status: JournalTransactionStatus.REVERSED,
        reversalOfId: 'jt-original',
        entries: [],
      };
      prisma.journalTransaction.findUnique.mockResolvedValue(existingReversal);
      const service = make();

      const result = await service.reverseJournal(reverseInput);

      expect(result).toBe(existingReversal);
      expect(prisma.journalTransaction.findFirst).not.toHaveBeenCalled();
      expect(prisma.journalTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('scopes the lookup by (id, farmId) and includes entries', async () => {
      prisma.journalTransaction.findFirst.mockResolvedValue(null);
      const service = make();

      await service.findById('farm-1', 'jt-1');

      expect(prisma.journalTransaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'jt-1', farmId: 'farm-1' },
        include: { entries: true },
      });
    });
  });
});
