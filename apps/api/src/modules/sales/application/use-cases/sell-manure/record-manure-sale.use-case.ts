import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityLogModule,
  PaymentDirection,
  PaymentMethod,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, toMoney } from 'src/common/money';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SaleService, SaleWithLines } from '../../sale.service';
import { CreateSaleDto } from '../../../presentation/dto/create-sale.dto';
import { RecordManureSaleInput } from './record-manure-sale.input';

/** `LedgerAccount.code` for "Accounts Receivable" — matches
 * `SellInventoryUseCase`'s own constant of the same value (RAKHAL-346). */
const ACCOUNTS_RECEIVABLE_CODE = '1100';

/** `LedgerAccount.code` for "Manure Sales" revenue — seeded per farm by
 * RAKHAL-333's default chart of accounts. */
const MANURE_SALES_REVENUE_CODE = '4200';

export interface RecordManureSaleResult {
  sale: SaleWithLines;
  receivableId: string;
  paymentId: string | null;
}

/**
 * `RecordManureSale` use case (RAKHAL-347, Sales module — `FINANCE_V2_DESIGN.md`
 * §2.1, §4.3, Phase 4-8; repays part of RD-058's own note). **Revenue-first**: a
 * manure sale is a real `Sale` with real `Receivable`/`Payment`/journal postings —
 * exactly like `SellMilk`/`SellAnimal`/`SellInventoryItem` — but, unlike those three,
 * it never validates or decrements any stock, because no manure production/stock
 * model exists (RD-058, deliberately deferred). If a future change is tempted to add
 * a stock check here, it belongs in RD-058's own ticket instead, not this one.
 *
 * One `$transaction` covers every step, mirroring `SaleService.createSale`'s own
 * `tx ?? this.prisma.$transaction(...)` seam (RAKHAL-341's unit-of-work pattern):
 *
 *   1. `SaleService.createSale` — one `SaleLine` (`type: MANURE`) + its
 *      `ManureSaleLine` marker row. `quantity` defaults to `1` when the caller omits
 *      it (the `SaleLine.quantity` column is `NOT NULL` — RAKHAL-339's schema, see
 *      `sale-line.prisma`'s own doc comment: "optional in spirit", not literally
 *      nullable) and `unitPrice` is derived from `totalAmount / quantity` (Decimal
 *      division, `src/common/money`) so `quantity × unitPrice` round-trips back to
 *      exactly `totalAmount` — the caller-supplied quantity is stored for record
 *      only, never validated against anything (RD-058).
 *   2. `ReceivableService.createReceivable` — always raised for the full sale total,
 *      even when `amountReceived` covers it in full; `PaymentService.allocatePayment`
 *      (step 3) then settles it in the same transaction, so a fully-paid manure sale
 *      still ends with a `PAID` receivable (status is derived from allocations, never
 *      chosen — `FINANCE_V2_DESIGN.md` §4.6), never a bypassed one.
 *   3. `PaymentService.recordPayment` + `allocatePayment` — only when
 *      `amountReceived > 0`. `financialAccountId` becomes required at that point
 *      (enforced here, not by the interface, since it's conditionally required).
 *
 * A failure at any step (bad account, over-allocation, etc.) rolls back the whole
 * transaction — no orphaned `Sale`/`Receivable` row, matching every other Finance V2
 * use case's atomicity guarantee.
 */
@Injectable()
export class RecordManureSaleUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleService: SaleService,
    private readonly receivableService: ReceivableService,
    private readonly paymentService: PaymentService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(RecordManureSaleUseCase.name);
  }

  async execute(
    farmId: string,
    userId: string,
    dto: RecordManureSaleInput,
  ): Promise<RecordManureSaleResult> {
    if (!gt(dto.totalAmount, 0)) {
      throw new BadRequestException('totalAmount must be greater than zero');
    }
    if (dto.quantity !== undefined && !gt(dto.quantity, 0)) {
      throw new BadRequestException(
        'quantity, when provided, must be greater than zero',
      );
    }

    const wantsPayment =
      dto.amountReceived !== undefined && gt(dto.amountReceived, 0);
    if (wantsPayment) {
      if (!dto.financialAccountId) {
        throw new BadRequestException(
          'financialAccountId is required when amountReceived is greater than zero',
        );
      }
      if (gt(dto.amountReceived as number, dto.totalAmount)) {
        throw new BadRequestException(
          'amountReceived cannot exceed totalAmount',
        );
      }
    }

    const quantity = dto.quantity ?? 1;
    const unitPrice = dto.quantity
      ? toMoney(dto.totalAmount).dividedBy(quantity).toNumber()
      : dto.totalAmount;

    const result = await this.prisma.$transaction(async (tx) => {
      const saleDto = {
        saleDate: dto.saleDate,
        notes: dto.notes,
        lines: [
          {
            type: SaleLineType.MANURE,
            description: dto.notes?.trim() || 'Manure sale',
            quantity,
            unitId: dto.unitId,
            unitPrice,
            manureNotes: dto.notes,
          },
        ],
      } as unknown as CreateSaleDto;

      const sale = await this.saleService.createSale(
        farmId,
        userId,
        saleDto,
        tx,
      );

      // Revenue recognition: Dr Accounts Receivable, Cr Manure Sales Revenue
      // — same journal leg `SellInventoryUseCase` posts for its sale type.
      const [arAccount, revenueAccount] = await Promise.all([
        this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
        this.ledgerAccountService.findByCode(farmId, MANURE_SALES_REVENUE_CODE),
      ]);
      if (!arAccount || !revenueAccount) {
        // Should never happen for a farm bootstrapped via FarmService.create
        // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
        throw new BadRequestException(
          'Accounts Receivable / Manure Sales ledger accounts are not seeded for this farm',
        );
      }
      await this.journalService.postJournal(
        {
          farmId,
          sourceType: 'SALE',
          sourceId: sale.id,
          transactionDate: sale.saleDate,
          description: `Manure sale ${sale.saleNumber}`,
          idempotencyKey: `sale:${sale.id}`,
          createdById: userId,
          entries: [
            { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
            { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
          ],
        },
        tx,
      );

      // RAKHAL-364: no `customerId` input exists on this use case yet
      // (RD-058 — manure has no buyer concept) — `sale.customerId` is
      // always `null` here, passed through anyway for call-site uniformity.
      const receivable = await this.receivableService.createReceivable(
        farmId,
        sale.id,
        sale.totalAmount,
        null,
        tx,
        sale.customerId,
      );

      let paymentId: string | null = null;
      if (wantsPayment) {
        const payment = await this.paymentService.recordPayment(
          farmId,
          userId,
          {
            direction: PaymentDirection.INCOMING,
            financialAccountId: dto.financialAccountId as string,
            amount: dto.amountReceived as number,
            method: dto.paymentMethod ?? PaymentMethod.CASH,
            transactionDate: dto.saleDate,
          },
          tx,
        );
        paymentId = payment.id;

        await this.paymentService.allocatePayment(
          farmId,
          payment.id,
          [
            {
              receivableId: receivable.id,
              amount: dto.amountReceived as number,
            },
          ],
          tx,
        );
      }

      // Confirm the sale — the atomic Receivable/Payment side effects a
      // DRAFT sale is missing (per `SaleStatus`'s own doc comment) have now
      // run. Mirrors `SellMilkUseCase`/`SellInventoryUseCase`/`SellAnimalUseCase`'s
      // own final step; this use case previously left `Sale.status` at
      // `DRAFT` forever despite the sale being fully committed —
      // RAKHAL-352's cattle-finance-aggregation had to filter on "not
      // CANCELLED" instead of "CONFIRMED" specifically because of this gap.
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.CONFIRMED },
      });

      this.log.info('Manure sale recorded', {
        farmId,
        saleId: sale.id,
        receivableId: receivable.id,
        paymentId,
        totalAmount: sale.totalAmount.toString(),
        hadQuantity: dto.quantity !== undefined,
      });

      return {
        sale: { ...sale, status: SaleStatus.CONFIRMED },
        receivableId: receivable.id,
        paymentId,
      };
    });

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Manure Sale Recorded',
      actionDetails: `Sale ${result.sale.saleNumber}: manure sold for ৳${result.sale.totalAmount.toString()}${result.paymentId ? `, ৳${dto.amountReceived} received` : ''}.`,
      actorId: userId,
      financialImpact: Number(result.sale.totalAmount),
    });

    return result;
  }
}
