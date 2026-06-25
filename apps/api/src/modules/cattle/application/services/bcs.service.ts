import { Injectable, NotFoundException } from '@nestjs/common';
import { PregnancyStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { BCS_DROP_WINDOW_DAYS } from '../../domain/cattle.constants';
import { computeBcsAlerts } from '../../domain/bcs-alerts';
import { RecordBcsDto } from '../../presentation/dto/record-bcs.dto';

/**
 * Body Condition Scoring (PRD §8.6, RAKHAL-038). Records a BCS reading, keeps
 * the denormalized `Cattle.lastBcs` in sync, and raises the PRD alerts
 * (near-calving deviations + excessive mobilization). Worker-permitted
 * (`cattle.bcs`). Farm-scoped via the owning cattle row.
 */
@Injectable()
export class BcsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(BcsService.name);
  }

  async recordBcs(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: RecordBcsDto,
  ) {
    await this.assertCattleInFarm(farmId, cattleId);

    const recordedDate = dto.date ? new Date(dto.date) : new Date();

    const record = await this.prisma.bodyConditionScore.create({
      data: {
        cattleId,
        score: dto.score,
        recordedDate,
        recordedBy: userId,
        notes: dto.notes,
      },
    });

    await this.prisma.cattle.update({
      where: { id: cattleId },
      data: { lastBcs: dto.score },
    });

    const alerts = await this.computeAlerts(cattleId, dto.score, recordedDate);

    this.log.info('BCS recorded', {
      cattleId,
      farmId,
      score: dto.score,
      alerts: alerts.length,
    });

    return { record, lastBcs: dto.score, alerts };
  }

  /** Recent BCS history for the BCS trend chart (PRD §8.5/§8.6). */
  async history(farmId: string, cattleId: string, limit = 50) {
    await this.assertCattleInFarm(farmId, cattleId);
    return this.prisma.bodyConditionScore.findMany({
      where: { cattleId },
      orderBy: { recordedDate: 'desc' },
      take: limit,
    });
  }

  private async computeAlerts(
    cattleId: string,
    score: number,
    recordedDate: Date,
  ) {
    const windowStart = new Date(recordedDate);
    windowStart.setDate(windowStart.getDate() - BCS_DROP_WINDOW_DAYS);

    const [pregnancy, prior] = await Promise.all([
      this.prisma.pregnancy.findFirst({
        where: { cattleId, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
        select: { expectedCalvingDate: true },
      }),
      this.prisma.bodyConditionScore.findFirst({
        where: {
          cattleId,
          recordedDate: { gte: windowStart, lt: recordedDate },
        },
        orderBy: { recordedDate: 'desc' },
        select: { score: true },
      }),
    ]);

    return computeBcsAlerts({
      score,
      recordedDate,
      expectedCalvingDate: pregnancy?.expectedCalvingDate,
      priorScore: prior?.score,
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
