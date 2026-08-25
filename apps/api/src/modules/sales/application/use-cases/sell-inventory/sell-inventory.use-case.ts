import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  FinancePayment,
  PaymentDirection,
  Prisma,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt } from 'src/common/money';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SaleService } from '../../sale.service';
import { CreateSaleLineDto } from '../../../presentation/dto/create-sale-line.dto';
import {
  SellInventoryItemInput,
  SellInventoryItemResult,
  SellInventoryItemType,
} from './sell-inventory.types';

/** `LedgerAccount.code` for "Accounts Receivable" — seeded per farm by
 * RAKHAL-333's default chart. Matches `PaymentService`'s/`SellMilkUseCase`'s
 * own constant of the same value, duplicated rather than imported since none
 * of these modules export their ledger-code constants today. */
const ACCOUNTS_RECEIVABLE_CODE = '1100';

/** `LedgerAccount.code` for "Inventory Sales" revenue. */
const INVENTORY_SALES_REVENUE_CODE = '4300';

/** Minimal shape every one of the three source tables shares — just enough
 * for this use case to build the sale line and check/decrement stock. */
interface SellableItem {
  id: string;
  name: string;
  unitId: string | null;
  currentStock: number;
}

/**
 * `SellInventoryItem` (RAKHAL-346, Sales module — `FINANCE_V2_DESIGN.md`
 * §4.3, §5.2). Sells one Medicine/FeedItem/Equipment row. Mirrors
 * `SellMilkUseCase`'s (RAKHAL-342) shape — same one-`$transaction` flow:
 *
 *   Sale + SaleLine(INVENTORY) + InventorySaleLine
 *     -> stock decrement (`*StockMovement`, reason SALE, saleLineId)
 *     -> journal posting (Dr Accounts Receivable, Cr Inventory Sales Revenue)
 *     -> Receivable
 *     -> optional Payment + PaymentAllocation (money received at sale time)
 *     -> Sale confirmed
 *
 * Any failure at any step rolls back every step — no Sale, no stock change,
 * no Receivable, no Payment, no JournalTransaction survives a rejected call.
 * Sale cannot exceed stock on hand — checked before any write.
 *
 * Stock is decremented via the matching inventory service's
 * `adjustStock(..., tx)` (RAKHAL-341's unit-of-work seam), passed the same
 * transaction client `createSale` used, so the stock movement and the sale
 * row commit or roll back together.
 */
@Injectable()
export class SellInventoryUseCase {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleService: SaleService,
    private readonly medicineService: MedicineService,
    private readonly feedItemService: FeedItemService,
    private readonly equipmentService: EquipmentService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly receivableService: ReceivableService,
    private readonly paymentService: PaymentService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SellInventoryUseCase.name);
  }

  async execute(
    farmId: string,
    userId: string,
    dto: SellInventoryItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SellInventoryItemResult> {
    const run = (client: Prisma.TransactionClient) =>
      this.executeWithClient(client, farmId, userId, dto);
    const result = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves, not from
    // inside `executeWithClient`.
    const lineDescription = result.sale.lines[0]?.description ?? dto.itemType;
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Inventory Item Sold',
      actionDetails: `Sale ${result.sale.saleNumber}: ${dto.quantity} x ${lineDescription} for ৳${result.sale.totalAmount.toString()}${(dto.amountReceived ?? 0) > 0 ? `, ৳${dto.amountReceived} received` : ''}.`,
      actorId: userId,
      financialImpact: Number(result.sale.totalAmount),
    });

    return result;
  }

  private async executeWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: SellInventoryItemInput,
  ): Promise<SellInventoryItemResult> {
    this.assertInputShape(dto);

    // (1) Validate stock on hand before any write — an over-stock sale must
    // not create a Sale row, must not touch stock, must not open a Receivable.
    const item = await this.getItemOrThrow(
      client,
      farmId,
      dto.itemType,
      dto.itemId,
    );
    if (dto.quantity > item.currentStock) {
      throw new BadRequestException(
        `Insufficient stock: ${item.currentStock} on hand, ${dto.quantity} requested`,
      );
    }

    // (2) Sale + SaleLine(INVENTORY) + InventorySaleLine.
    const line: CreateSaleLineDto = {
      type: SaleLineType.INVENTORY,
      description: `Sold ${item.name}`,
      quantity: dto.quantity,
      unitId: item.unitId ?? undefined,
      unitPrice: dto.unitPrice,
      medicineId: dto.itemType === 'MEDICINE' ? dto.itemId : undefined,
      feedItemId: dto.itemType === 'FEED_ITEM' ? dto.itemId : undefined,
      equipmentId: dto.itemType === 'EQUIPMENT' ? dto.itemId : undefined,
    };

    const sale = await this.saleService.createSale(
      farmId,
      userId,
      {
        saleDate: dto.saleDate,
        discountAmount: dto.discountAmount,
        notes: dto.notes,
        lines: [line],
      },
      client,
    );
    const saleLine = sale.lines[0];

    // (3) Decrement stock — same tx client, SALE reason, saleLineId set.
    await this.adjustStockForSale(client, farmId, userId, dto, saleLine.id);

    // (4) Revenue recognition: Dr Accounts Receivable, Cr Inventory Sales
    // Revenue — same "Sale posted" journal leg `SellMilkUseCase` posts.
    const [arAccount, revenueAccount] = await Promise.all([
      this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
      this.ledgerAccountService.findByCode(
        farmId,
        INVENTORY_SALES_REVENUE_CODE,
      ),
    ]);
    if (!arAccount || !revenueAccount) {
      // Should never happen for a farm bootstrapped via FarmService.create
      // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
      throw new BadRequestException(
        'Accounts Receivable / Inventory Sales ledger accounts are not seeded for this farm',
      );
    }
    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'SALE',
        sourceId: sale.id,
        transactionDate: sale.saleDate,
        description: `Inventory sale ${sale.saleNumber}`,
        idempotencyKey: `sale:${sale.id}`,
        createdById: userId,
        entries: [
          { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
          { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
        ],
      },
      client,
    );

    // (5) Receivable for the sale total — always created; a same-call
    // Payment (below) settles it immediately if the caller supplied
    // `amountReceived`.
    const receivable = await this.receivableService.createReceivable(
      farmId,
      sale.id,
      sale.totalAmount,
      null,
      client,
    );

    // (6) Optional payment collected at sale time. `PaymentService.
    // allocatePayment`'s own `ReceivableService.assertWithinOutstanding`
    // check rejects an `amountReceived` greater than the sale total — that
    // rejection rolls back this entire transaction (Sale, stock decrement,
    // journal, Receivable included).
    let payment: FinancePayment | null = null;
    const amountReceived = dto.amountReceived ?? 0;
    if (gt(amountReceived, 0)) {
      payment = await this.paymentService.recordPayment(
        farmId,
        userId,
        {
          direction: PaymentDirection.INCOMING,
          financialAccountId: dto.financialAccountId as string,
          amount: amountReceived,
          method: dto.paymentMethod!,
          transactionDate: dto.saleDate,
          referenceNumber: sale.saleNumber,
          notes: dto.notes,
        },
        client,
      );
      await this.paymentService.allocatePayment(
        farmId,
        payment.id,
        [{ amount: amountReceived, receivableId: receivable.id }],
        client,
      );
    }

    // (7) Confirm the sale — the atomic stock/ledger side effects a DRAFT
    // sale is missing (per `SaleStatus`'s own doc comment) have now run.
    await client.sale.update({
      where: { id: sale.id },
      data: { status: SaleStatus.CONFIRMED },
    });

    this.log.info('Inventory item sold', {
      farmId,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      itemType: dto.itemType,
      itemId: dto.itemId,
      quantity: dto.quantity,
      totalAmount: sale.totalAmount.toString(),
      amountReceived,
    });

    return {
      sale: { ...sale, status: SaleStatus.CONFIRMED },
      receivable,
      payment,
    };
  }

  private assertInputShape(dto: SellInventoryItemInput): void {
    if (!(dto.quantity > 0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    if (!(dto.unitPrice >= 0)) {
      throw new BadRequestException('Unit price cannot be negative');
    }
    if (dto.discountAmount !== undefined && dto.discountAmount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }
    const amountReceived = dto.amountReceived ?? 0;
    if (amountReceived < 0) {
      throw new BadRequestException('Amount received cannot be negative');
    }
    if (amountReceived > 0) {
      if (!dto.financialAccountId) {
        throw new BadRequestException(
          'financialAccountId is required when amountReceived is greater than zero',
        );
      }
      if (!dto.paymentMethod) {
        throw new BadRequestException(
          'paymentMethod is required when amountReceived is greater than zero',
        );
      }
    }
  }

  /** Reads the item directly off the open tx client (not through the
   * inventory services' own `getOrThrow`, which is private) — farm-scoped,
   * mirrors `SaleService.createLineDetail`'s own direct `client.medicine.
   * findFirst`-style existence check for the INVENTORY line type. */
  private async getItemOrThrow(
    client: Prisma.TransactionClient,
    farmId: string,
    itemType: SellInventoryItemType,
    itemId: string,
  ): Promise<SellableItem> {
    switch (itemType) {
      case 'MEDICINE': {
        const medicine = await client.medicine.findFirst({
          where: { id: itemId, farmId },
          select: { id: true, name: true, unitId: true, currentStock: true },
        });
        if (!medicine) throw new NotFoundException('Medicine not found');
        return medicine;
      }
      case 'FEED_ITEM': {
        const feedItem = await client.feedItem.findFirst({
          where: { id: itemId, farmId },
          select: { id: true, name: true, unitId: true, currentStock: true },
        });
        if (!feedItem) throw new NotFoundException('Feed item not found');
        return feedItem;
      }
      case 'EQUIPMENT': {
        const equipment = await client.equipment.findFirst({
          where: { id: itemId, farmId },
          select: { id: true, name: true, unitId: true, currentStock: true },
        });
        if (!equipment) throw new NotFoundException('Equipment not found');
        return equipment;
      }
    }
  }

  /** Calls the matching inventory service's `adjustStock(..., tx)` with a
   * negative delta, `reason: SALE`, and `saleLineId` set — the seam RAKHAL-341
   * added so this write shares the caller's transaction instead of opening
   * its own. */
  private async adjustStockForSale(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: SellInventoryItemInput,
    saleLineId: string,
  ): Promise<void> {
    const adjustment = -dto.quantity;
    const notes = dto.notes ?? 'Sold via SellInventoryItem';

    switch (dto.itemType) {
      case 'MEDICINE':
        await this.medicineService.adjustStock(
          farmId,
          userId,
          dto.itemId,
          { adjustment, reason: 'SALE', notes, saleLineId },
          client,
        );
        return;
      case 'FEED_ITEM':
        await this.feedItemService.adjustStock(
          farmId,
          userId,
          dto.itemId,
          { adjustment, reason: 'SALE', notes, saleLineId },
          client,
        );
        return;
      case 'EQUIPMENT':
        await this.equipmentService.adjustStock(
          farmId,
          userId,
          dto.itemId,
          { adjustment, reason: 'SALE', notes, saleLineId },
          client,
        );
        return;
    }
  }
}
