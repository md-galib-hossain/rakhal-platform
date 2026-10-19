import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattleDispositionType,
  PaymentDirection,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, toStorage } from 'src/common/money';
import { CattleService } from 'src/modules/cattle/application/services/cattle.service';
import { SaleService } from 'src/modules/sales/application/sale.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { deriveSaleDueDate } from 'src/modules/sales/domain/due-date';
import { SellAnimalInput, SellAnimalResult } from './sell-animal.types';

/** `LedgerAccount.code` for "Accounts Receivable" — RAKHAL-333's seeded default
 * chart, same constant `PaymentService` uses for the same account. */
const ACCOUNTS_RECEIVABLE_CODE = '1100';

/** `LedgerAccount.code` for "Animal Sales" revenue — RAKHAL-333's seeded
 * default chart (`default-chart-of-accounts.ts`). */
const ANIMAL_SALES_REVENUE_CODE = '4100';

/**
 * `SellAnimal` use case (RAKHAL-345, Sales — `FINANCE_V2_DESIGN.md` §1.1,
 * §4.2, §4.3). This is the real replacement for the three divergent
 * "flip a cow to SOLD" paths the design doc documents in §1.1 — specifically
 * it is what switches the actual sell-animal flow onto `CattleService.
 * recordDisposition` (RAKHAL-344) and is the reason `finance.service.ts`'s
 * old inline cattle mutation (`:164-182`) can finally be deleted (this same
 * ticket does that deletion — see `finance.service.ts`'s own comment at that
 * spot).
 *
 * One `prisma.$transaction` covers every step: `Sale`+`AnimalSaleLine`
 * (RAKHAL-339) → `CattleDisposition` + `Cattle.status = SOLD` + lactation
 * close (RAKHAL-344) → `Receivable` (RAKHAL-340) → a balanced revenue-
 * recognition journal posting (Debit Accounts Receivable, Credit Animal
 * Sales — the exact worked example `FINANCE_V2_DESIGN.md` §4.5 uses) →
 * an optional `Payment` + allocation if money was collected at sale time
 * (RAKHAL-337). Any failure anywhere — an invalid `financialAccountId`, an
 * already-sold animal, a chart-of-accounts gap — rolls every one of those
 * writes back together; nothing is reachable half-done.
 *
 * **"Already sold" is checked exactly once**, inside `CattleService.
 * recordDisposition` itself (this use case does not duplicate that guard —
 * per the ticket's own instruction, `recordDisposition` is the single
 * source of truth for that invariant). Because the whole call runs inside
 * this use case's own transaction, a `ConflictException` thrown there rolls
 * back the `Sale` this use case just created a moment earlier.
 */
@Injectable()
export class SellAnimalUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cattleService: CattleService,
    private readonly saleService: SaleService,
    private readonly receivableService: ReceivableService,
    private readonly paymentService: PaymentService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SellAnimalUseCase.name);
  }

  async execute(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: SellAnimalInput,
  ): Promise<SellAnimalResult> {
    const salePrice = toStorage(dto.salePrice);
    if (!gt(salePrice, 0)) {
      throw new BadRequestException('salePrice must be greater than zero');
    }

    const hasAmountReceived =
      dto.amountReceived !== undefined && dto.amountReceived !== null;
    const amountReceived = hasAmountReceived
      ? toStorage(dto.amountReceived!)
      : null;
    if (amountReceived && gt(amountReceived, salePrice)) {
      throw new BadRequestException('amountReceived cannot exceed salePrice');
    }
    const collectsPaymentNow = !!amountReceived && gt(amountReceived, 0);
    if (collectsPaymentNow && !dto.paymentMethod) {
      throw new BadRequestException(
        'paymentMethod is required when amountReceived is greater than zero',
      );
    }

    let soldTagNumber = '';
    const result = await this.prisma.$transaction(async (tx) => {
      const cattle = await tx.cattle.findFirst({
        where: { id: cattleId, farmId },
        select: { id: true, tagNumber: true },
      });
      if (!cattle) {
        throw new NotFoundException('Cattle not found');
      }
      soldTagNumber = cattle.tagNumber;

      // 1. Sale + AnimalSaleLine (RAKHAL-339) — server-computed total, one
      // line, quantity 1 x unitPrice(salePrice).
      const sale = await this.saleService.createSale(
        farmId,
        userId,
        {
          // RAKHAL-364: `customerId` is now a real `MilkBuyer` FK — a
          // free-text `buyerName` can no longer be passed as the FK value
          // (it would violate the constraint / fail the tenancy assert).
          // `buyerName` stays on the input for display-only use by a future
          // caller; it is never written to `Sale.customerId`.
          customerId: dto.buyerId ?? undefined,
          saleDate: dto.saleDate,
          lines: [
            {
              type: SaleLineType.ANIMAL,
              description: `Sale of animal ${cattle.tagNumber}`,
              quantity: 1,
              unitPrice: dto.salePrice,
              cattleId,
            },
          ],
        },
        tx,
      );

      // 2. CattleDisposition -> Cattle.status = SOLD -> closes the ACTIVE
      // lactation (RAKHAL-344). Single source of truth for the "cannot sell
      // twice" invariant — see this class's own doc comment above.
      const disposition = await this.cattleService.recordDisposition(
        farmId,
        userId,
        cattleId,
        {
          type: CattleDispositionType.SALE,
          saleId: sale.id,
          date: new Date(dto.saleDate),
          price: sale.totalAmount,
        },
        tx,
      );

      // 3. Receivable for the full sale total (RAKHAL-340) — outstanding is
      // reduced below only if money is collected now. RAKHAL-364: due date
      // defaults from the buyer's payment terms when the sale has one;
      // `customerId` passes straight through from `sale` so
      // `Receivable.customerId === Sale.customerId` always holds.
      const dueDate = sale.customerId
        ? deriveSaleDueDate(
            sale.saleDate,
            (
              await tx.milkBuyer.findUnique({
                where: { id: sale.customerId },
                select: { paymentTermsDays: true },
              })
            )?.paymentTermsDays,
          )
        : null;
      const receivable = await this.receivableService.createReceivable(
        farmId,
        sale.id,
        sale.totalAmount,
        dueDate,
        tx,
        sale.customerId,
      );

      // 4. Revenue-recognition journal posting — Debit Accounts Receivable,
      // Credit Animal Sales, `FINANCE_V2_DESIGN.md` §4.5's own worked
      // example. No prior ticket posts this (RAKHAL-339/340 explicitly defer
      // it), so this use case is the first real journal entry a sale
      // produces.
      const [arAccount, revenueAccount] = await Promise.all([
        this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
        this.ledgerAccountService.findByCode(farmId, ANIMAL_SALES_REVENUE_CODE),
      ]);
      if (!arAccount || !revenueAccount) {
        // Should never happen for a farm bootstrapped via FarmService.create
        // (RAKHAL-333 seeds this chart) — defensive, not expected in practice.
        throw new BadRequestException(
          'Chart of accounts is not seeded for this farm (Accounts Receivable / Animal Sales)',
        );
      }
      const journal = await this.journalService.postJournal(
        {
          farmId,
          sourceType: 'SALE',
          sourceId: sale.id,
          transactionDate: sale.saleDate,
          description: `Animal sale ${sale.saleNumber}`,
          idempotencyKey: `sale:${sale.id}`,
          createdById: userId,
          entries: [
            { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
            { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
          ],
        },
        tx,
      );

      // 5. Optional payment collected at sale time (RAKHAL-337) — settles
      // the receivable by exactly `amountReceived`.
      let paymentId: string | null = null;
      if (collectsPaymentNow) {
        const payment = await this.paymentService.recordPayment(
          farmId,
          userId,
          {
            direction: PaymentDirection.INCOMING,
            financialAccountId: dto.financialAccountId,
            amount: dto.amountReceived!,
            method: dto.paymentMethod!,
            transactionDate: dto.saleDate,
            notes: `Payment for sale ${sale.saleNumber}`,
          },
          tx,
        );
        await this.paymentService.allocatePayment(
          farmId,
          payment.id,
          [{ receivableId: receivable.id, amount: dto.amountReceived! }],
          tx,
        );
        paymentId = payment.id;
      }

      // 6. Confirm the sale — the atomic disposition/ledger side effects a
      // DRAFT sale is missing (per `SaleStatus`'s own doc comment) have now
      // run. Mirrors `SellMilkUseCase`/`SellInventoryUseCase`'s own final
      // step; this use case previously left `Sale.status` at `DRAFT`
      // forever despite the sale being fully committed — RAKHAL-352's
      // cattle-finance-aggregation had to filter on "not CANCELLED" instead
      // of "CONFIRMED" specifically because of this gap.
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.CONFIRMED },
      });

      this.log.info('Animal sold', {
        farmId,
        cattleId,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        dispositionId: disposition.id,
        receivableId: receivable.id,
        paymentId,
      });

      return {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        totalAmount: sale.totalAmount.toString(),
        dispositionId: disposition.id,
        receivableId: receivable.id,
        paymentId,
        journalTransactionId: journal.id,
      };
    });

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves, carrying
    // `relatedCattleId` since this is exactly the per-animal financial event
    // the design doc's §1.1 defect ("Finance mutates the herd") should have
    // always produced a durable, farm-visible record of.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Animal Sold',
      actionDetails: `Sale ${result.saleNumber}: animal ${soldTagNumber} sold for ৳${result.totalAmount}${result.paymentId ? `, ৳${dto.amountReceived} received` : ''}.`,
      actorId: userId,
      relatedCattleId: cattleId,
      financialImpact: Number(result.totalAmount),
    });

    return result;
  }
}
