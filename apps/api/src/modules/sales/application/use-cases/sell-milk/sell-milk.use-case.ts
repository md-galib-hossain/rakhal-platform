import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityLogModule,
  FinancePayment,
  MilkTankActivity,
  MilkTankType,
  PaymentDirection,
  Prisma,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt } from 'src/common/money';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { MilkAvailabilityService } from 'src/modules/milk/application/services/milk-availability.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SaleService } from '../../sale.service';
import { deriveSaleDueDate } from '../../../domain/due-date';
import { SellMilkInput, SellMilkResult } from './sell-milk.types';

/** `LedgerAccount.code` for "Accounts Receivable" — seeded per farm by
 * RAKHAL-333's default chart. Matches `PaymentService`'s own constant of the
 * same value (`payment.service.ts`), duplicated rather than imported since
 * neither module exports its ledger-code constants today. */
const ACCOUNTS_RECEIVABLE_CODE = '1100';

/** `LedgerAccount.code` for "Milk Sales" revenue. */
const MILK_SALES_REVENUE_CODE = '4000';

/**
 * `SellMilk` use case (RAKHAL-342, Finance V2 — `FINANCE_V2_DESIGN.md` §1.2,
 * §4.3). The exact defect this ticket exists to fix: `BuyerService.
 * recordDispatch` used to decrement the milk tank atomically but post to
 * Finance in a best-effort `try/catch` *after* that transaction committed —
 * so a Finance hiccup left milk gone from the tank with no ledger entry
 * anywhere (`FINANCE_V2_DESIGN.md` §1.2). This use case is the single atomic
 * replacement: **one** `$transaction` covering
 *
 *   Sale + SaleLine(MILK) + MilkSaleLine
 *     -> MilkTank decrement (+ audit log carrying the SaleLine id)
 *     -> journal posting (Dr Accounts Receivable, Cr Milk Sales Revenue)
 *     -> Receivable
 *     -> optional Payment + PaymentAllocation (money received at sale time)
 *
 * Any failure at any step rolls back every step — no Sale, no tank change,
 * no Receivable, no Payment, no JournalTransaction survives a rejected call.
 *
 * Milk availability + concurrency: **RAKHAL-343**. The fullest active
 * SELLABLE tank is still selected the same way (same strategy `BuyerService`'s
 * old private `sellFromTank` used), but before `MilkTankService.adjustVolume`
 * runs, `MilkAvailabilityService.lockAndValidate` takes a Postgres row lock
 * (`SELECT ... FOR UPDATE`) on that exact tank row, inside this same
 * transaction, and re-checks the volume under the lock — closing the race a
 * plain read-then-write can't: two concurrent sales against the same tank no
 * longer both pass a stale availability check and one silently clobber the
 * other's decrement (a lost update). The second transaction blocks on the
 * lock until the first commits or rolls back, then sees the true
 * post-decrement volume and fails cleanly if it's now insufficient.
 */
@Injectable()
export class SellMilkUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleService: SaleService,
    private readonly milkTankService: MilkTankService,
    private readonly milkAvailabilityService: MilkAvailabilityService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly receivableService: ReceivableService,
    private readonly paymentService: PaymentService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SellMilkUseCase.name);
  }

  async execute(
    farmId: string,
    userId: string,
    input: SellMilkInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SellMilkResult> {
    const run = (client: Prisma.TransactionClient) =>
      this.executeWithClient(client, farmId, userId, input);
    const result = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    // RAKHAL-353: Finance V2 wrote no ActivityLog until this ticket
    // (`FINANCE_V2_DESIGN.md` §1.4 — "ActivityLogModule.FINANCE exists and is
    // never used"). Deliberately called here, after the transaction has
    // resolved — `ActivityLogService.record` opens its own `$transaction`
    // for the hash chain (a separate connection), so calling it from inside
    // `executeWithClient`'s still-open transaction would let the log entry
    // commit independently before the sale itself does. When a caller
    // supplies its own `tx` (none does today), this still logs slightly
    // ahead of that outer commit — an accepted limitation shared by every
    // other `ActivityLogService.record(...)` call site in this codebase,
    // since the service has no seam to join a caller's transaction.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Milk Sale Recorded',
      actionDetails: `Sale ${result.sale.saleNumber}: ${input.volumeL}L milk sold for ৳${result.sale.totalAmount.toString()}${(input.amountReceived ?? 0) > 0 ? `, ৳${input.amountReceived} received` : ''}.`,
      actorId: userId,
      financialImpact: Number(result.sale.totalAmount),
    });

    return result;
  }

  private async executeWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    input: SellMilkInput,
  ): Promise<SellMilkResult> {
    if (!(input.volumeL > 0)) {
      throw new BadRequestException(
        'Milk sale volume must be greater than zero',
      );
    }
    if (input.pricePerLitre < 0) {
      throw new BadRequestException(
        'Milk sale price per litre cannot be negative',
      );
    }
    const amountReceived = input.amountReceived ?? 0;
    if (amountReceived > 0) {
      if (!input.financialAccountId) {
        throw new BadRequestException(
          'financialAccountId is required when amountReceived is greater than zero',
        );
      }
      if (!input.paymentMethod) {
        throw new BadRequestException(
          'paymentMethod is required when amountReceived is greater than zero',
        );
      }
    }

    const saleDate = input.saleDate ?? new Date().toISOString();

    // 1. Sale + SaleLine(MILK) + MilkSaleLine — quantity=volumeL,
    // unitPrice=pricePerLitre, totalAmount computed by SaleService the same
    // way every sale line's total is (never trusts a caller-supplied total).
    const sale = await this.saleService.createSale(
      farmId,
      userId,
      {
        customerId: input.customerId ?? undefined,
        saleDate,
        notes: input.notes,
        lines: [
          {
            type: SaleLineType.MILK,
            description: input.description ?? 'Milk sale',
            quantity: input.volumeL,
            unitPrice: input.pricePerLitre,
          },
        ],
      },
      client,
    );
    const saleLine = sale.lines[0];

    // 2. Milk tank decrement — no-op (false) if the farm has no active
    // SELLABLE tank configured; a real shortfall throws from
    // `adjustVolume`'s own negative-balance guard, rolling back everything
    // above via the shared transaction client.
    const tankUpdated = await this.decrementSellableTank(
      client,
      farmId,
      userId,
      input.volumeL,
      saleLine.id,
      sale.saleNumber,
    );

    // 3. Revenue recognition: Dr Accounts Receivable, Cr Milk Sales Revenue
    // — the "Sale posted" half of `FINANCE_V2_DESIGN.md` §4.5's worked
    // accrual example. Booked unconditionally, even for a sale paid in full
    // at creation — the payment leg below settles it back down to zero via
    // its own journal posting, never by skipping this one.
    const [arAccount, revenueAccount] = await Promise.all([
      this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
      this.ledgerAccountService.findByCode(farmId, MILK_SALES_REVENUE_CODE),
    ]);
    if (!arAccount || !revenueAccount) {
      // Should never happen for a farm bootstrapped via FarmService.create
      // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
      throw new BadRequestException(
        'Accounts Receivable / Milk Sales ledger accounts are not seeded for this farm',
      );
    }
    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'SALE',
        sourceId: sale.id,
        transactionDate: sale.saleDate,
        description: `Milk sale ${sale.saleNumber}`,
        idempotencyKey: `sale:${sale.id}`,
        createdById: userId,
        entries: [
          { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
          { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
        ],
      },
      client,
    );

    // 4. Receivable — always created, mirroring the design doc's worked
    // example; a same-call Payment (below) settles it immediately if the
    // caller supplied `amountReceived`. RAKHAL-364: `dueDate` defaults to
    // `saleDate + MilkBuyer.paymentTermsDays` when the caller doesn't pass
    // one explicitly and the sale has a customer; `customerId` is passed
    // straight through from the just-created `sale` row so
    // `Receivable.customerId === Sale.customerId` always holds.
    const dueDate = input.dueDate ?? (await this.deriveDueDate(client, sale));
    const receivable = await this.receivableService.createReceivable(
      farmId,
      sale.id,
      sale.totalAmount,
      dueDate,
      client,
      sale.customerId,
    );

    // 5. Optional Payment + PaymentAllocation. `ReceivableService.
    // assertWithinOutstanding` (called inside `allocatePayment`) rejects an
    // `amountReceived` greater than the sale total — that rejection rolls
    // back this entire transaction (Sale, tank decrement, journal,
    // Receivable included), which is also this ticket's proof that a
    // mid-flow failure leaves nothing behind.
    let payment: FinancePayment | null = null;
    if (amountReceived > 0 && gt(amountReceived, 0)) {
      payment = await this.paymentService.recordPayment(
        farmId,
        userId,
        {
          direction: PaymentDirection.INCOMING,
          financialAccountId: input.financialAccountId!,
          amount: amountReceived,
          method: input.paymentMethod!,
          transactionDate: saleDate,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
        },
        client,
      );
      await this.paymentService.allocatePayment(
        farmId,
        payment.id,
        [{ receivableId: receivable.id, amount: amountReceived }],
        client,
      );
    }

    // 6. Confirm the sale — the atomic stock/ledger side effects a DRAFT
    // sale is missing (per `SaleStatus`'s own doc comment) have now run.
    await client.sale.update({
      where: { id: sale.id },
      data: { status: SaleStatus.CONFIRMED },
    });

    this.log.info('Milk sale completed', {
      farmId,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      volumeL: input.volumeL,
      totalAmount: sale.totalAmount.toString(),
      amountReceived,
      tankUpdated,
    });

    return {
      sale: { ...sale, status: SaleStatus.CONFIRMED },
      receivable,
      payment,
      tankUpdated,
    };
  }

  /** Sells from the fullest active SELLABLE tank — same selection strategy
   * `BuyerService`'s old private `sellFromTank` used, so a dispatch draws
   * from where the milk actually is. Returns `false` (no-op) if the farm
   * has no active SELLABLE tank configured. */
  private async decrementSellableTank(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    volumeL: number,
    saleLineId: string,
    saleNumber: string,
  ): Promise<boolean> {
    const tank = await client.milkTank.findFirst({
      where: { farmId, tankType: MilkTankType.SELLABLE, isActive: true },
      orderBy: { currentVolumeL: 'desc' },
    });
    if (!tank) return false;

    // RAKHAL-343: row-lock + re-validate under that lock, in the same tx,
    // before the decrement runs — see this class's own doc comment.
    await this.milkAvailabilityService.lockAndValidate(
      farmId,
      tank.id,
      volumeL,
      client,
    );

    await this.milkTankService.adjustVolume(
      farmId,
      userId,
      tank.id,
      {
        delta: -volumeL,
        activityType: MilkTankActivity.SALE,
        source: 'milk_sale',
        notes: `Sale ${saleNumber}`,
        saleLineId,
      },
      client,
    );
    return true;
  }

  /**
   * RAKHAL-364 — `saleDate + MilkBuyer.paymentTermsDays` when the sale has
   * a customer; `null` (no due date) when it doesn't, mirroring the
   * "PAID/no-schedule" reading `due-date.ts`'s own doc comment describes.
   * One extra read on `client` (the schema-level `MilkBuyer` FK, no
   * `BuyerModule` import — same precedent `SaleService.
   * assertCustomerBelongsToFarm` uses).
   */
  private async deriveDueDate(
    client: Prisma.TransactionClient,
    sale: { saleDate: Date; customerId: string | null },
  ): Promise<Date | null> {
    if (!sale.customerId) return null;
    const buyer = await client.milkBuyer.findUnique({
      where: { id: sale.customerId },
      select: { paymentTermsDays: true },
    });
    return deriveSaleDueDate(sale.saleDate, buyer?.paymentTermsDays);
  }
}
