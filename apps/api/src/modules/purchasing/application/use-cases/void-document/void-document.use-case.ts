import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Expense, Prisma, PurchaseStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { PurchaseService, PurchaseWithLines } from '../../purchase.service';

/**
 * `VoidDocument` (RAKHAL-377, MILESTONE 22, `BUSINESS_IA_PRD.md` §9.4,
 * §16.2) — the Purchasing-side half of the milestone's only correction
 * mechanism. Mirrors `VoidSaleUseCase`'s own shape and invariants exactly:
 * no money-changing `PATCH`, void + re-record instead, never a hard delete
 * (`Purchase`/`Expense`/`Payable`/`PaymentAllocation` rows all stay — only a
 * mirrored reversal journal is posted, `JournalService.reverseJournal`'s own
 * "original stays" guarantee).
 *
 * Unlike `Sale` (which splits into `cancelSale`/`refundSale` for the
 * unpaid/paid cases), `Purchase`/`Expense` get **one** void action each —
 * this ticket's own route list has no `/refund` for Purchasing — so both
 * methods here **refuse** to void a document with any `PaymentAllocation`
 * on its `Payable`, full stop; the payment must be reversed through
 * `PaySupplierUseCase`'s own eventual refund path first (out of this
 * ticket's scope, same class of deferral RD-070 already documents for
 * Sales).
 */
@Injectable()
export class VoidDocumentUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseService: PurchaseService,
    private readonly journalService: JournalService,
    private readonly medicineService: MedicineService,
    private readonly feedItemService: FeedItemService,
    private readonly equipmentService: EquipmentService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(VoidDocumentUseCase.name);
  }

  async voidPurchase(
    farmId: string,
    userId: string,
    purchaseId: string,
  ): Promise<PurchaseWithLines> {
    await this.prisma.$transaction(async (client) => {
      const purchase = await client.purchase.findFirst({
        where: { id: purchaseId, farmId },
        include: { lines: true, payable: { select: { id: true } } },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      if (purchase.status === PurchaseStatus.VOIDED) {
        throw new BadRequestException('Purchase is already VOIDED');
      }
      if (purchase.payable) {
        const allocationCount = await client.paymentAllocation.count({
          where: { payableId: purchase.payable.id },
        });
        if (allocationCount > 0) {
          throw new BadRequestException(
            'This purchase has payments allocated against it — refund the payment before voiding',
          );
        }
      }

      await this.reverseJournalFor(
        client,
        farmId,
        userId,
        'PURCHASE',
        purchase.id,
        `purchase-reversal:${purchase.id}`,
        `Reversal of purchase ${purchase.purchaseNumber}`,
      );

      const notes = `Void of purchase ${purchase.purchaseNumber} — destocked`;
      for (const line of purchase.lines) {
        const quantity = -Number(line.quantity);
        if (line.medicineId) {
          await this.medicineService.adjustStock(
            farmId,
            userId,
            line.medicineId,
            { adjustment: quantity, reason: 'ADJUSTMENT', notes },
            client,
          );
        } else if (line.feedItemId) {
          await this.feedItemService.adjustStock(
            farmId,
            userId,
            line.feedItemId,
            { adjustment: quantity, reason: 'ADJUSTMENT', notes },
            client,
          );
        } else if (line.equipmentId) {
          await this.equipmentService.adjustStock(
            farmId,
            userId,
            line.equipmentId,
            { adjustment: quantity, reason: 'ADJUSTMENT', notes },
            client,
          );
        }
      }

      if (purchase.payable) {
        await client.payable.update({
          where: { id: purchase.payable.id },
          data: { closedAt: new Date() },
        });
      }
      await client.purchase.update({
        where: { id: purchase.id },
        data: { status: PurchaseStatus.VOIDED },
      });
    });

    this.log.info('Purchase voided', { farmId, purchaseId });
    return this.purchaseService.findOne(farmId, purchaseId);
  }

  async voidExpense(
    farmId: string,
    userId: string,
    expenseId: string,
  ): Promise<Expense> {
    await this.prisma.$transaction(async (client) => {
      const expense = await client.expense.findFirst({
        where: { id: expenseId, farmId },
        include: { payable: { select: { id: true } } },
      });
      if (!expense) {
        throw new NotFoundException('Expense not found');
      }
      if (expense.voidedAt) {
        throw new BadRequestException('Expense is already voided');
      }
      if (expense.payable) {
        const allocationCount = await client.paymentAllocation.count({
          where: { payableId: expense.payable.id },
        });
        if (allocationCount > 0) {
          throw new BadRequestException(
            'This expense has payments allocated against it — refund the payment before voiding',
          );
        }
      }

      await this.reverseJournalFor(
        client,
        farmId,
        userId,
        'EXPENSE',
        expense.id,
        `expense-void-reversal:${expense.id}`,
        `Reversal of expense ${expense.id}`,
      );

      if (expense.payable) {
        await client.payable.update({
          where: { id: expense.payable.id },
          data: { closedAt: new Date() },
        });
      }
      await client.expense.update({
        where: { id: expense.id },
        data: { voidedAt: new Date() },
      });
    });

    this.log.info('Expense voided', { farmId, expenseId });
    return this.prisma.expense.findFirstOrThrow({
      where: { id: expenseId, farmId },
    });
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
    if (!journalTxn) return;
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
}
