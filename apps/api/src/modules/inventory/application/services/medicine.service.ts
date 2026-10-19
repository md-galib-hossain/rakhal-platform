import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Medicine,
  MedicineBatch,
  MedicineCategory,
  MedicineType,
  MediaCategory,
  MediaUsage,
  MedicineStockMovementReason,
  Prisma,
  Unit,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { convertQuantity } from '../../domain/unit-conversion';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import {
  MediaService,
  MediaUrls,
} from 'src/modules/media/application/services/media.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  computeExpiryStatus,
  computeStockStatus,
  ExpiryStatus,
  StockStatus,
} from '../../domain/medicine-status';
import { AdjustStockDto } from '../../presentation/dto/adjust-stock.dto';
import { CreateMedicineBatchDto } from '../../presentation/dto/create-medicine-batch.dto';
import { CreateMedicineDto } from '../../presentation/dto/create-medicine.dto';
import { ListMedicineQueryDto } from '../../presentation/dto/list-medicine-query.dto';
import { UpdateMedicineDto } from '../../presentation/dto/update-medicine.dto';
import { InventoryActivityService } from './inventory-activity.service';

/** A medicine row with its `Unit` relation resolved (RAKHAL-326). */
type MedicineWithUnit = Medicine & { unit: Unit };

/** A medicine row enriched with derived stock/expiry status for the API. */
type PresentedMedicine = MedicineWithUnit & {
  stockStatus: StockStatus;
  expiryStatus: ExpiryStatus;
};

type DecrementResult = {
  medicineId: string;
  batchId: string | null;
  balanceAfter: number;
  /** RAKHAL-437 — the primary (first-drawn) batch's own cost. Prefer `totalCost`
   * for pricing the whole consumption; this is the per-unit rate of that one lot. */
  costPerUnit: number;
  /** RAKHAL-437 — `Σ costPerUnit × quantity` across every batch actually drawn
   * from, accurate even when a dose splits across differently-priced lots
   * (`Medicine.costPerUnit`, a single product-level number, isn't). */
  totalCost: number;
  /** Protocols v2 — the `MedicineStockMovement` rows this draw wrote; the caller stamps its `TreatmentLog.id` on them so a
   * voided dose can be reversed batch-exactly (`restoreForTreatmentVoid`). */
  movementIds: string[];
  batchesUsed: {
    medicineId: string;
    batchId: string | null;
    quantity: number;
    balanceAfter: number;
    costPerUnit: number;
  }[];
};

const EXPIRY_SOON_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Picks the batch a product-level operation (adjustStock/update) should act on,
 * and the batch treatment consumption should draw from first: earliest-expiry
 * among in-stock batches (FIFO, INV-05), falling back to the most recently
 * created batch when nothing is in stock (so a zero-stock product still shows a
 * sensible representative purchase/expiry pair).
 */
function selectRepresentativeBatch(
  batches: MedicineBatch[],
): MedicineBatch | null {
  if (batches.length === 0) return null;
  const inStock = batches
    .filter((b) => b.currentStock > 0)
    .sort(
      (a, b) =>
        a.expiryDate.getTime() - b.expiryDate.getTime() ||
        a.id.localeCompare(b.id),
    );
  if (inStock.length > 0) return inStock[0];
  return [...batches].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
}

/**
 * Inventory → Medicine tab (PRD §15.2, RAKHAL-074). RAKHAL-434/435
 * (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) split the batch/lot data off `Medicine`
 * (now the catalog/product row) onto `MedicineBatch` (one row per purchase).
 * `Medicine.currentStock`/`costPerUnit`/`purchaseDate`/`expiryDate`/`batchId`
 * stay on the row as a synced summary (`syncMedicineAggregate`) — a mirror of
 * its representative batch / total stock — so `GET /inventory/medicines` keeps
 * its exact pre-435 shape and every out-of-lane consumer that still reads those
 * columns directly (dashboard/reports low-stock+valuation, RAKHAL-438) keeps
 * working unchanged until it's migrated onto `MedicineBatch` itself.
 *
 * Farm scoping: `farmId` is supplied by the controller from the verified token
 * context (`FarmContextGuard`), so it is trusted here and every query is scoped
 * to it. Enforces INV-01 (expiry after purchase) and INV-02 (stock never
 * negative); stock changes are audited via MedicineStockMovement.
 */
@Injectable()
export class MedicineService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly media: MediaService,
    logger: LoggerService,
    private readonly activity: InventoryActivityService,
  ) {
    this.log = logger.setContext(MedicineService.name);
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateMedicineDto,
  ): Promise<PresentedMedicine> {
    const purchaseDate = new Date(dto.purchaseDate);
    const expiryDate = new Date(dto.expiryDate);
    this.assertExpiryAfterPurchase(purchaseDate, expiryDate);

    try {
      const medicine = await this.prisma.$transaction(async (tx) => {
        const created = await tx.medicine.create({
          data: {
            farmId,
            name: dto.name,
            imageUrl: dto.imageUrl,
            type: dto.type,
            category: dto.category,
            manufacturer: dto.manufacturer,
            batchId: dto.batchId,
            unitId: dto.unitId,
            currentStock: dto.currentStock,
            costPerUnit: dto.costPerUnit,
            lowStockThreshold: dto.lowStockThreshold ?? 0,
            purchaseDate,
            expiryDate,
            milkWithdrawalDays: dto.milkWithdrawalDays ?? 0,
            meatWithdrawalDays: dto.meatWithdrawalDays ?? 0,
            notes: dto.notes,
            createdBy: userId,
          },
          include: { unit: true },
        });

        const batch = await tx.medicineBatch.create({
          data: {
            medicineId: created.id,
            farmId,
            batchCode: dto.batchId,
            currentStock: dto.currentStock,
            costPerUnit: dto.costPerUnit,
            purchaseDate,
            expiryDate,
            createdBy: userId,
          },
        });

        if (dto.currentStock > 0) {
          await tx.medicineStockMovement.create({
            data: {
              medicineId: created.id,
              medicineBatchId: batch.id,
              farmId,
              reason: MedicineStockMovementReason.PURCHASE,
              delta: dto.currentStock,
              balanceAfter: dto.currentStock,
              createdBy: userId,
              notes: 'Opening stock',
            },
          });
        }

        return created;
      });

      this.log.info('Medicine created', { medicineId: medicine.id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Medicine Added',
        `Medicine "${medicine.name}" added — stock ${medicine.currentStock} ${medicine.unit.symbol}.`,
      );
      return this.presentOne(medicine);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Medicine batch already exists');
      }
      throw error;
    }
  }

  /**
   * Catalog row only, **zero stock, no batch** — for a caller that owns the transaction and will
   * immediately add the first lot itself (`PurchaseService`'s inline `newItem`, Business UX Phase 2).
   * Creating the row with stock here would put units on the shelf with no ledger posting; the purchase
   * then adds the real lot through `createBatch(..., tx)` so stock and journal stay one atomic unit.
   * `purchaseDate`/`expiryDate`/`costPerUnit` are placeholders the purchase's own batch overwrites via
   * `syncMedicineAggregate`. No Activity Log entry — the purchase owns the audit trail.
   */
  async createCatalogRowInTx(
    farmId: string,
    userId: string,
    input: {
      name: string;
      type: MedicineType;
      category: MedicineCategory;
      unitId: string;
      manufacturer?: string;
      lowStockThreshold?: number;
      milkWithdrawalDays?: number;
      meatWithdrawalDays?: number;
      notes?: string;
      purchaseDate: Date;
      expiryDate: Date;
      costPerUnit: number;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    this.assertExpiryAfterPurchase(input.purchaseDate, input.expiryDate);
    const created = await tx.medicine.create({
      data: {
        farmId,
        name: input.name,
        type: input.type,
        category: input.category,
        manufacturer: input.manufacturer,
        unitId: input.unitId,
        currentStock: 0,
        costPerUnit: input.costPerUnit,
        lowStockThreshold: input.lowStockThreshold ?? 0,
        purchaseDate: input.purchaseDate,
        expiryDate: input.expiryDate,
        milkWithdrawalDays: input.milkWithdrawalDays ?? 0,
        meatWithdrawalDays: input.meatWithdrawalDays ?? 0,
        notes: input.notes,
        createdBy: userId,
      },
      select: { id: true },
    });
    return created;
  }

  /**
   * Restock an existing product with a new lot (RAKHAL-434's problem #1 — buying
   * two lots of the same drug no longer means re-typing the catalog fields into
   * a second full `Medicine` row). Resyncs the parent's mirrored summary fields.
   */
  /**
   * `tx` (RAKHAL-436) lets a caller — `PurchaseService`'s medicine purchase
   * line — fold this write into its own atomic transaction, same tx-seam
   * pattern as `adjustStock`.
   */
  async createBatch(
    farmId: string,
    userId: string,
    medicineId: string,
    dto: CreateMedicineBatchDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PresentedMedicine & { batchId: string }> {
    await this.getOrThrow(farmId, medicineId, tx ?? this.prisma);

    const purchaseDate = new Date(dto.purchaseDate);
    const expiryDate = new Date(dto.expiryDate);
    this.assertExpiryAfterPurchase(purchaseDate, expiryDate);

    const write = async (client: Prisma.TransactionClient) => {
      const batch = await client.medicineBatch.create({
        data: {
          medicineId,
          farmId,
          batchCode: dto.batchCode,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          purchaseDate,
          expiryDate,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      if (dto.currentStock > 0) {
        await client.medicineStockMovement.create({
          data: {
            medicineId,
            medicineBatchId: batch.id,
            farmId,
            reason: MedicineStockMovementReason.PURCHASE,
            delta: dto.currentStock,
            balanceAfter: dto.currentStock,
            createdBy: userId,
            notes: 'Opening stock (new batch)',
          },
        });
      }

      await this.syncMedicineAggregate(client, medicineId);
      const medicine = await client.medicine.findUniqueOrThrow({
        where: { id: medicineId },
        include: { unit: true },
      });
      return { medicine, batchId: batch.id };
    };

    const { medicine, batchId } = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    this.log.info('Medicine batch created', { medicineId, batchId, farmId });
    // Only the direct (UI) path logs; a caller passing `tx` (purchasing) owns its own audit trail.
    if (!tx) {
      await this.activity.record(
        farmId,
        userId,
        'Medicine Batch Added',
        `New batch${dto.batchCode ? ` "${dto.batchCode}"` : ''} of "${medicine.name}" added — ${dto.currentStock} ${medicine.unit.symbol}.`,
      );
    }
    const presented = await this.presentOne(medicine);
    return { ...presented, batchId };
  }

  async findAll(
    farmId: string,
    query: ListMedicineQueryDto,
  ): Promise<CursorPage<PresentedMedicine>> {
    const where: Prisma.MedicineWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.category ? { category: query.category } : {}),
      ...this.statusFilter(query.status),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { batchId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.medicine.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      include: { unit: true },
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: await this.presentList(farmId, page.items),
      meta: page.meta,
    };
  }

  async findOne(farmId: string, id: string): Promise<PresentedMedicine> {
    return this.presentOne(await this.getOrThrow(farmId, id));
  }

  /**
   * Real batch lookup across the whole farm (RAKHAL-434 problem #2 / RAKHAL-439)
   * — "show me every remaining vial tagged LOT-4471" for a manufacturer
   * recall, regardless of which product it's filed under. `MedicineBatch.
   * batchCode` is indexed (unlike the old bare `Medicine.batchId` text
   * `contains` this replaces).
   */
  async findByBatchCode(
    farmId: string,
    code: string,
  ): Promise<
    {
      batchId: string;
      batchCode: string | null;
      medicineId: string;
      medicineName: string;
      currentStock: number;
      costPerUnit: number;
      purchaseDate: Date;
      expiryDate: Date;
      unit: string;
    }[]
  > {
    const batches = await this.prisma.medicineBatch.findMany({
      where: {
        farmId,
        deletedAt: null,
        batchCode: { contains: code, mode: 'insensitive' },
      },
      include: { medicine: { include: { unit: true } } },
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    });
    return batches.map((b) => ({
      batchId: b.id,
      batchCode: b.batchCode,
      medicineId: b.medicineId,
      medicineName: b.medicine.name,
      currentStock: b.currentStock,
      costPerUnit: b.costPerUnit,
      purchaseDate: b.purchaseDate,
      expiryDate: b.expiryDate,
      unit: b.medicine.unit.symbol,
    }));
  }

  async update(
    farmId: string,
    id: string,
    dto: UpdateMedicineDto,
    userId?: string,
  ): Promise<PresentedMedicine> {
    const existing = await this.getOrThrow(farmId, id);

    const purchaseDate = dto.purchaseDate
      ? new Date(dto.purchaseDate)
      : existing.purchaseDate;
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : existing.expiryDate;
    this.assertExpiryAfterPurchase(purchaseDate, expiryDate);

    const touchesBatchFields =
      dto.costPerUnit !== undefined ||
      dto.purchaseDate !== undefined ||
      dto.expiryDate !== undefined ||
      dto.batchId !== undefined;

    try {
      const medicine = await this.prisma.$transaction(async (tx) => {
        await tx.medicine.update({
          where: { id },
          data: {
            name: dto.name,
            imageUrl: dto.imageUrl,
            type: dto.type,
            category: dto.category,
            manufacturer: dto.manufacturer,
            batchId: dto.batchId,
            unitId: dto.unitId,
            costPerUnit: dto.costPerUnit,
            lowStockThreshold: dto.lowStockThreshold,
            ...(dto.purchaseDate ? { purchaseDate } : {}),
            ...(dto.expiryDate ? { expiryDate } : {}),
            milkWithdrawalDays: dto.milkWithdrawalDays,
            meatWithdrawalDays: dto.meatWithdrawalDays,
            notes: dto.notes,
          },
        });

        // `update()` is a product-level edit; when it touches lot-specific
        // fields (cost/purchase/expiry/batch code) those apply to this
        // product's representative (FIFO-first) batch — a multi-batch,
        // per-lot edit UI is Phase 2 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`).
        if (touchesBatchFields) {
          const batch = await this.loadRepresentativeBatch(tx, existing);
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: {
              ...(dto.batchId !== undefined ? { batchCode: dto.batchId } : {}),
              ...(dto.costPerUnit !== undefined
                ? { costPerUnit: dto.costPerUnit }
                : {}),
              ...(dto.purchaseDate ? { purchaseDate } : {}),
              ...(dto.expiryDate ? { expiryDate } : {}),
            },
          });
          await this.syncMedicineAggregate(tx, id);
        }

        return tx.medicine.findUniqueOrThrow({
          where: { id },
          include: { unit: true },
        });
      });

      this.log.info('Medicine updated', { medicineId: id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Medicine Updated',
        `Medicine "${medicine.name}" updated.`,
      );
      return this.presentOne(medicine);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Medicine batch already exists');
      }
      throw error;
    }
  }

  /**
   * Apply a signed stock delta and record an audit movement, atomically, on
   * this product's representative batch. Rejects adjustments that would drive
   * that batch's stock below zero (INV-02).
   */
  /**
   * `tx` lets a caller (e.g. a future atomic sale/purchase use case, RAKHAL-341)
   * fold this write into its own transaction, so a caller-side failure rolls
   * back the stock change and its audit movement together instead of leaving
   * them out of sync — mirrors `milkTankService.adjustVolume`.
   */
  async adjustStock(
    farmId: string,
    userId: string,
    id: string,
    dto: AdjustStockDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PresentedMedicine> {
    const existing = await this.getOrThrow(farmId, id);

    if (dto.adjustment === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }

    const write = async (client: Prisma.TransactionClient) => {
      const batch = await this.loadRepresentativeBatch(client, existing);
      const balanceAfter = batch.currentStock + dto.adjustment;
      if (balanceAfter < 0) {
        throw new BadRequestException('Stock cannot go below zero');
      }

      await client.medicineBatch.update({
        where: { id: batch.id },
        data: { currentStock: balanceAfter },
      });
      await client.medicineStockMovement.create({
        data: {
          medicineId: id,
          medicineBatchId: batch.id,
          farmId,
          reason: dto.reason,
          delta: dto.adjustment,
          balanceAfter,
          notes: dto.notes,
          saleLineId: dto.saleLineId ?? null,
          createdBy: userId,
        },
      });
      await this.syncMedicineAggregate(client, id);
      return client.medicine.findUniqueOrThrow({
        where: { id },
        include: { unit: true },
      });
    };

    const medicine = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    this.log.info('Medicine stock adjusted', {
      medicineId: id,
      farmId,
      delta: dto.adjustment,
      balanceAfter: medicine.currentStock,
    });

    await this.maybeAlertLowStock(
      farmId,
      medicine.name,
      medicine.lowStockThreshold,
      existing.currentStock,
      medicine.currentStock,
    );
    return this.presentOne(medicine);
  }

  /** Manual stock adjustment from the Inventory UI — logged to the Activity Log. Treatment,
   * sale and purchase flows call `adjustStock` directly and log their own events. */
  async adjustStockManual(
    farmId: string,
    userId: string,
    id: string,
    dto: AdjustStockDto,
  ): Promise<PresentedMedicine> {
    const medicine = await this.adjustStock(farmId, userId, id, dto);
    const sign = dto.adjustment > 0 ? '+' : '';
    await this.activity.record(
      farmId,
      userId,
      'Medicine Stock Adjusted',
      `Medicine "${medicine.name}" stock adjusted ${sign}${dto.adjustment} ${medicine.unit.symbol} (${dto.reason})${dto.notes ? ` — ${dto.notes}` : ''}.`,
    );
    return medicine;
  }

  /**
   * Consume medicine stock for a treatment (HLT-07). The integration point the
   * Healthcare `logTreatment` flow calls. Resolves the batch(es) to draw from —
   * either the given `medicineId`'s own batches, or, given only a
   * `medicineName`, every non-deleted catalog row matching that name — FIFO
   * across every earliest-expiry-first non-expired in-stock batch (INV-05),
   * **splitting the dose across multiple batches** when the first one can't
   * cover the full quantity (RD-003). Enforces expired-blocked (HLT-02) and the
   * never-negative floor (INV-02); all batch updates + movements commit in one
   * transaction (all-or-nothing).
   */
  async decrementForTreatment(
    farmId: string,
    userId: string,
    opts: {
      medicineId?: string;
      medicineName?: string;
      quantity: number;
      /** Protocols v2: unit `quantity` is expressed in; converted to the medicine's own unit. Omit = already in it. */
      doseUnitId?: string;
      notes?: string;
    },
  ): Promise<DecrementResult> {
    if (!opts.quantity || opts.quantity <= 0) {
      throw new BadRequestException(
        'Treatment quantity must be greater than 0',
      );
    }

    let medicines: Medicine[];
    if (opts.medicineId) {
      medicines = [await this.getOrThrow(farmId, opts.medicineId)];
    } else {
      if (!opts.medicineName) {
        throw new BadRequestException(
          'A medicineId or medicineName is required to deduct treatment stock',
        );
      }
      medicines = await this.prisma.medicine.findMany({
        where: {
          farmId,
          deletedAt: null,
          name: { equals: opts.medicineName, mode: 'insensitive' },
        },
      });
      if (medicines.length === 0) {
        throw new BadRequestException(
          `No in-stock, non-expired batch found for medicine "${opts.medicineName}"`,
        );
      }
    }

    let quantity = opts.quantity;
    if (opts.doseUnitId) {
      const [doseUnit, medUnit] = await Promise.all([
        this.prisma.unit.findUnique({ where: { id: opts.doseUnitId } }),
        this.prisma.unit.findUnique({ where: { id: medicines[0].unitId } }),
      ]);
      if (doseUnit && medUnit) {
        try {
          quantity = convertQuantity(quantity, doseUnit, medUnit);
        } catch {
          throw new BadRequestException(
            `Dose unit ${doseUnit.symbol} cannot be converted to the stock unit ${medUnit.symbol}`,
          );
        }
      }
    }

    return this.decrementFromCatalogBatches(
      farmId,
      userId,
      medicines,
      quantity,
      {
        reason: MedicineStockMovementReason.TREATMENT,
        notes: opts.notes,
        defaultNoteLabel: 'Treatment administered',
        excludeExpired: true,
        insufficientStockMessage:
          'Not enough medicine stock for this treatment',
        noBatchMessage:
          'No in-stock, non-expired batch found for this medicine',
      },
    );
  }

  /**
   * Consume medicine stock for a Sale (RAKHAL-437, `docs/EPIC_MEDICINE_BATCH_MODEL.md`) — same
   * FIFO-batch-pick + split behavior `decrementForTreatment` uses, so a sale the product's summed
   * stock covers doesn't fail just because one particular batch alone falls short — a real gap
   * `adjustStock`'s single-batch semantics had once a product could carry more than one batch.
   * Unlike treatment consumption, an expired batch is still sellable here (no clinical concern for
   * a sale/write-off) — matches `adjustStock`'s own prior behavior, no expiry check either. `tx`
   * (RAKHAL-341's seam) lets `SellInventoryUseCase` fold this into its own atomic transaction.
   */
  async decrementForSale(
    farmId: string,
    userId: string,
    opts: {
      medicineId: string;
      quantity: number;
      saleLineId: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<DecrementResult> {
    if (!opts.quantity || opts.quantity <= 0) {
      throw new BadRequestException('Sale quantity must be greater than 0');
    }
    const medicine = await this.getOrThrow(farmId, opts.medicineId);
    return this.decrementFromCatalogBatches(
      farmId,
      userId,
      [medicine],
      opts.quantity,
      {
        reason: MedicineStockMovementReason.SALE,
        saleLineId: opts.saleLineId,
        notes: opts.notes,
        defaultNoteLabel: 'Sold via SellInventoryItem',
        excludeExpired: false,
        insufficientStockMessage: 'Insufficient stock for this sale',
        noBatchMessage: 'No in-stock batch found for this medicine',
      },
      tx,
    );
  }

  /**
   * Applies a signed delta to one *specific* batch by id (RAKHAL-439) — unlike
   * `adjustStock`, which resolves "the" batch via the FIFO-representative
   * heuristic, this acts on exactly the batch the caller names. Used by
   * `VoidDocumentUseCase`'s purchase reversal, which (via `PurchaseLine.
   * medicineBatchId`) always knows precisely which lot a voided purchase
   * created. `tx` folds this into the caller's own transaction.
   */
  async adjustBatchStock(
    farmId: string,
    userId: string,
    medicineBatchId: string,
    delta: number,
    reason: MedicineStockMovementReason,
    notes: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const write = async (client: Prisma.TransactionClient) => {
      const batch = await client.medicineBatch.findFirst({
        where: { id: medicineBatchId, farmId, deletedAt: null },
      });
      if (!batch) {
        throw new NotFoundException('Medicine batch not found');
      }
      const balanceAfter = batch.currentStock + delta;
      if (balanceAfter < 0) {
        throw new BadRequestException('Stock cannot go below zero');
      }
      await client.medicineBatch.update({
        where: { id: batch.id },
        data: { currentStock: balanceAfter },
      });
      await client.medicineStockMovement.create({
        data: {
          medicineId: batch.medicineId,
          medicineBatchId: batch.id,
          farmId,
          reason,
          delta,
          balanceAfter,
          notes,
          createdBy: userId,
        },
      });
      await this.syncMedicineAggregate(client, batch.medicineId);
    };
    if (tx) {
      await write(tx);
    } else {
      await this.prisma.$transaction((t) => write(t));
    }
  }

  /**
   * Restores stock for a voided sale (RAKHAL-439) — unlike a purchase (one
   * line, one batch, precisely linked via `PurchaseLine.medicineBatchId`), a
   * sale can have split across multiple batches (RAKHAL-437), so this reads
   * back every `SALE`-reason `MedicineStockMovement` the original sale line
   * caused (`MedicineStockMovement.saleLineId`, already precise per-batch) and
   * reverses each exactly — correct even for a split sale. Falls back to the
   * old representative-batch `adjustStock` behavior only when no batch-linked
   * movement is found (a pre-437 sale line, or something the caller wants
   * force-restocked with no history — `fallbackMedicineId`/`fallbackQuantity`
   * cover that case).
   */
  async restoreForSaleVoid(
    farmId: string,
    userId: string,
    opts: {
      saleLineId: string;
      fallbackMedicineId: string;
      fallbackQuantity: number;
      notes: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const write = async (client: Prisma.TransactionClient) => {
      const movements = await client.medicineStockMovement.findMany({
        where: {
          farmId,
          saleLineId: opts.saleLineId,
          reason: MedicineStockMovementReason.SALE,
          medicineBatchId: { not: null },
        },
      });

      if (movements.length === 0) {
        // Pre-437 sale line (no batch-linked movement) — same approximate
        // representative-batch restock `adjustStock` always did.
        return false;
      }

      const affectedMedicineIds = new Set<string>();
      for (const movement of movements) {
        const batch = await client.medicineBatch.findFirst({
          where: { id: movement.medicineBatchId!, farmId },
        });
        if (!batch) continue;
        const restored = Math.abs(movement.delta);
        const balanceAfter = batch.currentStock + restored;
        await client.medicineBatch.update({
          where: { id: batch.id },
          data: { currentStock: balanceAfter },
        });
        await client.medicineStockMovement.create({
          data: {
            medicineId: batch.medicineId,
            medicineBatchId: batch.id,
            farmId,
            reason: MedicineStockMovementReason.ADJUSTMENT,
            delta: restored,
            balanceAfter,
            notes: opts.notes,
            saleLineId: opts.saleLineId,
            createdBy: userId,
          },
        });
        affectedMedicineIds.add(batch.medicineId);
      }
      for (const medicineId of affectedMedicineIds) {
        await this.syncMedicineAggregate(client, medicineId);
      }
      return movements.length > 0;
    };

    const restoredPrecisely = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    if (!restoredPrecisely) {
      await this.adjustStock(
        farmId,
        userId,
        opts.fallbackMedicineId,
        {
          adjustment: opts.fallbackQuantity,
          reason: MedicineStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
          saleLineId: opts.saleLineId,
        },
        tx,
      );
    }
  }

  /**
   * Protocols v2 undo — gives a voided treatment's stock back. Reads the `TREATMENT` movements stamped with the log's id
   * (`MedicineStockMovement.treatmentLogId`, precise per batch, correct for a cross-batch split) and reverses each one.
   * A pre-undo log has no stamped movements: `fallbackMedicineId` + `fallbackQuantity` restock the product's
   * representative batch instead (same approximate fallback `restoreForSaleVoid` uses). Idempotent: movements already
   * reversed (an ADJUSTMENT row carrying the same `treatmentLogId`) are not reversed twice.
   */
  async restoreForTreatmentVoid(
    farmId: string,
    userId: string,
    opts: {
      treatmentLogId: string;
      fallbackMedicineId?: string | null;
      fallbackQuantity?: number | null;
      notes: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<{ restored: boolean }> {
    const write = async (client: Prisma.TransactionClient) => {
      const movements = await client.medicineStockMovement.findMany({
        where: {
          farmId,
          treatmentLogId: opts.treatmentLogId,
          medicineBatchId: { not: null },
        },
      });
      const consumed = movements.filter((m) => m.delta < 0);
      const alreadyRestored = movements.some((m) => m.delta > 0);
      if (consumed.length === 0) return 'none' as const;
      if (alreadyRestored) return 'done' as const;

      const affectedMedicineIds = new Set<string>();
      for (const movement of consumed) {
        const batch = await client.medicineBatch.findFirst({
          where: { id: movement.medicineBatchId!, farmId },
        });
        if (!batch) continue;
        const restored = Math.abs(movement.delta);
        const balanceAfter = batch.currentStock + restored;
        await client.medicineBatch.update({
          where: { id: batch.id },
          data: { currentStock: balanceAfter },
        });
        await client.medicineStockMovement.create({
          data: {
            medicineId: batch.medicineId,
            medicineBatchId: batch.id,
            farmId,
            reason: MedicineStockMovementReason.ADJUSTMENT,
            delta: restored,
            balanceAfter,
            notes: opts.notes,
            treatmentLogId: opts.treatmentLogId,
            createdBy: userId,
          },
        });
        affectedMedicineIds.add(batch.medicineId);
      }
      for (const medicineId of affectedMedicineIds) {
        await this.syncMedicineAggregate(client, medicineId);
      }
      return 'restored' as const;
    };

    const outcome = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));
    if (outcome === 'restored') return { restored: true };
    if (outcome === 'done') return { restored: false };

    if (
      opts.fallbackMedicineId &&
      opts.fallbackQuantity &&
      opts.fallbackQuantity > 0
    ) {
      await this.adjustStock(
        farmId,
        userId,
        opts.fallbackMedicineId,
        {
          adjustment: opts.fallbackQuantity,
          reason: MedicineStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
        },
        tx,
      );
      return { restored: true };
    }
    return { restored: false };
  }

  /**
   * FIFO-by-lot draw across every non-expired-by-default (see `excludeExpired`)
   * in-stock `MedicineBatch` owned by any of `medicines` (one catalog row for
   * an explicit id, several for a by-name treatment match) — earliest expiry
   * first, drawing as much as each batch can cover before moving to the next,
   * splitting when one alone is insufficient. Throws if the combined stock
   * across every eligible batch still can't cover the quantity; nothing is
   * written. `tx` (when given) is used for every read/write so this folds into
   * the caller's own transaction (`decrementForSale`); omitted, it opens/uses
   * its own (`decrementForTreatment`'s existing, deliberate "outside the
   * caller's writing transaction" convention).
   */
  private async decrementFromCatalogBatches(
    farmId: string,
    userId: string,
    medicines: Medicine[],
    quantity: number,
    opts: {
      reason: MedicineStockMovementReason;
      notes?: string;
      defaultNoteLabel: string;
      excludeExpired: boolean;
      insufficientStockMessage: string;
      noBatchMessage: string;
      saleLineId?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<DecrementResult> {
    const medicineById = new Map(medicines.map((m) => [m.id, m]));

    // Self-heal is idempotent and independent of the caller's own tx — once
    // committed here it's immediately visible to `tx`'s later reads too.
    await this.prisma.$transaction(async (heal) => {
      for (const medicine of medicines) {
        await this.ensureBatchExists(heal, medicine);
      }
    });

    const readClient = tx ?? this.prisma;
    const batches = await readClient.medicineBatch.findMany({
      where: {
        medicineId: { in: [...medicineById.keys()] },
        farmId,
        deletedAt: null,
        currentStock: { gt: 0 },
        ...(opts.excludeExpired ? { expiryDate: { gte: new Date() } } : {}),
      },
      // FIFO: earliest expiry first (INV-05).
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    });

    if (batches.length === 0) {
      throw new BadRequestException(opts.noBatchMessage);
    }

    const totalAvailable = batches.reduce(
      (sum, batch) => sum + batch.currentStock,
      0,
    );
    if (totalAvailable < quantity) {
      throw new BadRequestException(opts.insufficientStockMessage);
    }

    let remaining = quantity;
    const plan: { batch: MedicineBatch; draw: number; balanceAfter: number }[] =
      [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const draw = Math.min(batch.currentStock, remaining);
      plan.push({ batch, draw, balanceAfter: batch.currentStock - draw });
      remaining -= draw;
    }

    const isSplit = plan.length > 1;
    const affectedMedicineIds = [
      ...new Set(plan.map((p) => p.batch.medicineId)),
    ];

    const movementIds: string[] = [];
    const write = async (client: Prisma.TransactionClient) => {
      for (const { batch, draw, balanceAfter } of plan) {
        await client.medicineBatch.update({
          where: { id: batch.id },
          data: { currentStock: balanceAfter },
        });
        const movement = await client.medicineStockMovement.create({
          data: {
            medicineId: batch.medicineId,
            medicineBatchId: batch.id,
            farmId,
            reason: opts.reason,
            delta: -draw,
            balanceAfter,
            notes: isSplit
              ? `${opts.notes ?? opts.defaultNoteLabel} (cross-batch split: ${draw} of ${quantity})`
              : (opts.notes ?? opts.defaultNoteLabel),
            saleLineId: opts.saleLineId ?? null,
            createdBy: userId,
          },
        });
        movementIds.push(movement.id);
      }
      for (const medicineId of affectedMedicineIds) {
        await this.syncMedicineAggregate(client, medicineId);
      }
    };
    if (tx) {
      await write(tx);
    } else {
      await this.prisma.$transaction((t) => write(t));
    }

    this.log.info('Medicine decremented', {
      farmId,
      quantity,
      reason: opts.reason,
      batchesUsed: plan.map((p) => p.batch.id),
      split: isSplit,
    });

    const freshMedicines = await readClient.medicine.findMany({
      where: { id: { in: affectedMedicineIds } },
    });
    for (const fresh of freshMedicines) {
      const before = medicineById.get(fresh.id)!;
      await this.maybeAlertLowStock(
        farmId,
        fresh.name,
        fresh.lowStockThreshold,
        before.currentStock,
        fresh.currentStock,
      );
    }

    const primary = plan[0];
    const totalCost = plan.reduce(
      (sum, { batch, draw }) => sum + batch.costPerUnit * draw,
      0,
    );
    return {
      medicineId: primary.batch.medicineId,
      batchId: primary.batch.batchCode,
      balanceAfter: primary.balanceAfter,
      costPerUnit: primary.batch.costPerUnit,
      totalCost,
      movementIds,
      batchesUsed: plan.map(({ batch, draw, balanceAfter }) => ({
        medicineId: batch.medicineId,
        batchId: batch.batchCode,
        quantity: draw,
        balanceAfter,
        costPerUnit: batch.costPerUnit,
      })),
    };
  }

  // Low Medicine Stock alert (PRD §20.2) — fire only on the downward crossing
  // (was above the threshold, now at/below) so it doesn't spam every dose.
  private async maybeAlertLowStock(
    farmId: string,
    medicineName: string,
    threshold: number,
    totalBefore: number,
    totalAfter: number,
  ): Promise<void> {
    if (threshold > 0 && totalBefore > threshold && totalAfter <= threshold) {
      await this.notificationService.notifyOwnersAndManagers({
        farmId,
        eventKey: 'low_medicine_stock',
        title: 'Low Medicine Stock',
        message: `${medicineName} is low: ${totalAfter} left (alert threshold ${threshold}).`,
        params: {
          name: medicineName,
          balance: totalAfter,
          threshold,
        },
        link: '/inventory/medicine',
      });
    }
  }

  async archive(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { unit: true },
    });
    this.log.info('Medicine archived', { medicineId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Medicine Archived',
      `Medicine "${medicine.name}" archived.`,
    );
    return this.presentOne(medicine);
  }

  async restore(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { deletedAt: null },
      include: { unit: true },
    });
    this.log.info('Medicine restored', { medicineId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Medicine Restored',
      `Medicine "${medicine.name}" restored.`,
    );
    return this.presentOne(medicine);
  }

  /** Soft-delete (archive). Hard delete is avoided so treatment history stays intact (INV-06). */
  async remove(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedMedicine> {
    return this.archive(farmId, id, userId);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. Same shape as
   * `FeedConcentrationService.removeMany`. */
  async removeMany(
    farmId: string,
    ids: string[],
    userId?: string,
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.medicine.updateMany({
      where: { farmId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.log.info('Medicines bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    if (result.count > 0) {
      await this.activity.record(
        farmId,
        userId,
        'Medicines Bulk Archived',
        `${result.count} medicine(s) archived.`,
      );
    }
    return { deleted: result.count };
  }

  /** Product-photo upload (RAKHAL-074 follow-up) — same `MediaService`/private-R2 pattern as
   * `CattleService#setProfilePhoto`: process+store via `MediaService.uploadImage`, point
   * `photoAssetId` at the new asset, soft-delete the previous one if replacing. */
  async setPhoto(
    farmId: string,
    userId: string,
    id: string,
    file: { buffer: Buffer; originalname?: string; size?: number },
  ): Promise<MediaUrls> {
    const medicine = await this.getOrThrow(farmId, id);
    const asset = await this.media.uploadImage({
      farmId,
      uploadedByUserId: userId,
      category: MediaCategory.MEDICINE,
      usage: MediaUsage.PRODUCT_PHOTO,
      file,
    });
    const previousId = medicine.photoAssetId;
    await this.prisma.medicine.update({
      where: { id },
      data: { photoAssetId: asset.id },
    });
    if (previousId && previousId !== asset.id) {
      await this.media
        .softDeleteById(farmId, previousId, userId)
        .catch(() => undefined);
    }
    this.log.info('Medicine photo uploaded', { medicineId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Medicine Photo Updated',
      `Photo ${previousId ? 'replaced' : 'added'} for medicine "${medicine.name}".`,
    );
    return this.media.signUrls(asset, true);
  }

  async getPhoto(farmId: string, id: string): Promise<MediaUrls | null> {
    const medicine = await this.getOrThrow(farmId, id);
    if (!medicine.photoAssetId) return null;
    return this.media.presentUrls(farmId, medicine.photoAssetId, true);
  }

  async removePhoto(
    farmId: string,
    userId: string,
    id: string,
  ): Promise<{ removed: boolean }> {
    const medicine = await this.getOrThrow(farmId, id);
    if (!medicine.photoAssetId) return { removed: false };
    await this.prisma.medicine.update({
      where: { id },
      data: { photoAssetId: null },
    });
    await this.media
      .softDeleteById(farmId, medicine.photoAssetId, userId)
      .catch(() => undefined);
    this.log.info('Medicine photo removed', { medicineId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Medicine Photo Removed',
      `Photo removed from medicine "${medicine.name}".`,
    );
    return { removed: true };
  }

  private async getOrThrow(
    farmId: string,
    id: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<MedicineWithUnit> {
    const medicine = await client.medicine.findFirst({
      where: { id, farmId },
      include: { unit: true },
    });
    if (!medicine) {
      this.log.warn('Medicine not found', { medicineId: id, farmId });
      throw new NotFoundException('Medicine not found');
    }
    return medicine;
  }

  /** Recomputes `Medicine`'s mirrored summary columns from its live batches —
   * `currentStock` is the sum across every non-deleted batch; `costPerUnit`/
   * `purchaseDate`/`expiryDate`/`batchId` mirror the representative (FIFO-first)
   * batch. Called inside the same transaction as any batch write so the two
   * tables never observably diverge. */
  private async syncMedicineAggregate(
    client: Prisma.TransactionClient,
    medicineId: string,
  ): Promise<void> {
    const batches = await client.medicineBatch.findMany({
      where: { medicineId, deletedAt: null },
    });
    const totalStock = batches.reduce((sum, b) => sum + b.currentStock, 0);
    const representative = selectRepresentativeBatch(batches);

    await client.medicine.update({
      where: { id: medicineId },
      data: {
        currentStock: totalStock,
        ...(representative
          ? {
              costPerUnit: representative.costPerUnit,
              purchaseDate: representative.purchaseDate,
              expiryDate: representative.expiryDate,
              batchId: representative.batchCode,
            }
          : {}),
      },
    });
  }

  private async loadRepresentativeBatch(
    client: Prisma.TransactionClient,
    medicine: Medicine,
  ): Promise<MedicineBatch> {
    await this.ensureBatchExists(client, medicine);
    const batches = await client.medicineBatch.findMany({
      where: { medicineId: medicine.id, deletedAt: null },
    });
    // Guaranteed non-null: ensureBatchExists just materialized one if none existed.
    return selectRepresentativeBatch(batches)!;
  }

  /** Self-heals a `Medicine` row that predates (or bypassed, e.g. a raw test
   * fixture) `MedicineService.create()` and so has never had a batch — the same
   * 1:1 split RAKHAL-434's backfill script performs, applied lazily on first
   * batch-scoped write instead of only once at migration time. No-op once a
   * batch exists. */
  private async ensureBatchExists(
    client: Prisma.TransactionClient,
    medicine: Medicine,
  ): Promise<void> {
    const count = await client.medicineBatch.count({
      where: { medicineId: medicine.id, deletedAt: null },
    });
    if (count > 0) return;

    await client.medicineBatch.create({
      data: {
        medicineId: medicine.id,
        farmId: medicine.farmId,
        batchCode: medicine.batchId,
        currentStock: medicine.currentStock,
        costPerUnit: medicine.costPerUnit,
        purchaseDate: medicine.purchaseDate,
        expiryDate: medicine.expiryDate,
        createdBy: medicine.createdBy,
      },
    });
  }

  private statusFilter(
    status: ListMedicineQueryDto['status'],
  ): Prisma.MedicineWhereInput {
    if (!status) return {};
    const now = new Date();

    if (status === 'expired') {
      return { expiryDate: { lt: now } };
    }
    if (status === 'expiring_soon') {
      return {
        expiryDate: { gte: now, lte: new Date(now.getTime() + EXPIRY_SOON_MS) },
      };
    }
    // active
    return { expiryDate: { gte: now } };
  }

  /** Single-resource presentation — resolves `photoAssetId` to a signed thumb URL (falling back to
   * the legacy plain-string `imageUrl` column when there's no uploaded photo), same
   * `presentUrls`-per-item pattern as `CattleService#attachDetailPhoto`. */
  private async presentOne(
    medicine: MedicineWithUnit,
  ): Promise<PresentedMedicine> {
    const resolvedImageUrl = medicine.photoAssetId
      ? await this.media
          .presentUrls(medicine.farmId, medicine.photoAssetId, false)
          .then((urls) => urls.thumb_url)
          .catch(() => medicine.imageUrl)
      : medicine.imageUrl;
    return {
      ...medicine,
      imageUrl: resolvedImageUrl,
      stockStatus: computeStockStatus(
        medicine.currentStock,
        medicine.lowStockThreshold,
      ),
      expiryStatus: computeExpiryStatus(medicine.expiryDate),
    };
  }

  /** List presentation — batches every row's `photoAssetId` into one `signThumbs` call (same
   * `CattleService#attachListPhotos` pattern) instead of N individual signing round-trips. */
  private async presentList(
    farmId: string,
    medicines: MedicineWithUnit[],
  ): Promise<PresentedMedicine[]> {
    const ids = medicines
      .map((m) => m.photoAssetId)
      .filter((id): id is string => Boolean(id));
    const signed =
      ids.length > 0
        ? await this.media.signThumbs(farmId, ids)
        : new Map<string, MediaUrls>();
    return medicines.map((medicine) => ({
      ...medicine,
      imageUrl: medicine.photoAssetId
        ? (signed.get(medicine.photoAssetId)?.thumb_url ?? medicine.imageUrl)
        : medicine.imageUrl,
      stockStatus: computeStockStatus(
        medicine.currentStock,
        medicine.lowStockThreshold,
      ),
      expiryStatus: computeExpiryStatus(medicine.expiryDate),
    }));
  }

  private assertExpiryAfterPurchase(
    purchaseDate: Date,
    expiryDate: Date,
  ): void {
    if (expiryDate.getTime() <= purchaseDate.getTime()) {
      throw new BadRequestException(
        'Expiry date must be after the purchase date',
      );
    }
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
