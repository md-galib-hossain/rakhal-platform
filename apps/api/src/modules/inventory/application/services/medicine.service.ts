import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Medicine, MedicineStockMovementReason, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
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

/** A medicine row enriched with derived stock/expiry status for the API. */
type PresentedMedicine = Medicine & {
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
          unit: dto.unit,
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
      });

      this.log.info('Medicine created', { medicineId: medicine.id, farmId });
      return this.present(medicine);
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
      ...(query.includeArchived ? {} : { isActive: true }),
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
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((medicine) => this.present(medicine)),
      meta: page.meta,
    };
  }

  async findOne(farmId: string, id: string): Promise<PresentedMedicine> {
    return this.present(await this.getOrThrow(farmId, id));
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
          unit: dto.unit,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold,
          ...(dto.purchaseDate ? { purchaseDate } : {}),
          ...(dto.expiryDate ? { expiryDate } : {}),
          milkWithdrawalDays: dto.milkWithdrawalDays,
          meatWithdrawalDays: dto.meatWithdrawalDays,
          notes: dto.notes,
        },
      });

      this.log.info('Medicine updated', { medicineId: id, farmId });
      return this.present(medicine);
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
  async adjustStock(
    farmId: string,
    userId: string,
    id: string,
    dto: AdjustStockDto,
  ): Promise<PresentedMedicine> {
    const existing = await this.getOrThrow(farmId, id);
    const balanceAfter = existing.currentStock + dto.adjustment;

    if (dto.adjustment === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }
    if (balanceAfter < 0) {
      throw new BadRequestException('Stock cannot go below zero');
    }

    const [medicine] = await this.prisma.$transaction([
      this.prisma.medicine.update({
        where: { id },
        data: { currentStock: balanceAfter },
      }),
      this.prisma.medicineStockMovement.create({
        data: {
          medicineId: id,
          farmId,
          reason: dto.reason,
          delta: dto.adjustment,
          balanceAfter,
          notes: dto.notes,
          createdBy: userId,
        },
      }),
    ]);

    this.log.info('Medicine stock adjusted', {
      medicineId: id,
      farmId,
      delta: dto.adjustment,
      balanceAfter,
    });
    return this.present(medicine);
  }

  /**
   * Consume medicine stock for a treatment (HLT-07). The integration point the
   * Healthcare `logTreatment` flow calls. Resolves the batch to draw from —
   * either the explicit `medicineId`, or, given only a `medicineName`, the
   * earliest-expiry non-expired in-stock batch (FIFO, INV-05). Enforces
   * expired-blocked-from-treatment (HLT-02) and the never-negative floor
   * (INV-02), and records an audited `TREATMENT` stock movement atomically.
   *
   * NOTE: a single dose is drawn from one batch; cross-batch splitting when one
   * batch can't cover the quantity is deferred (tracked in TECH_DEBT RD-003).
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
  }> {
    if (!opts.quantity || opts.quantity <= 0) {
      throw new BadRequestException(
        'Treatment quantity must be greater than 0',
      );
    }

    const medicine = await this.resolveTreatmentBatch(farmId, opts);

    if (medicine.expiryDate.getTime() < Date.now()) {
      throw new BadRequestException(
        'Cannot administer an expired medicine batch (HLT-02)',
      );
    }

    const balanceAfter = medicine.currentStock - opts.quantity;
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
          delta: -opts.quantity,
          balanceAfter,
          notes: opts.notes ?? 'Treatment administered',
          createdBy: userId,
        },
      }),
    ]);

    this.log.info('Medicine decremented for treatment', {
      medicineId: medicine.id,
      farmId,
      quantity: opts.quantity,
      balanceAfter,
    });

    // Low Medicine Stock alert (PRD §20.2) — fire only on the downward crossing
    // (was above the threshold, now at/below) so it doesn't spam every dose.
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

    return { medicineId: medicine.id, batchId: medicine.batchId, balanceAfter };
  }

  /** Resolve the batch a treatment draws from: explicit id, else FIFO-by-name (INV-05). */
  private async resolveTreatmentBatch(
    farmId: string,
    opts: { medicineId?: string; medicineName?: string },
  ): Promise<Medicine> {
    if (opts.medicineId) {
      return this.getOrThrow(farmId, opts.medicineId);
    }
    if (!opts.medicineName) {
      throw new BadRequestException(
        'A medicineId or medicineName is required to deduct treatment stock',
      );
    }

    const batch = await this.prisma.medicine.findFirst({
      where: {
        farmId,
        isActive: true,
        name: { equals: opts.medicineName, mode: 'insensitive' },
        currentStock: { gt: 0 },
        expiryDate: { gte: new Date() },
      },
      // FIFO: earliest expiry first (INV-05).
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    });
    if (!batch) {
      throw new BadRequestException(
        `No in-stock, non-expired batch found for medicine "${opts.medicineName}"`,
      );
    }
    return batch;
  }

  async archive(farmId: string, id: string): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Medicine archived', { medicineId: id, farmId });
    return this.present(medicine);
  }

  async restore(farmId: string, id: string): Promise<PresentedMedicine> {
    await this.getOrThrow(farmId, id);
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Medicine restored', { medicineId: id, farmId });
    return this.present(medicine);
  }

  /** Soft-delete (archive). Hard delete is avoided so treatment history stays intact (INV-06). */
  async remove(farmId: string, id: string): Promise<PresentedMedicine> {
    return this.archive(farmId, id);
  }

  private async getOrThrow(farmId: string, id: string): Promise<Medicine> {
    const medicine = await this.prisma.medicine.findFirst({
      where: { id, farmId },
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

  private present(medicine: Medicine): PresentedMedicine {
    return {
      ...medicine,
      stockStatus: computeStockStatus(
        medicine.currentStock,
        medicine.lowStockThreshold,
      ),
      expiryStatus: computeExpiryStatus(medicine.expiryDate),
    };
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
