import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MilkTank, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  AdjustMilkTankVolumeDto,
  CreateMilkTankDto,
  ListMilkTankAuditQueryDto,
  ListMilkTankQueryDto,
  UpdateMilkTankDto,
} from '../../presentation/dto/milk-tank.dto';

type PresentedMilkTank = MilkTank & { fillPct: number };

/**
 * Inventory → Milk tab (PRD §15.5, RAKHAL-078): sellable + withholding tanks
 * with an append-only volume audit log. Enforces INV-04 (volume ≤ capacity).
 * `adjustVolume` is the integration point the Milk module calls on "Submit All
 * Logs" (COLLECTION) and Finance calls on a sale (SALE).
 */
@Injectable()
export class MilkTankService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkTankService.name);
  }

  async findAll(
    farmId: string,
    query: ListMilkTankQueryDto,
  ): Promise<PresentedMilkTank[]> {
    const tanks = await this.prisma.milkTank.findMany({
      where: {
        farmId,
        ...(query.includeArchived ? {} : { isActive: true }),
        ...(query.tankType ? { tankType: query.tankType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return tanks.map((tank) => this.present(tank));
  }

  async findOne(farmId: string, id: string): Promise<PresentedMilkTank> {
    return this.present(await this.getOrThrow(farmId, id));
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateMilkTankDto,
  ): Promise<PresentedMilkTank> {
    const currentVolumeL = dto.currentVolumeL ?? 0;
    if (currentVolumeL > dto.totalCapacityL) {
      throw new BadRequestException('Volume cannot exceed tank capacity');
    }
    await this.assertShedInFarm(farmId, dto.assignedShedId);

    const tank = await this.prisma.milkTank.create({
      data: {
        farmId,
        name: dto.name,
        tankType: dto.tankType,
        totalCapacityL: dto.totalCapacityL,
        currentVolumeL,
        fatPct: dto.fatPct,
        proteinPct: dto.proteinPct,
        snfPct: dto.snfPct,
        smartSensorId: dto.smartSensorId,
        targetTempC: dto.targetTempC,
        agitationIntervalMin: dto.agitationIntervalMin,
        assignedShedId: dto.assignedShedId,
        createdBy: userId,
      },
    });

    this.log.info('Milk tank created', { tankId: tank.id, farmId });
    return this.present(tank);
  }

  async update(
    farmId: string,
    id: string,
    dto: UpdateMilkTankDto,
  ): Promise<PresentedMilkTank> {
    const existing = await this.getOrThrow(farmId, id);
    await this.assertShedInFarm(farmId, dto.assignedShedId);

    const totalCapacityL = dto.totalCapacityL ?? existing.totalCapacityL;
    if (existing.currentVolumeL > totalCapacityL) {
      throw new BadRequestException(
        'New capacity is below the current stored volume',
      );
    }

    const tank = await this.prisma.milkTank.update({
      where: { id },
      data: {
        name: dto.name,
        tankType: dto.tankType,
        totalCapacityL: dto.totalCapacityL,
        fatPct: dto.fatPct,
        proteinPct: dto.proteinPct,
        snfPct: dto.snfPct,
        smartSensorId: dto.smartSensorId,
        targetTempC: dto.targetTempC,
        agitationIntervalMin: dto.agitationIntervalMin,
        assignedShedId: dto.assignedShedId,
      },
    });

    this.log.info('Milk tank updated', { tankId: id, farmId });
    return this.present(tank);
  }

  /**
   * Apply a signed volume change and append an audit entry, atomically.
   * Rejects going below zero or above capacity (INV-04). Used by the Milk module
   * (COLLECTION) and Finance (SALE) as well as manual corrections.
   */
  /**
   * `tx` lets a caller (e.g. Milk/Buyer "submit" and "dispatch" flows) fold this
   * write into its own transaction, so a capacity/negative-balance rejection here
   * rolls back the caller's write too instead of silently drifting out of sync.
   */
  async adjustVolume(
    farmId: string,
    userId: string,
    id: string,
    dto: AdjustMilkTankVolumeDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PresentedMilkTank> {
    const existing = await this.getOrThrow(farmId, id, tx ?? this.prisma);
    const balanceAfterL = existing.currentVolumeL + dto.delta;

    if (dto.delta === 0) {
      throw new BadRequestException('Volume change must be non-zero');
    }
    if (balanceAfterL < 0) {
      throw new BadRequestException('Tank volume cannot go below zero');
    }
    if (balanceAfterL > existing.totalCapacityL) {
      throw new BadRequestException('Tank volume cannot exceed capacity');
    }

    const write = async (client: Prisma.TransactionClient) => {
      const updatedTank = await client.milkTank.update({
        where: { id },
        data: { currentVolumeL: balanceAfterL },
      });
      await client.milkTankAuditLog.create({
        data: {
          milkTankId: id,
          farmId,
          activityType: dto.activityType,
          quantityL: dto.delta,
          balanceAfterL,
          source: dto.source,
          notes: dto.notes,
          saleLineId: dto.saleLineId,
          createdBy: userId,
        },
      });
      return updatedTank;
    };

    const tank = tx
      ? await write(tx)
      : await this.prisma.$transaction((t) => write(t));

    this.log.info('Milk tank volume adjusted', {
      tankId: id,
      farmId,
      delta: dto.delta,
      balanceAfterL,
    });
    return this.present(tank);
  }

  async archive(farmId: string, id: string): Promise<PresentedMilkTank> {
    await this.getOrThrow(farmId, id);
    const tank = await this.prisma.milkTank.update({
      where: { id },
      data: { isActive: false },
    });
    return this.present(tank);
  }

  async auditLog(farmId: string, query: ListMilkTankAuditQueryDto) {
    const where: Prisma.MilkTankAuditLogWhereInput = {
      farmId,
      ...(query.tankId ? { milkTankId: query.tankId } : {}),
    };

    const rows = await this.prisma.milkTankAuditLog.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    return toCursorPage(rows, query) satisfies CursorPage<unknown>;
  }

  private async getOrThrow(
    farmId: string,
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<MilkTank> {
    const tank = await client.milkTank.findFirst({
      where: { id, farmId },
    });
    if (!tank) throw new NotFoundException('Milk tank not found');
    return tank;
  }

  private async assertShedInFarm(
    farmId: string,
    shedId?: string,
  ): Promise<void> {
    if (!shedId) return;
    const shed = await this.prisma.shed.findFirst({
      where: { id: shedId, farmId },
      select: { id: true },
    });
    if (!shed) {
      throw new BadRequestException('Assigned shed must belong to this farm');
    }
  }

  private present(tank: MilkTank): PresentedMilkTank {
    return {
      ...tank,
      fillPct:
        tank.totalCapacityL > 0
          ? Math.round((tank.currentVolumeL / tank.totalCapacityL) * 1000) / 10
          : 0,
    };
  }
}
