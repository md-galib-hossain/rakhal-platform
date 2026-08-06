import { Injectable, NotFoundException } from '@nestjs/common';
import { MilkQualityTest } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { CreateMilkQualityTestDto } from '../../presentation/dto/create-milk-quality-test.dto';
import { ListMilkQualityTestQueryDto } from '../../presentation/dto/list-milk-quality-test-query.dto';

/**
 * Milk quality testing (RAKHAL-282, PRD §10.6 groundwork). Lab/device
 * composition readings (fat/protein/lactose/SCC/MUN) for a cow's sample,
 * distinct from the daily-yield `MilkLogEntry`. Farm-scoped in the
 * application layer — `MilkQualityTest.farmId`/`lactationId` are plain scalar
 * columns with no DB-level FK (see the model's doc comment in
 * `prisma/schemas/milk/milk.prisma`), so every read/write here validates the
 * cow (and, for `lactationId`, the lactation) actually belongs to the calling
 * farm via `Cattle`/`Lactation` before touching a row.
 */
@Injectable()
export class MilkQualityService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkQualityService.name);
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateMilkQualityTestDto,
  ): Promise<MilkQualityTest> {
    await this.assertCattleInFarm(farmId, dto.cattleId);
    await this.assertLactationBelongsToCattle(dto.lactationId, dto.cattleId);

    const test = await this.prisma.milkQualityTest.create({
      data: {
        farmId,
        cattleId: dto.cattleId,
        lactationId: dto.lactationId,
        sampleDate: new Date(dto.sampleDate),
        fatPct: dto.fatPct,
        proteinPct: dto.proteinPct,
        lactosePct: dto.lactosePct,
        somaticCellCount: dto.somaticCellCount,
        milkUreaNitrogen: dto.milkUreaNitrogen,
        source: dto.source,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    this.log.info('Milk quality test recorded', {
      farmId,
      cattleId: dto.cattleId,
      testId: test.id,
    });

    return test;
  }

  async list(
    farmId: string,
    query: ListMilkQualityTestQueryDto,
  ): Promise<CursorPage<MilkQualityTest>> {
    const rows = await this.prisma.milkQualityTest.findMany({
      where: {
        farmId,
        ...(query.cattleId ? { cattleId: query.cattleId } : {}),
        ...(query.lactationId ? { lactationId: query.lactationId } : {}),
      },
      orderBy: [{ sampleDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    return toCursorPage(rows, query);
  }

  /** Most recent quality test for one cow — feeds a cow's lactation summary read. */
  async latestForCattle(
    farmId: string,
    cattleId: string,
  ): Promise<MilkQualityTest | null> {
    return this.prisma.milkQualityTest.findFirst({
      where: { farmId, cattleId },
      orderBy: [{ sampleDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async assertCattleInFarm(
    farmId: string,
    cattleId: string,
  ): Promise<void> {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true },
    });
    if (!cattle) {
      throw new NotFoundException('Cattle not found in this farm.');
    }
  }

  private async assertLactationBelongsToCattle(
    lactationId: string,
    cattleId: string,
  ): Promise<void> {
    const lactation = await this.prisma.lactation.findFirst({
      where: { id: lactationId, cattleId },
      select: { id: true },
    });
    if (!lactation) {
      throw new NotFoundException(
        'Lactation not found for this cow, or does not belong to it.',
      );
    }
  }
}
