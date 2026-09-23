import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateUnitDto } from '../../presentation/dto/create-unit.dto';
import { ListUnitQueryDto } from '../../presentation/dto/list-unit-query.dto';
import { InventoryActivityService } from './inventory-activity.service';

/**
 * Single source of truth for "how many kg is 1 of this unit" — resolves a WEIGHT-dimension
 * unit's own `conversionToBase` (kg's own is 1, g is 0.001, ton is 1000, seeded in
 * `prisma/seed.ts`) rather than trusting a separately farm-entered `kgPerUnit` scalar, which
 * used to be asked for even on weight units, duplicating a fact the catalog already has (user
 * report 2026-09-09/10: "unit is kg then what kg per unit", "still confused" after picking
 * Gram). COUNT (bag, sack…) and VOLUME (density unknown to the system) units have no inherent
 * kg equivalence, so `storedKgPerUnit` — the farm's own entered fact — is still authoritative
 * for those. Exported as a plain function (not a service method) so every call site
 * (`FeedItemService`, `FeedDistributionService`) can use it without a DI dependency on
 * `UnitService` just for one pure computation.
 */
export function resolveKgPerUnit(
  unit: Pick<Unit, 'dimension' | 'conversionToBase'>,
  storedKgPerUnit: number | null,
): number | null {
  if (unit.dimension === 'WEIGHT') return unit.conversionToBase;
  return storedKgPerUnit;
}

/**
 * Unit catalog (RAKHAL-326) — replaces the free-text `unit` string previously stored
 * directly on Medicine/Equipment/FeedItem. System-seeded rows (`isSystemDefault`,
 * `farmId: null`) are visible to every farm; a farm can additionally create its own
 * custom unit (`farmId` set), invisible to other farms — same "system catalogue +
 * farm-custom rows" convention as `FeedIngredientService.listMerged`.
 */
@Injectable()
export class UnitService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly activity: InventoryActivityService,
  ) {
    this.log = logger.setContext(UnitService.name);
  }

  /** Merged system + farm units, optionally filtered by dimension. */
  async findAll(farmId: string, query: ListUnitQueryDto): Promise<Unit[]> {
    const where: Prisma.UnitWhereInput = {
      OR: [{ farmId: null }, { farmId }],
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.dimension ? { dimension: query.dimension } : {}),
    };

    return this.prisma.unit.findMany({
      where,
      orderBy: [
        { dimension: 'asc' },
        { isSystemDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /** Create this farm's own custom unit. */
  async create(
    farmId: string,
    dto: CreateUnitDto,
    userId?: string,
  ): Promise<Unit> {
    const unit = await this.prisma.unit.create({
      data: {
        farmId,
        name: dto.name,
        symbol: dto.symbol,
        dimension: dto.dimension,
        conversionToBase: dto.conversionToBase,
        isSystemDefault: false,
      },
    });
    this.log.info('Farm-custom unit created', { unitId: unit.id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Custom Unit Added',
      `Custom unit "${unit.name}" (${unit.symbol}, ${unit.dimension}) added.`,
    );
    return unit;
  }

  /**
   * Archive-only, never edit — a unit's `conversionToBase` must never change once created
   * (retroactively editing it would silently rewrite historical stock/cost math for every
   * item that ever used it). If a farm mis-entered a custom unit's conversion factor, the
   * correct flow is archive-then-recreate, not an in-place fix. A system unit (`farmId: null`)
   * can never be archived by a farm.
   */
  async archive(
    farmId: string,
    unitId: string,
    userId?: string,
  ): Promise<Unit> {
    // Scoping the lookup to this farm's own `farmId` already excludes system rows
    // (`farmId: null`) — a system unit can never satisfy this `where` for a real caller.
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, farmId, deletedAt: null },
    });
    if (!unit) {
      throw new NotFoundException('Custom unit not found');
    }
    const archived = await this.prisma.unit.update({
      where: { id: unitId },
      data: { deletedAt: new Date() },
    });
    this.log.info('Farm-custom unit archived', { unitId, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Custom Unit Archived',
      `Custom unit "${archived.name}" (${archived.symbol}) archived.`,
    );
    return archived;
  }
}
