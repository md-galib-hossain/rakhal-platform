import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';

/**
 * Body-weight recording (PRD §8.5 Tab1, RAKHAL-039). Records a timestamped
 * weight reading and keeps the denormalized `Cattle.lastWeightKg` in sync; the
 * history feeds the Overview weight chart. Farm-scoped via the owning cattle row.
 */
@Injectable()
export class WeightService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(WeightService.name);
  }

  async recordWeight(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: RecordWeightDto,
  ) {
    await this.assertCattleInFarm(farmId, cattleId);

    const recordedDate = dto.date ? new Date(dto.date) : new Date();

    const record = await this.prisma.weightRecord.create({
      data: {
        cattleId,
        weightKg: dto.weightKg,
        recordedDate,
        recordedBy: userId,
        notes: dto.notes,
      },
    });

    await this.prisma.cattle.update({
      where: { id: cattleId },
      data: { lastWeightKg: dto.weightKg },
    });

    this.log.info('Weight recorded', {
      cattleId,
      farmId,
      weightKg: dto.weightKg,
    });
    return { record, lastWeightKg: dto.weightKg };
  }

  /** Recent weight history for the weight-vs-target chart (PRD §8.5 Tab1). */
  async history(farmId: string, cattleId: string, limit = 50) {
    await this.assertCattleInFarm(farmId, cattleId);
    return this.prisma.weightRecord.findMany({
      where: { cattleId },
      orderBy: { recordedDate: 'desc' },
      take: limit,
    });
  }

  private async assertCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true },
    });
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }
  }
}
