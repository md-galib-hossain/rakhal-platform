import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityLogModule,
  FinancePayment,
  PaymentDirection,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt } from 'src/common/money';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PayableService, PayableWithDerived } from '../../payable.service';
import { PaySupplierInput } from './pay-supplier.input';

export interface PaySupplierResult {
  payment: FinancePayment;
  payable: PayableWithDerived;
}

/**
 * `PaySupplier` use case (RAKHAL-349, Purchasing —
 * `FINANCE_V2_DESIGN.md` §1.4). Closes the payable-side gap
 * `PayableService`'s own doc comment documented after RAKHAL-348 landed:
 * `PayableService.assertWithinOutstanding`/`closeIfSettled` existed and
 * were "ready for `PaymentService.allocatePayment` to call" but nothing
 * called them yet, so a `payableId` allocation was only bounded by its own
 * payment's `amount`, not the payable's real outstanding balance across
 * several payments. RAKHAL-349 wires that call into `PaymentService.
 * allocatePayment` directly (mirroring the `receivableId` guard
 * RAKHAL-340 already wired in) — this use case is the supplier-facing
 * entry point that exercises the now-fixed guard end to end.
 *
 * One `$transaction` covers both steps, mirroring every other Finance V2
 * use case's atomicity guarantee (RAKHAL-341's unit-of-work seam):
 *
 *   1. `PaymentService.recordPayment` — an OUTGOING `FinancePayment` against
 *      the given `FinancialAccount`, posting Dr Accounts Payable /
 *      Cr the account.
 *   2. `PaymentService.allocatePayment` — one allocation line against
 *      `dto.payableId`. `allocatePayment` itself now calls `PayableService.
 *      assertWithinOutstanding` before writing the row and `closeIfSettled`
 *      after — over-allocating the payable (across this payment and any
 *      prior ones) rolls the whole transaction back with **no** `Payment`
 *      or `PaymentAllocation` row created, exactly the guarantee the
 *      receivable side already has.
 *
 * The payable itself must belong to this farm — checked up front via
 * `PayableService.findOne` so a foreign-farm/unknown id fails fast with a
 * clear 404 before any write, rather than surfacing as an opaque guard
 * failure deeper in `allocatePayment`.
 */
@Injectable()
export class PaySupplierUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly payableService: PayableService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PaySupplierUseCase.name);
  }

  async execute(
    farmId: string,
    userId: string,
    dto: PaySupplierInput,
  ): Promise<PaySupplierResult> {
    if (!gt(dto.amount, 0)) {
      throw new BadRequestException('amount must be greater than zero');
    }

    // `findOne` throws `NotFoundException` for a foreign-farm/unknown id —
    // fail fast, before opening the transaction, with the same clear 404
    // every other Finance V2 read route gives.
    await this.payableService.findOne(farmId, dto.payableId);

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await this.paymentService.recordPayment(
        farmId,
        userId,
        {
          direction: PaymentDirection.OUTGOING,
          financialAccountId: dto.financialAccountId,
          amount: dto.amount,
          method: dto.method,
          transactionDate: dto.transactionDate,
          referenceNumber: dto.referenceNumber,
        },
        tx,
      );

      // Over-allocation is rejected here — `allocatePayment` now calls
      // `PayableService.assertWithinOutstanding` for `payableId` lines
      // (RAKHAL-349's own fix) — the whole `$transaction` rolls back with
      // no `Payment`/`PaymentAllocation` row surviving.
      await this.paymentService.allocatePayment(
        farmId,
        payment.id,
        [{ payableId: dto.payableId, amount: dto.amount }],
        tx,
      );

      // Re-derived on `tx`, not `findOne` (which reads via the outer
      // `PrismaService` connection and would race the still-uncommitted
      // write above) — `getStatus`/`getOutstanding` both accept an
      // optional transaction client for exactly this reason.
      const payableRow = await tx.payable.findFirstOrThrow({
        where: { id: dto.payableId, farmId },
      });
      const outstanding = await this.payableService.getOutstanding(
        farmId,
        dto.payableId,
        tx,
      );
      const status = await this.payableService.getStatus(
        farmId,
        dto.payableId,
        tx,
      );
      const payable: PayableWithDerived = {
        ...payableRow,
        outstanding: outstanding.toString(),
        status,
      };

      this.log.info('Supplier payment recorded', {
        farmId,
        payableId: dto.payableId,
        paymentId: payment.id,
        amount: dto.amount,
        payableStatus: payable.status,
      });

      return { payment, payable };
    });

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves. This is the
    // higher-level supplier-payment event; the nested `PaymentService.
    // recordPayment`/`allocatePayment` calls above don't log themselves
    // (they were called with `tx`), so this is the only log entry this
    // operation produces — no double-logging.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Supplier Payment Recorded',
      actionDetails: `Paid ৳${dto.amount} against payable ${dto.payableId} via ${dto.method}. Status now ${result.payable.status}.`,
      actorId: userId,
      financialImpact: Number(dto.amount),
    });

    return result;
  }
}
