import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Equipment, EquipmentType, Prisma, Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { computeStockStatus, StockStatus } from '../../domain/medicine-status';
import { CreateEquipmentDto } from '../../presentation/dto/create-equipment.dto';
import { ListEquipmentQueryDto } from '../../presentation/dto/list-equipment-query.dto';
import { UpdateEquipmentDto } from '../../presentation/dto/update-equipment.dto';
import { AdjustEquipmentStockDto } from '../../presentation/dto/adjust-equipment-stock.dto';
import { InventoryActivityService } from './inventory-activity.service';

/** An equipment row with its `Unit` relation resolved (RAKHAL-326, optional — mirrors the
 * old optional `unit` column). */
type EquipmentWithUnit = Equipment & { unit: Unit | null };

/** An equipment row enriched with derived stock status. */
type PresentedEquipment = EquipmentWithUnit & { stockStatus: StockStatus };

/**
 * Inventory → Others/Equipment tab (PRD §15.6, RAKHAL-076). `farmId` is supplied
 * by the controller from the verified token context; every query is scoped to it.
 */
@Injectable()
export class EquipmentService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly activity: InventoryActivityService,
  ) {
    this.log = logger.setContext(EquipmentService.name);
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateEquipmentDto,
  ): Promise<PresentedEquipment> {
    try {
      const equipment = await this.prisma.equipment.create({
        data: {
          farmId,
          name: dto.name,
          assetId: dto.assetId,
          type: dto.type,
          unitId: dto.unitId,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold ?? 0,
          purchaseDate: new Date(dto.purchaseDate),
          notes: dto.notes,
          createdBy: userId,
        },
        include: { unit: true },
      });

      this.log.info('Equipment created', { equipmentId: equipment.id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Equipment Added',
        `Equipment "${equipment.name}" added — stock ${equipment.currentStock}${equipment.unit ? ` ${equipment.unit.symbol}` : ''}.`,
      );
      return this.present(equipment);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Equipment item already exists');
      }
      throw error;
    }
  }

  /**
   * Catalog row only, **zero stock** — for a caller that owns the transaction and adds the stock
   * itself via `adjustStock(..., tx)` (`PurchaseService`'s inline `newItem`). No Activity Log entry:
   * the purchase owns the audit trail.
   */
  async createCatalogRowInTx(
    farmId: string,
    userId: string,
    input: {
      name: string;
      assetId?: string;
      type?: EquipmentType;
      unitId?: string;
      lowStockThreshold?: number;
      notes?: string;
      purchaseDate: Date;
      costPerUnit: number;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    return tx.equipment.create({
      data: {
        farmId,
        name: input.name,
        assetId: input.assetId,
        type: input.type,
        unitId: input.unitId,
        currentStock: 0,
        costPerUnit: input.costPerUnit,
        lowStockThreshold: input.lowStockThreshold ?? 0,
        purchaseDate: input.purchaseDate,
        notes: input.notes,
        createdBy: userId,
      },
      select: { id: true },
    });
  }

  async findAll(
    farmId: string,
    query: ListEquipmentQueryDto,
  ): Promise<CursorPage<PresentedEquipment>> {
    const where: Prisma.EquipmentWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { assetId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.equipment.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      include: { unit: true },
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((equipment) => this.present(equipment)),
      meta: page.meta,
    };
  }

  async findOne(farmId: string, id: string): Promise<PresentedEquipment> {
    return this.present(await this.getOrThrow(farmId, id));
  }

  async update(
    farmId: string,
    id: string,
    dto: UpdateEquipmentDto,
    userId?: string,
  ): Promise<PresentedEquipment> {
    await this.getOrThrow(farmId, id);

    try {
      const equipment = await this.prisma.equipment.update({
        where: { id },
        data: {
          name: dto.name,
          assetId: dto.assetId,
          type: dto.type,
          unitId: dto.unitId,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold,
          ...(dto.purchaseDate
            ? { purchaseDate: new Date(dto.purchaseDate) }
            : {}),
          notes: dto.notes,
        },
        include: { unit: true },
      });

      this.log.info('Equipment updated', { equipmentId: id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Equipment Updated',
        `Equipment "${equipment.name}" updated.`,
      );
      return this.present(equipment);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Equipment item already exists');
      }
      throw error;
    }
  }

  async archive(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedEquipment> {
    await this.getOrThrow(farmId, id);
    const equipment = await this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { unit: true },
    });
    this.log.info('Equipment archived', { equipmentId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Equipment Archived',
      `Equipment "${equipment.name}" archived.`,
    );
    return this.present(equipment);
  }

  async restore(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedEquipment> {
    await this.getOrThrow(farmId, id);
    const equipment = await this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: null },
      include: { unit: true },
    });
    this.log.info('Equipment restored', { equipmentId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Equipment Restored',
      `Equipment "${equipment.name}" restored.`,
    );
    return this.present(equipment);
  }

  async remove(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedEquipment> {
    return this.archive(farmId, id, userId);
  }

  /**
   * Apply a signed stock delta and record an audit movement, atomically.
   * Rejects adjustments that would drive stock below zero. Mirrors
   * `MedicineService.adjustStock`.
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
    dto: AdjustEquipmentStockDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PresentedEquipment> {
    const existing = await this.getOrThrow(farmId, id, tx ?? this.prisma);
    const balanceAfter = existing.currentStock + dto.adjustment;

    if (dto.adjustment === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }
    if (balanceAfter < 0) {
      throw new BadRequestException('Stock cannot go below zero');
    }

    const write = async (client: Prisma.TransactionClient) => {
      const updatedEquipment = await client.equipment.update({
        where: { id },
        data: { currentStock: balanceAfter },
        include: { unit: true },
      });
      await client.equipmentStockMovement.create({
        data: {
          equipmentId: id,
          farmId,
          reason: dto.reason,
          delta: dto.adjustment,
          balanceAfter,
          notes: dto.notes,
          saleLineId: dto.saleLineId ?? null,
          createdBy: userId,
        },
      });
      return updatedEquipment;
    };

    const equipment = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    this.log.info('Equipment stock adjusted', {
      equipmentId: id,
      farmId,
      delta: dto.adjustment,
      balanceAfter,
    });
    return this.present(equipment);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. */
  async removeMany(
    farmId: string,
    ids: string[],
    userId?: string,
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.equipment.updateMany({
      where: { farmId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.log.info('Equipment bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    if (result.count > 0) {
      await this.activity.record(
        farmId,
        userId,
        'Equipment Bulk Archived',
        `${result.count} equipment item(s) archived.`,
      );
    }
    return { deleted: result.count };
  }

  private async getOrThrow(
    farmId: string,
    id: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<EquipmentWithUnit> {
    const equipment = await client.equipment.findFirst({
      where: { id, farmId },
      include: { unit: true },
    });
    if (!equipment) {
      throw new NotFoundException('Equipment item not found');
    }
    return equipment;
  }

  private present(equipment: EquipmentWithUnit): PresentedEquipment {
    return {
      ...equipment,
      stockStatus: computeStockStatus(
        equipment.currentStock,
        equipment.lowStockThreshold,
      ),
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
