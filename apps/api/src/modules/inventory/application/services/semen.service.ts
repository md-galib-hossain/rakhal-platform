import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SemenBatch,
  SemenStrawMovementReason,
  SemenTank,
  SemenType,
  TargetSex,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  CreateSemenTankDto,
  UpdateSemenTankDto,
} from '../../presentation/dto/semen-tank.dto';
import {
  CreateSemenBatchDto,
  ListSemenBatchQueryDto,
  UpdateSemenBatchDto,
} from '../../presentation/dto/semen-batch.dto';
import { InventoryActivityService } from './inventory-activity.service';

type PresentedTank = SemenTank & {
  strawInStock: number;
  availableCapacity: number;
};
type PresentedBatch = SemenBatch & { lowStraw: boolean };

export interface RestoreStrawResult {
  batch: PresentedBatch;
  /** Set when the batch is archived — the count is restored anyway (correct
   * bookkeeping) but the caller should surface this, since an archived
   * batch's physical straws may no longer exist to be "un-thawed". */
  warning: string | null;
}

/**
 * Inventory → Semen tab (PRD §15.4, RAKHAL-077): LN2 tanks + straw batches.
 * Enforces INV-07 (tank below 0 °C), INV-03 (straws in a tank ≤ its capacity),
 * and INV-02 (straw count never negative). `decrementStraw` is the integration
 * point the Reproduction AI flow calls (REP-05).
 */
@Injectable()
export class SemenService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly activity: InventoryActivityService,
  ) {
    this.log = logger.setContext(SemenService.name);
  }

  // ---- Tanks ---------------------------------------------------------------

  async listTanks(farmId: string): Promise<PresentedTank[]> {
    const tanks = await this.prisma.semenTank.findMany({
      where: { farmId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const sums = await this.prisma.semenBatch.groupBy({
      by: ['tankId'],
      where: {
        farmId,
        deletedAt: null,
        tankId: { in: tanks.map((t) => t.id) },
      },
      _sum: { strawQuantity: true },
    });
    const byTank = new Map(
      sums.map((s) => [s.tankId, s._sum.strawQuantity ?? 0]),
    );

    return tanks.map((tank) =>
      this.presentTank(tank, byTank.get(tank.id) ?? 0),
    );
  }

  async createTank(
    farmId: string,
    userId: string,
    dto: CreateSemenTankDto,
  ): Promise<PresentedTank> {
    this.assertSubZeroTemp(dto.currentTempC);

    const tank = await this.prisma.semenTank.create({
      data: {
        farmId,
        name: dto.name,
        modelManufacturer: dto.modelManufacturer,
        strawCapacity: dto.strawCapacity,
        numCanisters: dto.numCanisters,
        numGoblets: dto.numGoblets,
        storageLocation: dto.storageLocation,
        currentTempC: dto.currentTempC,
        ln2LevelPct: dto.ln2LevelPct,
        createdBy: userId,
      },
    });

    this.log.info('Semen tank created', { tankId: tank.id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Semen Tank Added',
      `Semen tank "${tank.name}" added — capacity ${tank.strawCapacity} straws.`,
    );
    return this.presentTank(tank, 0);
  }

  async updateTank(
    farmId: string,
    id: string,
    dto: UpdateSemenTankDto,
    userId?: string,
  ): Promise<PresentedTank> {
    await this.getTankOrThrow(farmId, id);
    this.assertSubZeroTemp(dto.currentTempC);

    const tank = await this.prisma.semenTank.update({
      where: { id },
      data: {
        name: dto.name,
        modelManufacturer: dto.modelManufacturer,
        strawCapacity: dto.strawCapacity,
        numCanisters: dto.numCanisters,
        numGoblets: dto.numGoblets,
        storageLocation: dto.storageLocation,
        currentTempC: dto.currentTempC,
        ln2LevelPct: dto.ln2LevelPct,
      },
    });

    this.log.info('Semen tank updated', { tankId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Semen Tank Updated',
      `Semen tank "${tank.name}" updated.`,
    );
    return this.presentTank(tank, await this.tankStrawTotal(farmId, id));
  }

  async archiveTank(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedTank> {
    await this.getTankOrThrow(farmId, id);
    const tank = await this.prisma.semenTank.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.activity.record(
      farmId,
      userId,
      'Semen Tank Archived',
      `Semen tank "${tank.name}" archived.`,
    );
    return this.presentTank(tank, await this.tankStrawTotal(farmId, id));
  }

  // ---- Batches -------------------------------------------------------------

  async listBatches(
    farmId: string,
    query: ListSemenBatchQueryDto,
  ): Promise<CursorPage<PresentedBatch>> {
    const where: Prisma.SemenBatchWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.tankId ? { tankId: query.tankId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { bullId: { contains: query.search, mode: 'insensitive' } },
              { breed: { contains: query.search, mode: 'insensitive' } },
              { batchCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.semenBatch.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((batch) => this.presentBatch(batch)),
      meta: page.meta,
    };
  }

  async createBatch(
    farmId: string,
    userId: string,
    dto: CreateSemenBatchDto,
  ): Promise<PresentedBatch> {
    if (dto.tankId) {
      await this.assertTankCapacity(farmId, dto.tankId, dto.strawQuantity);
    }

    const { semenType, targetSex } = this.resolveSemenTypeFields(
      dto.semenType,
      dto.targetSex,
    );

    const batch = await this.prisma.semenBatch.create({
      data: {
        farmId,
        name: dto.name,
        batchCode: dto.batchCode,
        bullId: dto.bullId,
        breed: dto.breed,
        strawColor: dto.strawColor,
        initialVitalityPct: dto.initialVitalityPct,
        strawQuantity: dto.strawQuantity,
        lowStrawThreshold: dto.lowStrawThreshold ?? 5,
        costPerUnit: dto.costPerUnit,
        semenType,
        targetSex,
        fatherId: dto.fatherId,
        motherId: dto.motherId,
        tankId: dto.tankId,
        canister: dto.canister,
        goblet: dto.goblet,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    this.log.info('Semen batch created', { batchId: batch.id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Semen Batch Added',
      `Semen batch "${batch.name}" added — ${batch.strawQuantity} straws.`,
    );
    return this.presentBatch(batch);
  }

  async updateBatch(
    farmId: string,
    id: string,
    dto: UpdateSemenBatchDto,
    userId?: string,
  ): Promise<PresentedBatch> {
    const existing = await this.getBatchOrThrow(farmId, id);

    const tankId = dto.tankId ?? existing.tankId;
    const strawQuantity = dto.strawQuantity ?? existing.strawQuantity;
    if (tankId) {
      await this.assertTankCapacity(farmId, tankId, strawQuantity, id);
    }

    const { semenType, targetSex } = this.resolveSemenTypeFields(
      dto.semenType ?? existing.semenType ?? undefined,
      dto.targetSex ?? existing.targetSex ?? undefined,
    );

    const batch = await this.prisma.semenBatch.update({
      where: { id },
      data: {
        name: dto.name,
        batchCode: dto.batchCode,
        bullId: dto.bullId,
        breed: dto.breed,
        strawColor: dto.strawColor,
        initialVitalityPct: dto.initialVitalityPct,
        strawQuantity: dto.strawQuantity,
        lowStrawThreshold: dto.lowStrawThreshold,
        costPerUnit: dto.costPerUnit,
        semenType,
        targetSex,
        tankId: dto.tankId,
        canister: dto.canister,
        goblet: dto.goblet,
        notes: dto.notes,
      },
    });

    this.log.info('Semen batch updated', { batchId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Semen Batch Updated',
      `Semen batch "${batch.name}" updated.`,
    );
    return this.presentBatch(batch);
  }

  async archiveBatch(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<PresentedBatch> {
    await this.getBatchOrThrow(farmId, id);
    const batch = await this.prisma.semenBatch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.activity.record(
      farmId,
      userId,
      'Semen Batch Archived',
      `Semen batch "${batch.name}" archived.`,
    );
    return this.presentBatch(batch);
  }

  /**
   * Decrement a batch's straw count (default 1) — called when an AI event is
   * recorded (Reproduction module, REP-05). Rejects going below zero (INV-02).
   * Writes a `-by` `AI_USE` movement onto the straw ledger, atomically.
   */
  async decrementStraw(
    farmId: string,
    batchId: string,
    by = 1,
    actorId?: string | null,
    sourceEventId?: string | null,
  ): Promise<PresentedBatch> {
    const existing = await this.getBatchOrThrow(farmId, batchId);
    const next = existing.strawQuantity - by;
    if (next < 0) {
      throw new BadRequestException('Not enough straws in this batch');
    }

    const [batch] = await this.prisma.$transaction([
      this.prisma.semenBatch.update({
        where: { id: batchId },
        data: { strawQuantity: next },
      }),
      this.prisma.semenStrawMovement.create({
        data: {
          batchId,
          farmId,
          reason: SemenStrawMovementReason.AI_USE,
          delta: -by,
          balanceAfter: next,
          sourceEventId: sourceEventId ?? null,
          createdBy: actorId ?? null,
        },
      }),
    ]);
    this.log.info('Semen straw decremented', { batchId, farmId, by });
    return this.presentBatch(batch);
  }

  /**
   * Restore `by` straws to a batch — used when an AI event that consumed a
   * straw is edited/undone (RAKHAL-305). Writes a `+by` `REVERSAL` movement.
   *
   * Honest-accounting note: restoring the count is correct bookkeeping (the
   * AI never happened against this batch, so the straw was never truly
   * spoken for) but it is **not** correct about physical stock — the straw
   * itself was thawed and cannot be un-thawed. The `REVERSAL` row on the
   * ledger is what keeps both facts visible: the count goes back up, but the
   * ledger still shows the original `AI_USE` entry that consumed a real straw.
   *
   * Never throws for an archived batch — returns a `warning` instead, so an
   * edit elsewhere is never blocked by an unrelated archive decision.
   */
  async restoreStraw(
    farmId: string,
    batchId: string,
    by: number,
    reason?: string | null,
    sourceEventId?: string | null,
    actorId?: string | null,
  ): Promise<RestoreStrawResult> {
    const existing = await this.getBatchOrThrow(farmId, batchId);
    const next = existing.strawQuantity + by;
    const [updated] = await this.prisma.$transaction([
      this.prisma.semenBatch.update({
        where: { id: batchId },
        data: { strawQuantity: next },
      }),
      this.prisma.semenStrawMovement.create({
        data: {
          batchId,
          farmId,
          reason: SemenStrawMovementReason.REVERSAL,
          delta: by,
          balanceAfter: next,
          notes: reason ?? null,
          sourceEventId: sourceEventId ?? null,
          createdBy: actorId ?? null,
        },
      }),
    ]);

    this.log.info('Semen straw restored', { batchId, farmId, by });
    return {
      batch: this.presentBatch(updated),
      warning: !existing.deletedAt
        ? null
        : 'This batch is archived — the straw count was restored, but the physical straw cannot be un-thawed.',
    };
  }

  // ---- Helpers -------------------------------------------------------------

  private async getTankOrThrow(farmId: string, id: string): Promise<SemenTank> {
    const tank = await this.prisma.semenTank.findFirst({
      where: { id, farmId },
    });
    if (!tank) throw new NotFoundException('Semen tank not found');
    return tank;
  }

  private async getBatchOrThrow(
    farmId: string,
    id: string,
  ): Promise<SemenBatch> {
    const batch = await this.prisma.semenBatch.findFirst({
      where: { id, farmId },
    });
    if (!batch) throw new NotFoundException('Semen batch not found');
    return batch;
  }

  private async tankStrawTotal(
    farmId: string,
    tankId: string,
  ): Promise<number> {
    const sum = await this.prisma.semenBatch.aggregate({
      where: { farmId, tankId, deletedAt: null },
      _sum: { strawQuantity: true },
    });
    return sum._sum.strawQuantity ?? 0;
  }

  /** INV-03: a tank's total straws may not exceed its capacity. */
  private async assertTankCapacity(
    farmId: string,
    tankId: string,
    incomingStraws: number,
    excludeBatchId?: string,
  ): Promise<void> {
    const tank = await this.getTankOrThrow(farmId, tankId);

    const sum = await this.prisma.semenBatch.aggregate({
      where: {
        farmId,
        tankId,
        deletedAt: null,
        ...(excludeBatchId ? { id: { not: excludeBatchId } } : {}),
      },
      _sum: { strawQuantity: true },
    });
    const others = sum._sum.strawQuantity ?? 0;

    if (others + incomingStraws > tank.strawCapacity) {
      throw new ConflictException(
        `Tank capacity exceeded (${others + incomingStraws}/${tank.strawCapacity} straws)`,
      );
    }
  }

  /** targetSex only meaningful when semenType === SEX_SORTED — nulled out otherwise. */
  private resolveSemenTypeFields(
    semenType?: SemenType,
    targetSex?: TargetSex,
  ): { semenType: SemenType | null; targetSex: TargetSex | null } {
    return {
      semenType: semenType ?? null,
      targetSex:
        semenType === SemenType.SEX_SORTED ? (targetSex ?? null) : null,
    };
  }

  private assertSubZeroTemp(tempC?: number): void {
    if (tempC != null && tempC >= 0) {
      throw new BadRequestException('LN2 tank temperature must be below 0 °C');
    }
  }

  private presentTank(tank: SemenTank, strawInStock: number): PresentedTank {
    return {
      ...tank,
      strawInStock,
      availableCapacity: Math.max(tank.strawCapacity - strawInStock, 0),
    };
  }

  private presentBatch(batch: SemenBatch): PresentedBatch {
    return {
      ...batch,
      lowStraw: batch.strawQuantity <= batch.lowStrawThreshold,
    };
  }
}
