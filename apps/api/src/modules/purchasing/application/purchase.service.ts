import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  EquipmentStockMovementReason,
  FeedItemStockMovementReason,
  Prisma,
  Purchase,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, multiply, subtract, sum, toStorage } from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  JournalService,
  PostJournalLine,
} from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from 'src/modules/inventory/application/services/equipment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PayableStatus } from '../domain/payable-status';
import { validatePurchaseLineDetailShape } from '../domain/purchase-line-shape';
import { assertSupplierBelongsToFarm } from '../domain/assert-supplier-in-farm';
import { derivePayableDueDate } from '../domain/due-date';
import { PurchaseNumberAllocator } from '../infrastructure/purchase-number.allocator';
import { CreatePurchaseDto } from '../presentation/dto/create-purchase.dto';
import { CreatePurchaseLineDto } from '../presentation/dto/create-purchase-line.dto';
import { ListPurchasesQueryDto } from '../presentation/dto/list-purchases-query.dto';
import { PayableService } from './payable.service';

/**
 * SQL `where` fragment for `?paymentStatus=` on `GET /purchasing/purchases`
 * (RAKHAL-375, same SQL-expressible technique `sale.service.ts`'s
 * `buildPaymentStatusWhere` established for RAKHAL-368) — expressed against
 * the `payable` relation, never page post-filtering. A `Purchase` with no
 * `Payable` was paid in full at creation, same rule `Sale`/`Receivable`
 * follows.
 */
function buildPurchasePaymentStatusWhere(
  status: PayableStatus,
): Prisma.PurchaseWhereInput {
  const now = new Date();
  const notOverdue: Prisma.PurchaseWhereInput = {
    OR: [
      { payable: { dueDate: null } },
      { payable: { dueDate: { gte: now } } },
    ],
  };

  switch (status) {
    case PayableStatus.PAID:
      return {
        OR: [{ payable: null }, { payable: { closedAt: { not: null } } }],
      };
    case PayableStatus.UNPAID:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { allocations: { none: {} } } },
          notOverdue,
        ],
      };
    case PayableStatus.PARTIALLY_PAID:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { allocations: { some: {} } } },
          notOverdue,
        ],
      };
    case PayableStatus.OVERDUE:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { dueDate: { lt: now } } },
        ],
      };
  }
}

/** `LedgerAccount.code` for "Inventory" — seeded by RAKHAL-333's default
 * chart (`default-chart-of-accounts.ts`). Every farm has this row from
 * bootstrap. A `Purchase` always debits this account — the whole reason
 * `Purchase` exists as a concept separate from `Expense`
 * (`FINANCE_V2_DESIGN.md` §5.1). */
const INVENTORY_CODE = '1200';

/** `LedgerAccount.code` for "Accounts Payable" — same seeding as above. */
const ACCOUNTS_PAYABLE_CODE = '2000';

/** `Purchase` with every line loaded — the shape every read route works with. */
const PURCHASE_INCLUDE = {
  lines: true,
  payable: true,
} satisfies Prisma.PurchaseInclude;

export type PurchaseWithLines = Prisma.PurchaseGetPayload<{
  include: typeof PURCHASE_INCLUDE;
}>;

/**
 * Purchase document engine (RAKHAL-348, Purchasing —
 * `FINANCE_V2_DESIGN.md` §4.3, §5.1). A `Purchase` always **increases an
 * inventory asset** — buying Medicine/FeedItem/Equipment stock — and is
 * atomic end to end in one `$transaction`: document + lines + real stock
 * increment (`MedicineService`/`FeedItemService`/`EquipmentService.
 * adjustStock`, RAKHAL-341's `tx` seam) + balanced journal posting + (if not
 * fully paid) a `Payable`. Mirrors `SaleService.createSale`'s structure but,
 * unlike `Sale` (deliberately split into a document-only ticket plus four
 * follow-on use-case tickets), does the full atomic operation itself — this
 * ticket's own AC text requires a single worked e2e example ("৳30,000 feed
 * purchase, ৳20,000 paid from Bank → Payable 10,000, inventory +quantity")
 * that only makes sense as one operation.
 */
@Injectable()
export class PurchaseService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseNumberAllocator: PurchaseNumberAllocator,
    private readonly journalService: JournalService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly medicineService: MedicineService,
    private readonly feedItemService: FeedItemService,
    private readonly equipmentService: EquipmentService,
    private readonly payableService: PayableService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PurchaseService.name);
  }

  async createPurchase(
    farmId: string,
    userId: string,
    dto: CreatePurchaseDto,
  ): Promise<PurchaseWithLines> {
    const purchase = await this.prisma.$transaction((tx) =>
      this.createWithClient(tx, farmId, userId, dto),
    );

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Purchase Recorded',
      actionDetails: `Purchase ${purchase.purchaseNumber}: ৳${purchase.totalAmount.toString()} across ${purchase.lines.length} line(s).`,
      actorId: userId,
      financialImpact: -Number(purchase.totalAmount),
    });

    return purchase;
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreatePurchaseDto,
  ): Promise<PurchaseWithLines> {
    for (const line of dto.lines) {
      const error = validatePurchaseLineDetailShape(line);
      if (error) {
        throw new BadRequestException(error);
      }
    }

    const lineComputations = dto.lines.map((line) => ({
      line,
      totalAmount: toStorage(multiply(line.quantity, line.unitCost)),
    }));
    const totalAmount = toStorage(
      sum(lineComputations.map((c) => c.totalAmount)),
    );

    const paidAmount = toStorage(dto.paidAmount ?? 0);
    if (gt(paidAmount, totalAmount)) {
      throw new BadRequestException(
        'paidAmount cannot exceed the purchase total',
      );
    }
    if (gt(paidAmount, 0) && !dto.financialAccountId) {
      throw new BadRequestException(
        'financialAccountId is required whenever paidAmount is greater than zero',
      );
    }
    const outstanding = toStorage(subtract(totalAmount, paidAmount));

    if (dto.supplierId) {
      await assertSupplierBelongsToFarm(client, farmId, dto.supplierId);
    }

    const purchaseNumber = await this.purchaseNumberAllocator.allocate(
      client,
      farmId,
    );

    const purchase = await client.purchase.create({
      data: {
        farmId,
        purchaseNumber,
        supplierId: dto.supplierId ?? null,
        purchaseDate: new Date(dto.purchaseDate),
        totalAmount,
        notes: dto.notes ?? null,
        createdById: userId,
      },
    });

    for (const { line, totalAmount: lineTotal } of lineComputations) {
      await this.createLineAndIncrementStock(
        client,
        farmId,
        userId,
        purchase,
        line,
        lineTotal,
      );
    }

    let financialAccountLedgerAccountId: string | null = null;
    if (dto.financialAccountId && gt(paidAmount, 0)) {
      await this.financialAccountService.assertAccountActive(
        farmId,
        dto.financialAccountId,
      );
      const account = await client.financialAccount.findFirst({
        where: { id: dto.financialAccountId, farmId },
        select: { id: true, ledgerAccountId: true },
      });
      if (!account) {
        throw new NotFoundException('Financial account not found');
      }
      financialAccountLedgerAccountId = account.ledgerAccountId;
    }

    const inventoryAccount = await this.ledgerAccountService.findByCode(
      farmId,
      INVENTORY_CODE,
    );
    if (!inventoryAccount) {
      throw new BadRequestException(
        'Inventory ledger account is not seeded for this farm',
      );
    }

    const entries: PostJournalLine[] = [
      { ledgerAccountId: inventoryAccount.id, debit: totalAmount },
    ];
    if (gt(paidAmount, 0) && financialAccountLedgerAccountId) {
      entries.push({
        ledgerAccountId: financialAccountLedgerAccountId,
        credit: paidAmount,
      });
    }
    if (gt(outstanding, 0)) {
      const payableAccount = await this.ledgerAccountService.findByCode(
        farmId,
        ACCOUNTS_PAYABLE_CODE,
      );
      if (!payableAccount) {
        throw new BadRequestException(
          'Accounts Payable ledger account is not seeded for this farm',
        );
      }
      entries.push({ ledgerAccountId: payableAccount.id, credit: outstanding });
    }

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'PURCHASE',
        sourceId: purchase.id,
        transactionDate: purchase.purchaseDate,
        description: `Purchase ${purchaseNumber}`,
        idempotencyKey: `purchase:${purchase.id}`,
        createdById: userId,
        entries,
      },
      client,
    );

    if (gt(outstanding, 0)) {
      const dueDate = dto.dueDate
        ? new Date(dto.dueDate)
        : await this.deriveDueDate(
            client,
            dto.supplierId,
            purchase.purchaseDate,
          );
      await this.payableService.createPayable(
        farmId,
        {
          purchaseId: purchase.id,
          supplierId: dto.supplierId ?? null,
          totalAmount: outstanding,
          dueDate,
        },
        client,
      );
    }

    this.log.info('Purchase created', {
      farmId,
      purchaseId: purchase.id,
      purchaseNumber,
      lineCount: dto.lines.length,
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      outstanding: outstanding.toString(),
    });

    return this.getOrThrow(client, farmId, purchase.id);
  }

  /** Creates the `PurchaseLine` row and increments the referenced item's
   * real stock in the same transaction (RAKHAL-341's `tx` seam) — a rolled
   * back purchase rolls back the stock increment with it, unlike V1's
   * `FinanceService.incrementInventoryStock()` which ran after commit. */
  private async createLineAndIncrementStock(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    purchase: Purchase,
    line: CreatePurchaseLineDto,
    lineTotal: Prisma.Decimal,
  ): Promise<void> {
    const quantity = toStorage(line.quantity).toNumber();
    const unitCost = toStorage(line.unitCost);

    if (line.medicineId) {
      const medicine = await client.medicine.findFirst({
        where: { id: line.medicineId, farmId },
        select: { id: true },
      });
      if (!medicine) {
        throw new NotFoundException('Medicine not found for purchase line');
      }
      await client.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          medicineId: medicine.id,
          quantity: toStorage(line.quantity),
          unitCost,
          totalAmount: lineTotal,
        },
      });
      // RAKHAL-436 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — a medicine purchase
      // creates its own new lot instead of folding into whatever batch
      // `adjustStock` would otherwise pick, so a second purchase of the same
      // drug at a different cost/expiry doesn't get blended into the first.
      await this.medicineService.createBatch(
        farmId,
        userId,
        medicine.id,
        {
          batchCode: line.batchCode,
          currentStock: quantity,
          costPerUnit: unitCost.toNumber(),
          purchaseDate: purchase.purchaseDate.toISOString(),
          expiryDate: line.expiryDate!,
          notes: `Purchase ${purchase.purchaseNumber}`,
        },
        client,
      );
      return;
    }

    if (line.feedItemId) {
      const feedItem = await client.feedItem.findFirst({
        where: { id: line.feedItemId, farmId },
        select: { id: true },
      });
      if (!feedItem) {
        throw new NotFoundException('Feed item not found for purchase line');
      }
      await client.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          feedItemId: feedItem.id,
          quantity: toStorage(line.quantity),
          unitCost,
          totalAmount: lineTotal,
        },
      });
      await this.feedItemService.adjustStock(
        farmId,
        userId,
        feedItem.id,
        {
          adjustment: quantity,
          reason: FeedItemStockMovementReason.PURCHASE,
          notes: `Purchase ${purchase.purchaseNumber}`,
        },
        client,
      );
      return;
    }

    // Shape already validated by `validatePurchaseLineDetailShape` — the
    // only remaining branch is `equipmentId`.
    const equipment = await client.equipment.findFirst({
      where: { id: line.equipmentId, farmId },
      select: { id: true },
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found for purchase line');
    }
    await client.purchaseLine.create({
      data: {
        purchaseId: purchase.id,
        equipmentId: equipment.id,
        quantity: toStorage(line.quantity),
        unitCost,
        totalAmount: lineTotal,
      },
    });
    await this.equipmentService.adjustStock(
      farmId,
      userId,
      equipment.id,
      {
        adjustment: quantity,
        reason: EquipmentStockMovementReason.PURCHASE,
        notes: `Purchase ${purchase.purchaseNumber}`,
      },
      client,
    );
  }

  async findOne(farmId: string, id: string): Promise<PurchaseWithLines> {
    return this.getOrThrow(this.prisma, farmId, id);
  }

  /**
   * `GET /purchasing/purchases` v2 (RAKHAL-375, MILESTONE 22 —
   * `BUSINESS_IA_PRD.md` §5.13). Cursor-paginated + filtered, same
   * SQL-expressible `paymentStatus` technique RAKHAL-368's `SaleService.
   * findAll` established (`buildPurchasePaymentStatusWhere`, this file's
   * own module-level function) — never page post-filtering.
   */
  async findAll(
    farmId: string,
    query: ListPurchasesQueryDto,
  ): Promise<CursorPage<Purchase & { _count: { lines: number } }>> {
    const where: Prisma.PurchaseWhereInput = {
      farmId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.from || query.to
        ? {
            purchaseDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.paymentStatus
        ? buildPurchasePaymentStatusWhere(query.paymentStatus)
        : {}),
    };

    const rows = await this.prisma.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { _count: { select: { lines: true } } },
    });

    return toCursorPage(rows, query);
  }

  /** RAKHAL-365: `Payable.dueDate` defaults to `purchaseDate +
   * Supplier.paymentTermsDays` when the caller doesn't pass one explicitly.
   * `null` when there is no supplier or its `paymentTermsDays` is 0. */
  private async deriveDueDate(
    client: Prisma.TransactionClient,
    supplierId: string | undefined,
    purchaseDate: Date,
  ): Promise<Date | null> {
    if (!supplierId) {
      return null;
    }
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { paymentTermsDays: true },
    });
    return derivePayableDueDate(purchaseDate, supplier?.paymentTermsDays);
  }

  private async getOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    farmId: string,
    id: string,
  ): Promise<PurchaseWithLines> {
    const purchase = await client.purchase.findFirst({
      where: { id, farmId },
      include: PURCHASE_INCLUDE,
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return purchase;
  }
}
