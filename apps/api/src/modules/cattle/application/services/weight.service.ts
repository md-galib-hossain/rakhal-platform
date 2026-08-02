import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';

export type WeightHistoryPeriod = 'day' | 'week' | 'month' | 'year';

export interface WeightHistoryPoint {
  date: string;
  weightKg: number;
}

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

  /**
   * Period-bucketed weight history for the Overview tab's chart (day/week/month/year toggle).
   * One point per bucket — the most recent reading within it, not an average, since a scale
   * reading is a point-in-time fact, not a rate to sum. Window length scales with granularity so
   * the chart always shows a reasonable number of points (30 days, 26 weeks, 12 months, 5 years).
   */
  async periodHistory(
    farmId: string,
    cattleId: string,
    period: WeightHistoryPeriod = 'month',
  ): Promise<{ period: WeightHistoryPeriod; points: WeightHistoryPoint[] }> {
    await this.assertCattleInFarm(farmId, cattleId);

    const windowStart = this.periodWindowStart(period);
    const records = await this.prisma.weightRecord.findMany({
      where: { cattleId, recordedDate: { gte: windowStart } },
      orderBy: { recordedDate: 'asc' },
    });

    const byBucket = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      // Ascending order — the last write for a bucket key is always its most recent reading.
      byBucket.set(this.bucketKey(record.recordedDate, period), record);
    }

    const points = [...byBucket.values()]
      .sort((a, b) => a.recordedDate.getTime() - b.recordedDate.getTime())
      .map((r) => ({
        date: r.recordedDate.toISOString(),
        weightKg: r.weightKg,
      }));

    return { period, points };
  }

  private periodWindowStart(period: WeightHistoryPeriod): Date {
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 30 * DAY_MS);
      case 'week':
        return new Date(now.getTime() - 26 * 7 * DAY_MS);
      case 'year':
        return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      case 'month':
      default:
        return new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }
  }

  private bucketKey(date: Date, period: WeightHistoryPeriod): string {
    if (period === 'day') return date.toISOString().slice(0, 10);
    if (period === 'year') return String(date.getUTCFullYear());
    if (period === 'month') {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    // week — bucket by the Monday of that ISO week (UTC).
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = d.getUTCDay() || 7; // Sunday(0) -> 7
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d.toISOString().slice(0, 10);
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
