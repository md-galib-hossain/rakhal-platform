import { Injectable } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateUnitDto } from '../../presentation/dto/create-unit.dto';
import { ListUnitQueryDto } from '../../presentation/dto/list-unit-query.dto';

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
  async create(farmId: string, dto: CreateUnitDto): Promise<Unit> {
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
    return unit;
  }
}
