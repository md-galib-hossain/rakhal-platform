import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentDirection, PaymentMethod } from '@prisma/client';
import { PaymentService } from './payment.service';

/**
 * RAKHAL-337 — `PaymentService` unit coverage. The e2e spec
 * (`test/finance-v2-payments.e2e-spec.ts`) proves the real DB wiring end to
 * end; this spec proves the service's own contract in isolation with mocked
 * Prisma/`FinancialAccountService`/`LedgerAccountService`/`JournalService`:
 * `recordPayment` posts the correct debit/credit sides for INCOMING vs
 * OUTGOING against the generic Accounts Receivable/Payable ledger accounts
 * (this ticket's standalone-payment judgment call, documented on the
 * service class), and `allocatePayment` rejects over-allocation.
 */
describe('PaymentService', () => {
  let prisma: {
    financialAccount: { findFirst: jest.Mock };
    financePayment: { create: jest.Mock; findFirst: jest.Mock };
    paymentAllocation: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let financialAccountService: { assertAccountActive: jest.Mock };
  let ledgerAccountService: { findByCode: jest.Mock };
  let journalService: { postJournal: jest.Mock };
  let receivableService: {
    assertWithinOutstanding: jest.Mock;
    closeIfSettled: jest.Mock;
  };
  let payableService: {
    assertWithinOutstanding: jest.Mock;
    closeIfSettled: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let activityLog: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      financialAccount: { findFirst: jest.fn() },
      financePayment: { create: jest.fn(), findFirst: jest.fn() },
      paymentAllocation: { create: jest.fn() },
      $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(prisma)),
    };
    financialAccountService = { assertAccountActive: jest.fn() };
    ledgerAccountService = { findByCode: jest.fn() };
    journalService = { postJournal: jest.fn() };
    // RAKHAL-340: `assertWithinOutstanding`/`closeIfSettled` are only
    // invoked for lines carrying a `receivableId` — default to no-ops so
    // this file's existing behaviour is unchanged; the RAKHAL-340 cases
    // below configure real rejections/assertions on these mocks.
    receivableService = {
      assertWithinOutstanding: jest.fn().mockResolvedValue(undefined),
      closeIfSettled: jest.fn().mockResolvedValue(undefined),
    };
    // RAKHAL-349: same default-no-op treatment, mirrored on the payable
    // side — only invoked for lines carrying a `payableId`.
    payableService = {
      assertWithinOutstanding: jest.fn().mockResolvedValue(undefined),
      closeIfSettled: jest.fn().mockResolvedValue(undefined),
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    // RAKHAL-353: `ActivityLogService.record(...)` — mocked as a no-op
    // resolved promise; this spec covers `PaymentService`'s own contract in
    // isolation, not the Activity Log's own behaviour (that's
    // `activity-log.service.spec.ts`'s job).
    activityLog = { record: jest.fn().mockResolvedValue(undefined) };
  });

  const make = () =>
    new PaymentService(
      prisma as never,
      financialAccountService as never,
      ledgerAccountService as never,
      journalService as never,
      receivableService as never,
      payableService as never,
      activityLog as never,
      logger as never,
    );

  describe('recordPayment', () => {
    const baseDto = {
      direction: PaymentDirection.INCOMING,
      financialAccountId: 'fa-1',
      amount: 4000,
      method: PaymentMethod.MFS,
      transactionDate: '2026-08-17T00:00:00.000Z',
    };

    it('debits the account and credits Accounts Receivable for an INCOMING payment', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        ledgerAccountId: 'ledger-fa-1',
      });
      ledgerAccountService.findByCode.mockResolvedValue({
        id: 'ledger-ar',
        code: '1100',
      });
      prisma.financePayment.create.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        direction: PaymentDirection.INCOMING,
        financialAccountId: 'fa-1',
        amount: 4000,
        transactionDate: new Date('2026-08-17T00:00:00.000Z'),
      });
      const service = make();

      await service.recordPayment('farm-1', 'user-1', baseDto);

      expect(financialAccountService.assertAccountActive).toHaveBeenCalledWith(
        'farm-1',
        'fa-1',
      );
      expect(ledgerAccountService.findByCode).toHaveBeenCalledWith(
        'farm-1',
        '1100',
      );
      expect(journalService.postJournal).toHaveBeenCalledTimes(1);
      const [input] = journalService.postJournal.mock.calls[0] as [
        {
          entries: {
            ledgerAccountId: string;
            debit?: unknown;
            credit?: unknown;
          }[];
          sourceType: string;
          sourceId: string;
        },
      ];
      expect(input.sourceType).toBe('FINANCE_PAYMENT');
      expect(input.sourceId).toBe('pay-1');
      expect(input.entries).toHaveLength(2);
      expect(input.entries[0]).toMatchObject({
        ledgerAccountId: 'ledger-fa-1',
      });
      expect(input.entries[0].debit).toBeDefined();
      expect(input.entries[1]).toMatchObject({ ledgerAccountId: 'ledger-ar' });
      expect(input.entries[1].credit).toBeDefined();
    });

    it('debits Accounts Payable and credits the account for an OUTGOING payment', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        ledgerAccountId: 'ledger-fa-1',
      });
      ledgerAccountService.findByCode.mockResolvedValue({
        id: 'ledger-ap',
        code: '2000',
      });
      prisma.financePayment.create.mockResolvedValue({
        id: 'pay-2',
        farmId: 'farm-1',
        direction: PaymentDirection.OUTGOING,
        financialAccountId: 'fa-1',
        amount: 1000,
        transactionDate: new Date('2026-08-17T00:00:00.000Z'),
      });
      const service = make();

      await service.recordPayment('farm-1', 'user-1', {
        ...baseDto,
        direction: PaymentDirection.OUTGOING,
        amount: 1000,
        method: PaymentMethod.CASH,
      });

      expect(ledgerAccountService.findByCode).toHaveBeenCalledWith(
        'farm-1',
        '2000',
      );
      const [input] = journalService.postJournal.mock.calls[0] as [
        {
          entries: {
            ledgerAccountId: string;
            debit?: unknown;
            credit?: unknown;
          }[];
        },
      ];
      expect(input.entries[0]).toMatchObject({ ledgerAccountId: 'ledger-ap' });
      expect(input.entries[0].debit).toBeDefined();
      expect(input.entries[1]).toMatchObject({
        ledgerAccountId: 'ledger-fa-1',
      });
      expect(input.entries[1].credit).toBeDefined();
    });

    it('rejects a zero/negative amount before touching the DB', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'fa-1',
        ledgerAccountId: 'ledger-fa-1',
      });
      const service = make();

      await expect(
        service.recordPayment('farm-1', 'user-1', { ...baseDto, amount: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.financePayment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the financial account does not resolve for this farm', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);
      const service = make();

      await expect(
        service.recordPayment('farm-1', 'user-1', baseDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates assertAccountActive rejecting an archived account', async () => {
      financialAccountService.assertAccountActive.mockRejectedValue(
        new BadRequestException('archived'),
      );
      const service = make();

      await expect(
        service.recordPayment('farm-1', 'user-1', baseDto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.financePayment.create).not.toHaveBeenCalled();
    });
  });

  describe('allocatePayment', () => {
    it('creates allocation rows when the total stays within the payment amount', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      prisma.paymentAllocation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
      );
      const service = make();

      const result = await service.allocatePayment('farm-1', 'pay-1', [
        { receivableId: 'rec-1', amount: 6000 },
      ]);

      expect(result).toHaveLength(1);
      const createArgs = (
        prisma.paymentAllocation.create.mock.calls as unknown[][]
      )[0][0] as {
        data: {
          paymentId: string;
          receivableId: string | null;
          payableId: string | null;
        };
      };
      expect(createArgs.data).toMatchObject({
        paymentId: 'pay-1',
        receivableId: 'rec-1',
        payableId: null,
      });
    });

    it('rejects a line that sets neither receivableId nor payableId', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [{ amount: 100 }]),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it('rejects a line that sets both receivableId and payableId', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { receivableId: 'rec-1', payableId: 'pay-x', amount: 100 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects over-allocation against existing allocations', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [{ id: 'a1', amount: 6000 }],
      });
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { receivableId: 'rec-1', amount: 5000 },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it('rejects over-allocation within a single call', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 1000,
        allocations: [],
      });
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { receivableId: 'rec-1', amount: 700 },
          { receivableId: 'rec-2', amount: 700 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows allocation total to exactly equal the payment amount', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 1000,
        allocations: [],
      });
      prisma.paymentAllocation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
      );
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { receivableId: 'rec-1', amount: 1000 },
        ]),
      ).resolves.toHaveLength(1);
    });

    it('throws NotFoundException for a cross-farm/unknown payment id', async () => {
      prisma.financePayment.findFirst.mockResolvedValue(null);
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'nope', [
          { receivableId: 'rec-1', amount: 100 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    // RAKHAL-340: cross-payment receivable-outstanding guard.
    it('rejects when ReceivableService.assertWithinOutstanding rejects, before creating the row', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      receivableService.assertWithinOutstanding.mockRejectedValueOnce(
        new BadRequestException('over receivable outstanding'),
      );
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { receivableId: 'rec-1', amount: 4000 },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(receivableService.assertWithinOutstanding).toHaveBeenCalledWith(
        'farm-1',
        'rec-1',
        expect.anything(),
        prisma,
      );
      expect(prisma.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it('calls closeIfSettled after creating a receivable-targeted allocation, and skips the payable-side one for it', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      prisma.paymentAllocation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
      );
      const service = make();

      await service.allocatePayment('farm-1', 'pay-1', [
        { receivableId: 'rec-1', amount: 4000 },
      ]);
      expect(receivableService.closeIfSettled).toHaveBeenCalledWith(
        'farm-1',
        'rec-1',
        prisma,
      );
      expect(payableService.closeIfSettled).not.toHaveBeenCalled();
    });

    // RAKHAL-349: cross-payment payable-outstanding guard — mirrors the
    // RAKHAL-340 receivable-side cases above exactly.
    it('rejects when PayableService.assertWithinOutstanding rejects, before creating the row', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      payableService.assertWithinOutstanding.mockRejectedValueOnce(
        new BadRequestException('over payable outstanding'),
      );
      const service = make();

      await expect(
        service.allocatePayment('farm-1', 'pay-1', [
          { payableId: 'pay-x', amount: 4000 },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(payableService.assertWithinOutstanding).toHaveBeenCalledWith(
        'farm-1',
        'pay-x',
        expect.anything(),
        prisma,
      );
      expect(prisma.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it('calls closeIfSettled after creating a payable-targeted allocation, and skips the receivable-side one for it', async () => {
      prisma.financePayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        farmId: 'farm-1',
        amount: 10000,
        allocations: [],
      });
      prisma.paymentAllocation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'alloc-1', ...data }),
      );
      const service = make();

      await service.allocatePayment('farm-1', 'pay-1', [
        { payableId: 'pay-x', amount: 1000 },
      ]);
      expect(payableService.closeIfSettled).toHaveBeenCalledWith(
        'farm-1',
        'pay-x',
        prisma,
      );
      expect(receivableService.closeIfSettled).not.toHaveBeenCalled();
    });
  });
});
