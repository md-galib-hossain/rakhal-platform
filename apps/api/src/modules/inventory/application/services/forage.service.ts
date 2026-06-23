import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Forage, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { computeStockStatus, StockStatus } from '../../domain/medicine-status';
import { CreateForageDto } from '../../presentation/dto/create-forage.dto';
import { ListForageQueryDto } from '../../presentation/dto/list-forage-query.dto';
import { UpdateForageDto } from '../../presentation/dto/update-forage.dto';

/** A forage row enriched with stock status and the kg equivalent of its stock. */
type PresentedForage = Forage & {
  stockStatus: StockStatus;
  kgEquivalent: number | null;
};

/**
 * Inventory → Forage tab (PRD §15.3, RAKHAL-075). `farmId` is supplied by the
 * controller from the verified token context and every query is scoped to it.
 */
@Injectable()
export class ForageService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ForageService.name);
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateForageDto,
  ): Promise<PresentedForage> {
    try {
      const forage = await this.prisma.forage.create({
        data: {
          farmId,
          name: dto.name,
          type: dto.type,
          category: dto.category,
          unit: dto.unit,
          kgPerUnit: dto.kgPerUnit,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold ?? 0,
          moisturePct: dto.moisturePct,
          supplier: dto.supplier,
          purchaseDate: new Date(dto.purchaseDate),
          notes: dto.notes,
          createdBy: userId,
        },
      });

      this.log.info('Forage created', { forageId: forage.id, farmId });
      return this.present(forage);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Forage item already exists');
      }
      throw error;
    }
  }

  async findAll(
    farmId: string,
    query: ListForageQueryDto,
  ): Promise<CursorPage<PresentedForage>> {
    const where: Prisma.ForageWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { supplier: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.forage.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((forage) => this.present(forage)),
      meta: page.meta,
    };
  }

  async findOne(farmId: string, id: string): Promise<PresentedForage> {
    return this.present(await this.getOrThrow(farmId, id));
  }

  async update(
    farmId: string,
    id: string,
    dto: UpdateForageDto,
  ): Promise<PresentedForage> {
    await this.getOrThrow(farmId, id);

    try {
      const forage = await this.prisma.forage.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          category: dto.category,
          unit: dto.unit,
          kgPerUnit: dto.kgPerUnit,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold,
          moisturePct: dto.moisturePct,
          supplier: dto.supplier,
          ...(dto.purchaseDate
            ? { purchaseDate: new Date(dto.purchaseDate) }
            : {}),
          notes: dto.notes,
        },
      });

      this.log.info('Forage updated', { forageId: id, farmId });
      return this.present(forage);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Forage item already exists');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string): Promise<PresentedForage> {
    await this.getOrThrow(farmId, id);
    const forage = await this.prisma.forage.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Forage archived', { forageId: id, farmId });
    return this.present(forage);
  }

  async restore(farmId: string, id: string): Promise<PresentedForage> {
    await this.getOrThrow(farmId, id);
    const forage = await this.prisma.forage.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Forage restored', { forageId: id, farmId });
    return this.present(forage);
  }

  async remove(farmId: string, id: string): Promise<PresentedForage> {
    return this.archive(farmId, id);
  }

  private async getOrThrow(farmId: string, id: string): Promise<Forage> {
    const forage = await this.prisma.forage.findFirst({
      where: { id, farmId },
    });
    if (!forage) {
      throw new NotFoundException('Forage item not found');
    }
    return forage;
  }

  private present(forage: Forage): PresentedForage {
    return {
      ...forage,
      stockStatus: computeStockStatus(
        forage.currentStock,
        forage.lowStockThreshold,
      ),
      kgEquivalent:
        forage.kgPerUnit != null
          ? forage.currentStock * forage.kgPerUnit
          : null,
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
