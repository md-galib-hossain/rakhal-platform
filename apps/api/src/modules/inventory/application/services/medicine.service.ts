import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Medicine,
  MediaCategory,
  MediaUsage,
  MedicineStockMovementReason,
  Prisma,
  Unit,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
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
import { CreateMedicineDto } from '../../presentation/dto/create-medicine.dto';
import { ListMedicineQueryDto } from '../../presentation/dto/list-medicine-query.dto';
import { UpdateMedicineDto } from '../../presentation/dto/update-medicine.dto';

/** A medicine row with its `Unit` relation resolved (RAKHAL-326). */
type MedicineWithUnit = Medicine & { unit: Unit };

/** A medicine row enriched with derived stock/expiry status for the API. */
type PresentedMedicine = MedicineWithUnit & {
  stockStatus: StockStatus;
  expiryStatus: ExpiryStatus;
};

const EXPIRY_SOON_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Inventory → Medicine tab (PRD §15.2, RAKHAL-074).
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
      const medicine = await this.prisma.medicine.create({
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
          ...(dto.currentStock > 0
            ? {
                stockMovements: {
                  create: {
                    farmId,
                    reason: MedicineStockMovementReason.PURCHASE,
                    delta: dto.currentStock,
                    balanceAfter: dto.currentStock,
                    createdBy: userId,
                    notes: 'Opening stock',
                  },
                },
              }
            : {}),
        },
        include: { unit: true },
      });

      this.log.info('Medicine created', { medicineId: medicine.id, farmId });
      return this.presentOne(medicine);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Medicine batch already exists');
      }
      throw error;
    }
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

  async update(
    farmId: string,
    id: string,
    dto: UpdateMedicineDto,
  ): Promise<PresentedMedicine> {
    const existing = await this.getOrThrow(farmId, id);

    const purchaseDate = dto.purchaseDate
      ? new Date(dto.purchaseDate)
      : existing.purchaseDate;
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : existing.expiryDate;
    this.assertExpiryAfterPurchase(purchaseDate, expiryDate);

    try {
      const medicine = await this.prisma.medicine.update({
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
        include: { unit: true },
      });

      this.log.info('Medicine updated', { medicineId: id, farmId });
      return this.presentOne(medicine);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Medicine batch already exists');
      }
      throw error;
    }
  }

  /**
   * Apply a signed stock delta and record an audit movement, atomically.
   * Rejects adjustments that would drive stock below zero (INV-02).
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
    const balanceAfter = existing.currentStock + dto.adjustment;

    if (dto.adjustment === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }
    if (balanceAfter < 0) {
      throw new BadRequestException('Stock cannot go below zero');
    }

    const write = async (client: Prisma.TransactionClient) => {
      const updatedMedicine = await client.medicine.update({
        where: { id },
        data: { currentStock: balanceAfter },
        include: { unit: true },
      });
      await client.medicineStockMovement.create({
        data: {
          medicineId: id,
          farmId,
          reason: dto.reason,
          delta: dto.adjustment,
          balanceAfter,
          notes: dto.notes,
          saleLineId: dto.saleLineId ?? null,
          createdBy: userId,
        },
      });
      return updatedMedicine;
    };

    const medicine = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    this.log.info('Medicine stock adjusted', {
      medicineId: id,
      farmId,
      delta: dto.adjustment,
      balanceAfter,
    });
    return this.presentOne(medicine);
  }

  /**
   * Consume medicine stock for a treatment (HLT-07). The integration point the
   * Healthcare `logTreatment` flow calls. Resolves the batch(es) to draw from —
   * either the explicit `medicineId` (single batch, no splitting — the caller
   * chose that specific batch on purpose), or, given only a `medicineName`,
   * FIFO across every earliest-expiry-first non-expired in-stock batch
   * (INV-05), **splitting the dose across multiple batches** when the first
   * one can't cover the full quantity (RD-003). Enforces expired-blocked (HLT-02)
   * and the never-negative floor (INV-02); all batch updates + movements commit
   * in one transaction (all-or-nothing).
   */
  async decrementForTreatment(
    farmId: string,
    userId: string,
    opts: {
      medicineId?: string;
      medicineName?: string;
      quantity: number;
      notes?: string;
    },
  ): Promise<{
    medicineId: string;
    batchId: string | null;
    balanceAfter: number;
    batchesUsed: {
      medicineId: string;
      batchId: string | null;
      quantity: number;
      balanceAfter: number;
    }[];
  }> {
    if (!opts.quantity || opts.quantity <= 0) {
      throw new BadRequestException(
        'Treatment quantity must be greater than 0',
      );
    }

    if (opts.medicineId) {
      return this.decrementSingleBatch(
        farmId,
        userId,
        opts.medicineId,
        opts.quantity,
        opts.notes,
      );
    }

    if (!opts.medicineName) {
      throw new BadRequestException(
        'A medicineId or medicineName is required to deduct treatment stock',
      );
    }

    return this.decrementAcrossBatches(
      farmId,
      userId,
      opts.medicineName,
      opts.quantity,
      opts.notes,
    );
  }

  /** Explicit-batch path: no splitting — the caller chose this exact batch. */
  private async decrementSingleBatch(
    farmId: string,
    userId: string,
    medicineId: string,
    quantity: number,
    notes?: string,
  ): Promise<{
    medicineId: string;
    batchId: string | null;
    balanceAfter: number;
    batchesUsed: {
      medicineId: string;
      batchId: string | null;
      quantity: number;
      balanceAfter: number;
    }[];
  }> {
    const medicine = await this.getOrThrow(farmId, medicineId);

    if (medicine.expiryDate.getTime() < Date.now()) {
      throw new BadRequestException(
        'Cannot administer an expired medicine batch (HLT-02)',
      );
    }

    const balanceAfter = medicine.currentStock - quantity;
    if (balanceAfter < 0) {
      throw new BadRequestException(
        'Not enough medicine stock for this treatment',
      );
    }

    await this.prisma.$transaction([
      this.prisma.medicine.update({
        where: { id: medicine.id },
        data: { currentStock: balanceAfter },
      }),
      this.prisma.medicineStockMovement.create({
        data: {
          medicineId: medicine.id,
          farmId,
          reason: MedicineStockMovementReason.TREATMENT,
          delta: -quantity,
          balanceAfter,
          notes: notes ?? 'Treatment administered',
          createdBy: userId,
        },
      }),
    ]);

    this.log.info('Medicine decremented for treatment', {
      medicineId: medicine.id,
      farmId,
      quantity,
      balanceAfter,
    });

    await this.maybeAlertLowStock(farmId, medicine, balanceAfter);

    return {
      medicineId: medicine.id,
      batchId: medicine.batchId,
      balanceAfter,
      batchesUsed: [
        {
          medicineId: medicine.id,
          batchId: medicine.batchId,
          quantity,
          balanceAfter,
        },
      ],
    };
  }

  /**
   * FIFO-by-name path (INV-05): walks every non-expired in-stock batch of this
   * medicine name, earliest-expiry first, drawing as much as each batch can
   * cover before moving to the next — splitting the dose across batches when
   * one alone is insufficient (RD-003). Throws if the combined stock across
   * all eligible batches still can't cover the quantity; nothing is written.
   */
  private async decrementAcrossBatches(
    farmId: string,
    userId: string,
    medicineName: string,
    quantity: number,
    notes?: string,
  ): Promise<{
    medicineId: string;
    batchId: string | null;
    balanceAfter: number;
    batchesUsed: {
      medicineId: string;
      batchId: string | null;
      quantity: number;
      balanceAfter: number;
    }[];
  }> {
    const batches = await this.prisma.medicine.findMany({
      where: {
        farmId,
        deletedAt: null,
        name: { equals: medicineName, mode: 'insensitive' },
        currentStock: { gt: 0 },
        expiryDate: { gte: new Date() },
      },
      // FIFO: earliest expiry first (INV-05).
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    });

    if (batches.length === 0) {
      throw new BadRequestException(
        `No in-stock, non-expired batch found for medicine "${medicineName}"`,
      );
    }

    const totalAvailable = batches.reduce(
      (sum, batch) => sum + batch.currentStock,
      0,
    );
    if (totalAvailable < quantity) {
      throw new BadRequestException(
        'Not enough medicine stock for this treatment',
      );
    }

    let remaining = quantity;
    const plan: { batch: Medicine; draw: number; balanceAfter: number }[] = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const draw = Math.min(batch.currentStock, remaining);
      plan.push({ batch, draw, balanceAfter: batch.currentStock - draw });
      remaining -= draw;
    }

    const isSplit = plan.length > 1;
    const ops = plan.flatMap(({ batch, draw, balanceAfter }) => [
      this.prisma.medicine.update({
        where: { id: batch.id },
        data: { currentStock: balanceAfter },
      }),
      this.prisma.medicineStockMovement.create({
        data: {
          medicineId: batch.id,
          farmId,
          reason: MedicineStockMovementReason.TREATMENT,
          delta: -draw,
          balanceAfter,
          notes: isSplit
            ? `${notes ?? 'Treatment administered'} (cross-batch split: ${draw} of ${quantity})`
            : (notes ?? 'Treatment administered'),
          createdBy: userId,
        },
      }),
    ]);

    await this.prisma.$transaction(ops);

    this.log.info('Medicine decremented for treatment', {
      farmId,
      medicineName,
      quantity,
      batchesUsed: plan.map((p) => p.batch.id),
      split: isSplit,
    });

    for (const { batch, balanceAfter } of plan) {
      await this.maybeAlertLowStock(farmId, batch, balanceAfter);
    }

    const primary = plan[0];
    return {
      medicineId: primary.batch.id,
      batchId: primary.batch.batchId,
      balanceAfter: primary.balanceAfter,
      batchesUsed: plan.map(({ batch, draw, balanceAfter }) => ({
        medicineId: batch.id,
        batchId: batch.batchId,
        quantity: draw,
        balanceAfter,
      })),
    };
  }

  // Low Medicine Stock alert (PRD §20.2) — fire only on the downward crossing
  // (was above the threshold, now at/below) so it doesn't spam every dose.
  private async maybeAlertLowStock(
    farmId: string,
    medicine: Medicine,
    balanceAfter: number,
  ): Promise<void> {
    const threshold = medicine.lowStockThreshold;
    if (
      threshold > 0 &&
      medicine.currentStock > threshold &&
      balanceAfter <= threshold
    ) {
      await this.notificationService.notifyOwnersAndManagers({
        farmId,
        eventKey: 'low_medicine_stock',
        title: 'Low Medicine Stock',
        message: `${medicine.name} is low: ${balanceAfter} left (alert threshold ${threshold}).`,
        params: {
          name: medicine.name,
          balance: balanceAfter,
          threshold,
        },
        link: '/inventory/medicine',
      });
    }
  }

  async archive(farmId: string, id: string): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { unit: true },
    });
    this.log.info('Medicine archived', { medicineId: id, farmId });
    return this.presentOne(medicine);
  }

  async restore(farmId: string, id: string): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { deletedAt: null },
      include: { unit: true },
    });
    this.log.info('Medicine restored', { medicineId: id, farmId });
    return this.presentOne(medicine);
  }

  /** Soft-delete (archive). Hard delete is avoided so treatment history stays intact (INV-06). */
  async remove(farmId: string, id: string): Promise<PresentedMedicine> {
    return this.archive(farmId, id);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. Same shape as
   * `FeedConcentrationService.removeMany`. */
  async removeMany(
    farmId: string,
    ids: string[],
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
    return { removed: true };
  }

  private async getOrThrow(
    farmId: string,
    id: string,
  ): Promise<MedicineWithUnit> {
    const medicine = await this.prisma.medicine.findFirst({
      where: { id, farmId },
      include: { unit: true },
    });
    if (!medicine) {
      this.log.warn('Medicine not found', { medicineId: id, farmId });
      throw new NotFoundException('Medicine not found');
    }
    return medicine;
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
