import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  EquipmentStockMovementReason,
  Prisma,
  Purchase,
  PurchaseStatus,
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
import {
  derivePurchasePayment,
  PurchasePayment,
} from '../domain/purchase-payment';
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

/** One row of `GET /purchasing/purchases`: the purchase, its line count, and the derived payment
 * state (`paymentStatus` is `null` for a VOIDED purchase). */
export type PurchaseListRow = Purchase & {
  _count: { lines: number };
} & PurchasePayment;

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
    const { purchase, newItemNames } = await this.prisma.$transaction((tx) =>
      this.createWithClient(tx, farmId, userId, dto),
    );

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves. The purchase is already committed,
    // so a failed audit write must not turn it into a 500 (the caller would retry and double-post);
    // same non-fatal handling as `VoidDocumentUseCase`.
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle: 'Purchase Recorded',
        actionDetails: `Purchase ${purchase.purchaseNumber}: ৳${purchase.totalAmount.toString()} across ${purchase.lines.length} line(s).${newItemNames.length ? ` New inventory item(s) created: ${newItemNames.join(', ')}.` : ''}`,
        actorId: userId,
        financialImpact: -Number(purchase.totalAmount),
      });
    } catch (error) {
      this.log.error('Purchase activity log failed', {
        farmId,
        purchaseId: purchase.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return purchase;
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreatePurchaseDto,
  ): Promise<{ purchase: PurchaseWithLines; newItemNames: string[] }> {
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

    const newItemNames: string[] = [];
    for (const { line, totalAmount: lineTotal } of lineComputations) {
      const createdName = await this.createLineAndIncrementStock(
        client,
        farmId,
        userId,
        purchase,
        line,
        lineTotal,
      );
      if (createdName) newItemNames.push(createdName);
    }

    let financialAccountLedgerAccountId: string | null = null;
    if (gt(paidAmount, 0)) {
      // One account per farm: paying now never asks which wallet.
      const paidFromAccountId =
        await this.financialAccountService.resolveFarmAccountId(
          farmId,
          userId,
          dto.financialAccountId,
          client,
        );
      await this.financialAccountService.assertAccountActive(
        farmId,
        paidFromAccountId,
      );
      const account = await client.financialAccount.findFirst({
        where: { id: paidFromAccountId, farmId },
        select: { id: true, ledgerAccountId: true },
      });
      if (!account) {
        throw new NotFoundException('Financial account not found');
      }
      financialAccountLedgerAccountId = account.ledgerAccountId;
    }

    const inventoryAccount = await this.ledgerAccountService.findByCodeOrSeed(
      farmId,
      INVENTORY_CODE,
      client,
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
      const payableAccount = await this.ledgerAccountService.findByCodeOrSeed(
        farmId,
        ACCOUNTS_PAYABLE_CODE,
        client,
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

    return {
      purchase: await this.getOrThrow(client, farmId, purchase.id),
      newItemNames,
    };
  }

  /** Creates the `PurchaseLine` row and increments the referenced item's
   * real stock in the same transaction (RAKHAL-341's `tx` seam) — a rolled
   * back purchase rolls back the stock increment with it, unlike V1's
   * `FinanceService.incrementInventoryStock()` which ran after commit.
   * A line carrying `newItem` first creates that item with zero stock in
   * the same transaction, then runs the normal path below, so the stock only
   * ever arrives with the purchase's own lot and ledger posting. Returns the
   * new item's name when one was created. */
  private async createLineAndIncrementStock(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    purchase: Purchase,
    line: CreatePurchaseLineDto,
    lineTotal: Prisma.Decimal,
  ): Promise<string | null> {
    const quantity = toStorage(line.quantity).toNumber();
    const unitCost = toStorage(line.unitCost);

    const target = line.newItem
      ? await this.createNewItem(
          client,
          farmId,
          userId,
          purchase,
          line,
          unitCost.toNumber(),
        )
      : {
          medicineId: line.medicineId,
          feedItemId: line.feedItemId,
          equipmentId: line.equipmentId,
        };
    const createdName = line.newItem?.name ?? null;

    if (target.medicineId) {
      const medicine = await client.medicine.findFirst({
        where: { id: target.medicineId, farmId },
        select: { id: true },
      });
      if (!medicine) {
        throw new NotFoundException('Medicine not found for purchase line');
      }
      // RAKHAL-436 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — a medicine purchase
      // creates its own new lot instead of folding into whatever batch
      // `adjustStock` would otherwise pick, so a second purchase of the same
      // drug at a different cost/expiry doesn't get blended into the first.
      // Called before the `PurchaseLine` write (RAKHAL-439) so the line can
      // record exactly which batch it created — `VoidDocumentUseCase` reverses
      // that specific lot instead of a representative-batch guess.
      const { batchId } = await this.medicineService.createBatch(
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
      await client.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          medicineId: medicine.id,
          medicineBatchId: batchId,
          quantity: toStorage(line.quantity),
          unitCost,
          totalAmount: lineTotal,
        },
      });
      return createdName;
    }

    if (target.feedItemId) {
      const feedItem = await client.feedItem.findFirst({
        where: { id: target.feedItemId, farmId },
        select: { id: true },
      });
      if (!feedItem) {
        throw new NotFoundException('Feed item not found for purchase line');
      }
      // RAKHAL-445 (`docs/EPIC_FEED_NUTRITION_PROFILE.md`) — a feed purchase creates its own new lot
      // (own cost/date/code, nutrition inherited from the item's default) instead of folding into
      // whatever lot an `adjustStock` would pick, so a second purchase at a different price is never
      // blended into the first. Created before the `PurchaseLine` so the line can record exactly which
      // lot it made — `VoidDocumentUseCase` debits that specific lot.
      const { batchId } = await this.feedItemService.createBatchInTx(
        farmId,
        userId,
        feedItem.id,
        {
          batchCode: line.batchCode,
          currentStock: quantity,
          costPerUnit: unitCost.toNumber(),
          purchaseDate: purchase.purchaseDate.toISOString(),
          notes: `Purchase ${purchase.purchaseNumber}`,
        },
        client,
      );
      await client.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          feedItemId: feedItem.id,
          feedItemBatchId: batchId,
          quantity: toStorage(line.quantity),
          unitCost,
          totalAmount: lineTotal,
        },
      });
      return createdName;
    }

    // Shape already validated by `validatePurchaseLineDetailShape` — the
    // only remaining branch is `equipmentId`.
    const equipment = await client.equipment.findFirst({
      where: { id: target.equipmentId ?? undefined, farmId },
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
    return createdName;
  }

  /**
   * Creates the line's `newItem` with **zero stock** inside the purchase transaction and returns the
   * FK to put on the line. The lot (and with it the stock) is added by the caller's normal path, so an
   * item can never exist with units on the shelf but no ledger posting. Everything runs on `client`,
   * so a later failure (bad payment, unbalanced journal, …) rolls the new item back too.
   */
  private async createNewItem(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    purchase: Purchase,
    line: CreatePurchaseLineDto,
    unitCost: number,
  ): Promise<{
    medicineId?: string;
    feedItemId?: string;
    equipmentId?: string;
  }> {
    const item = line.newItem!;
    if (item.unitId) {
      const unit = await client.unit.findFirst({
        where: {
          id: item.unitId,
          deletedAt: null,
          OR: [{ farmId: null }, { farmId }],
        },
        select: { id: true },
      });
      if (!unit) {
        throw new BadRequestException('newItem.unitId not found for this farm');
      }
    }

    switch (item.kind) {
      case 'MEDICINE': {
        const row = await this.medicineService.createCatalogRowInTx(
          farmId,
          userId,
          {
            name: item.name,
            type: item.medicineType!,
            category: item.medicineCategory!,
            unitId: item.unitId!,
            manufacturer: item.manufacturer,
            lowStockThreshold: item.lowStockThreshold,
            milkWithdrawalDays: item.milkWithdrawalDays,
            meatWithdrawalDays: item.meatWithdrawalDays,
            notes: item.notes,
            purchaseDate: purchase.purchaseDate,
            expiryDate: new Date(line.expiryDate!),
            costPerUnit: unitCost,
          },
          client,
        );
        return { medicineId: row.id };
      }
      case 'FEED': {
        const row = await this.feedItemService.createCatalogRowInTx(
          farmId,
          userId,
          {
            name: item.name,
            feedClass: item.feedClass!,
            feedSubType: item.feedSubType,
            ingredientId: item.ingredientId,
            nutrition: item.nutrition,
            unitId: item.unitId!,
            kgPerUnit: item.kgPerUnit,
            lowStockThreshold: item.lowStockThreshold,
            notes: item.notes,
          },
          client,
        );
        return { feedItemId: row.id };
      }
      case 'EQUIPMENT': {
        const row = await this.equipmentService.createCatalogRowInTx(
          farmId,
          userId,
          {
            name: item.name,
            assetId: item.assetId,
            type: item.equipmentType,
            unitId: item.unitId,
            lowStockThreshold: item.lowStockThreshold,
            notes: item.notes,
            purchaseDate: purchase.purchaseDate,
            costPerUnit: unitCost,
          },
          client,
        );
        return { equipmentId: row.id };
      }
    }
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
  ): Promise<CursorPage<PurchaseListRow>> {
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
      // A voided purchase is neither paid nor owed, so it never matches a payment-status filter.
      ...(query.paymentStatus
        ? {
            ...buildPurchasePaymentStatusWhere(query.paymentStatus),
            status: { not: PurchaseStatus.VOIDED },
          }
        : {}),
    };

    const rows = await this.prisma.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        _count: { select: { lines: true } },
        payable: { select: { id: true, totalAmount: true, dueDate: true } },
      },
    });

    const page = toCursorPage(rows, query);

    // Payment state is derived here (one grouped read for the page) so the client never has to match
    // a purchase against `GET /purchasing/payables?limit=100`.
    const payableIds = page.items.flatMap((r) =>
      r.payable ? [r.payable.id] : [],
    );
    const sums = payableIds.length
      ? await this.prisma.paymentAllocation.groupBy({
          by: ['payableId'],
          where: { payableId: { in: payableIds } },
          _sum: { amount: true },
        })
      : [];
    const allocatedById = new Map(
      sums.map((s) => [s.payableId as string, s._sum.amount ?? 0]),
    );

    const items: PurchaseListRow[] = page.items.map(({ payable, ...row }) => ({
      ...row,
      ...derivePurchasePayment(
        row.totalAmount.toString(),
        row.status === PurchaseStatus.VOIDED,
        payable
          ? {
              totalAmount: payable.totalAmount.toString(),
              dueDate: payable.dueDate,
            }
          : null,
        (allocatedById.get(payable?.id ?? '') ?? 0).toString(),
      ),
    }));

    return { items, meta: page.meta };
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
