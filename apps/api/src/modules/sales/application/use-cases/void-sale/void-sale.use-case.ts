import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogModule, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { CattleService } from 'src/modules/cattle/application/services/cattle.service';
import { SaleService, SaleWithLines } from '../../sale.service';

/**
 * `VoidSale` (RAKHAL-377, MILESTONE 22, `BUSINESS_IA_PRD.md` §9.4, §16.2).
 * **The only correction mechanism for a `Sale`** — `JournalTransaction`
 * immutability (RAKHAL-334 AC 3) means there is no `PATCH` that changes
 * money; a mistaken sale is void + re-record, never edited in place.
 *
 * Two entry points, both gated `finance.reverse` at the controller:
 *
 * - `cancelSale` — a sale with **no** `PaymentAllocation` on its
 *   `Receivable`. Reverses the revenue journal + the physical side effect
 *   (milk tank credit / stock restock / un-sell the animal) + closes the
 *   receivable + `Sale.status = CANCELLED`. **Refuses** if any payment was
 *   ever allocated — "the payment must be refunded first" (this ticket's
 *   own AC).
 * - `refundSale` — the opposite case: a sale **with** allocated payments.
 *   Reverses every payment's own journal (undoing the cash movement) in
 *   addition to the revenue journal and the same physical reversal, then
 *   `Sale.status = REFUNDED`. Full-document only in M22 (RD-070 — partial/
 *   line-level refunds + a real `CreditNote` are explicitly deferred,
 *   `SaleStatus.PARTIALLY_REFUNDED` stays unreachable).
 *
 * **Never a hard delete** — `Sale`/`Receivable`/`FinancePayment`/
 * `PaymentAllocation`/`CattleDisposition` rows all stay; only journal
 * mirrors are posted (`JournalService.reverseJournal`'s own "original stays"
 * invariant, same as `ExpenseService.reverseExpense`) and `Receivable.
 * closedAt` is stamped so a voided sale drops out of aging/outstanding
 * totals — the one exception is `CattleDisposition`, deleted by
 * `CattleService.undoDisposition` (see that method's own doc comment for
 * why an animal disposition record, specifically, is the one row this
 * flow removes rather than closes).
 */
@Injectable()
export class VoidSaleUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleService: SaleService,
    private readonly journalService: JournalService,
    private readonly milkTankService: MilkTankService,
    private readonly medicineService: MedicineService,
    private readonly feedItemService: FeedItemService,
    private readonly equipmentService: EquipmentService,
    private readonly cattleService: CattleService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(VoidSaleUseCase.name);
  }

  /**
   * Activity Log entry for a completed void. Called only *after* this use case's own transaction
   * commits (and never when a caller supplied its own `tx` — that caller owns the outer commit, and
   * logging inside it would persist an entry even if the outer transaction rolls back). A log-write
   * failure is swallowed: the void already committed, so it must not surface as a failed request.
   */
  private async recordVoidActivity(
    farmId: string,
    userId: string,
    eventTitle: 'Sale Cancelled' | 'Sale Refunded',
    sale: SaleWithLines,
  ): Promise<void> {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle,
        actionDetails: `Sale ${sale.saleNumber} ${eventTitle === 'Sale Cancelled' ? 'cancelled' : 'refunded'} — ৳${sale.totalAmount.toString()} reversed.`,
        actorId: userId,
        financialImpact: -Number(sale.totalAmount),
      });
    } catch (error) {
      this.log.error('Sale void activity log failed', {
        farmId,
        saleId: sale.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async cancelSale(
    farmId: string,
    userId: string,
    saleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleWithLines> {
    const run = (client: Prisma.TransactionClient) =>
      this.cancelWithClient(client, farmId, userId, saleId);
    if (tx) return run(tx);
    const sale = await this.prisma.$transaction((t) => run(t));
    await this.recordVoidActivity(farmId, userId, 'Sale Cancelled', sale);
    return sale;
  }

  private async cancelWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    saleId: string,
  ): Promise<SaleWithLines> {
    const sale = await this.getVoidableSaleOrThrow(client, farmId, saleId);
    const receivable = await client.receivable.findFirst({
      where: { saleId },
      select: { id: true },
    });
    if (receivable) {
      const allocationCount = await client.paymentAllocation.count({
        where: { receivableId: receivable.id },
      });
      if (allocationCount > 0) {
        throw new BadRequestException(
          'This sale has payments allocated against it — refund it instead of cancelling',
        );
      }
    }

    await this.reverseSaleJournal(client, farmId, userId, sale);
    await this.reversePhysicalEffects(client, farmId, userId, sale);
    if (receivable) {
      await client.receivable.update({
        where: { id: receivable.id },
        data: { closedAt: new Date() },
      });
    }
    await client.sale.update({
      where: { id: saleId },
      data: { status: SaleStatus.CANCELLED },
    });

    this.log.info('Sale cancelled', { farmId, saleId });
    // Re-derived from `sale` (already read on this `client`) rather than
    // `SaleService.findOne`, which reads via the outer `PrismaService`
    // connection and would race this still-uncommitted transaction — same
    // "re-derive on `tx`, not a separate connection" discipline
    // `PaySupplierUseCase.execute` documents for the identical hazard.
    return { ...sale, status: SaleStatus.CANCELLED };
  }

  async refundSale(
    farmId: string,
    userId: string,
    saleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleWithLines> {
    const run = (client: Prisma.TransactionClient) =>
      this.refundWithClient(client, farmId, userId, saleId);
    if (tx) return run(tx);
    const sale = await this.prisma.$transaction((t) => run(t));
    await this.recordVoidActivity(farmId, userId, 'Sale Refunded', sale);
    return sale;
  }

  private async refundWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    saleId: string,
  ): Promise<SaleWithLines> {
    const sale = await this.getVoidableSaleOrThrow(client, farmId, saleId);
    const receivable = await client.receivable.findFirst({
      where: { saleId },
      select: { id: true },
    });
    if (!receivable) {
      throw new BadRequestException(
        'This sale has no receivable — nothing to refund',
      );
    }
    const allocations = await client.paymentAllocation.findMany({
      where: { receivableId: receivable.id },
      select: { paymentId: true },
    });
    if (allocations.length === 0) {
      throw new BadRequestException(
        'This sale has no payments allocated — cancel it instead of refunding',
      );
    }

    const paymentIds = [...new Set(allocations.map((a) => a.paymentId))];
    for (const paymentId of paymentIds) {
      await this.reverseJournalFor(
        client,
        farmId,
        userId,
        'FINANCE_PAYMENT',
        paymentId,
        `payment-reversal:${paymentId}`,
        `Reversal of payment ${paymentId} (refund of sale ${sale.saleNumber})`,
      );
    }
    await this.reverseSaleJournal(client, farmId, userId, sale);
    await this.reversePhysicalEffects(client, farmId, userId, sale);
    await client.receivable.update({
      where: { id: receivable.id },
      data: { closedAt: new Date() },
    });
    await client.sale.update({
      where: { id: saleId },
      data: { status: SaleStatus.REFUNDED },
    });

    this.log.info('Sale refunded', {
      farmId,
      saleId,
      paymentCount: paymentIds.length,
    });
    // Same "re-derive on `tx`" discipline `cancelWithClient` uses above.
    return { ...sale, status: SaleStatus.REFUNDED };
  }

  private async getVoidableSaleOrThrow(
    client: Prisma.TransactionClient,
    farmId: string,
    saleId: string,
  ): Promise<SaleWithLines> {
    const sale = await client.sale.findFirst({
      where: { id: saleId, farmId },
      include: {
        lines: {
          include: {
            unit: true,
            milkDetail: true,
            animalDetail: true,
            inventoryDetail: true,
            manureDetail: true,
          },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    if (
      sale.status === SaleStatus.CANCELLED ||
      sale.status === SaleStatus.REFUNDED
    ) {
      throw new BadRequestException(`Sale is already ${sale.status}`);
    }
    if (sale.status === SaleStatus.DRAFT) {
      throw new BadRequestException(
        'A DRAFT sale was never confirmed — nothing to void',
      );
    }
    return sale;
  }

  private async reverseSaleJournal(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    sale: SaleWithLines,
  ): Promise<void> {
    await this.reverseJournalFor(
      client,
      farmId,
      userId,
      'SALE',
      sale.id,
      `sale-reversal:${sale.id}`,
      `Reversal of sale ${sale.saleNumber}`,
    );
  }

  private async reverseJournalFor(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    sourceType: string,
    sourceId: string,
    idempotencyKey: string,
    description: string,
  ): Promise<void> {
    const journalTxn = await client.journalTransaction.findFirst({
      where: { farmId, sourceType, sourceId },
      select: { id: true },
    });
    if (!journalTxn) {
      // Nothing was ever posted for this source (e.g. a zero-total edge
      // case) — nothing to reverse, same convention `ExpenseService.
      // reverseExpense` already follows.
      return;
    }
    await this.journalService.reverseJournal(
      {
        farmId,
        journalTransactionId: journalTxn.id,
        createdById: userId,
        idempotencyKey,
        description,
      },
      client,
    );
  }

  /** Reverses the physical side effect each sale-line type caused —
   * credits the milk tank back, restocks inventory, or un-sells the
   * animal. `MANURE` lines have no physical effect (RD-058) — nothing to
   * reverse. */
  private async reversePhysicalEffects(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    sale: SaleWithLines,
  ): Promise<void> {
    for (const line of sale.lines) {
      if (line.milkDetail) {
        await this.reverseMilkTankDecrement(
          client,
          farmId,
          userId,
          line.id,
          sale.saleNumber,
        );
      } else if (line.animalDetail) {
        await this.cattleService.undoDisposition(
          farmId,
          line.animalDetail.cattleId,
          client,
        );
      } else if (line.inventoryDetail) {
        await this.restockInventoryLine(
          client,
          farmId,
          userId,
          line.id,
          Number(line.quantity),
          line.inventoryDetail,
          sale.saleNumber,
        );
      }
      // manureDetail: no physical effect to reverse.
    }
  }

  private async reverseMilkTankDecrement(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    saleLineId: string,
    saleNumber: string,
  ): Promise<void> {
    // A sale may have drawn from several tanks (one SALE audit row each) — credit
    // every one back. Over-capacity is allowed: the tank may have refilled since.
    const auditLogs = await client.milkTankAuditLog.findMany({
      where: { farmId, saleLineId },
      orderBy: { createdAt: 'asc' },
    });
    for (const auditLog of auditLogs) {
      await this.milkTankService.adjustVolume(
        farmId,
        userId,
        auditLog.milkTankId,
        {
          delta: -auditLog.quantityL,
          activityType: 'ADJUSTMENT',
          source: 'sale_void',
          notes: `Void of sale ${saleNumber} — credited back`,
        },
        client,
        { allowOverCapacity: true },
      );
    }
  }

  private async restockInventoryLine(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    saleLineId: string,
    quantity: number,
    inventoryDetail: {
      medicineId: string | null;
      feedItemId: string | null;
      equipmentId: string | null;
    },
    saleNumber: string,
  ): Promise<void> {
    const notes = `Void of sale ${saleNumber} — restocked`;
    if (inventoryDetail.medicineId) {
      // RAKHAL-439 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`): restores each exact
      // batch the original sale drew from (per-batch `MedicineStockMovement`
      // history, `saleLineId`-linked) instead of `adjustStock`'s
      // representative-batch guess — correct even for a sale that split
      // across batches (RAKHAL-437). Falls back to the old behavior when no
      // batch-linked movement exists (a pre-437 sale line).
      await this.medicineService.restoreForSaleVoid(
        farmId,
        userId,
        {
          saleLineId,
          fallbackMedicineId: inventoryDetail.medicineId,
          fallbackQuantity: quantity,
          notes,
        },
        client,
      );
    } else if (inventoryDetail.feedItemId) {
      // RAKHAL-445: restores each exact lot the original sale drew from (a sale can split FIFO across
      // lots); falls back to crediting the newest lot for a pre-batch sale line.
      await this.feedItemService.restoreForSaleVoid(
        farmId,
        userId,
        {
          saleLineId,
          fallbackFeedItemId: inventoryDetail.feedItemId,
          fallbackQuantity: quantity,
          notes,
        },
        client,
      );
    } else if (inventoryDetail.equipmentId) {
      await this.equipmentService.adjustStock(
        farmId,
        userId,
        inventoryDetail.equipmentId,
        { adjustment: quantity, reason: 'ADJUSTMENT', notes, saleLineId },
        client,
      );
    }
  }
}
