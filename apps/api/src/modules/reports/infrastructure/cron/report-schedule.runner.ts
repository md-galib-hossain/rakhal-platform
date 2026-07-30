import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportsService } from '../../application/services/reports.service';
import { computeNextRun } from '../../application/services/report-schedule.service';

/**
 * Fires due `ReportSchedule`s (PRD §22.3, RD-013c). Runs hourly (not daily,
 * unlike `SchedulerService`'s notification sweeps) since a WEEKLY/MONTHLY
 * schedule's `nextRunAt` lands at a specific hour (06:00 UTC) — a daily-only
 * cron could miss it depending on when the cron itself runs relative to that.
 * Each firing enqueues a `ReportJob` via the same BullMQ queue as an on-demand
 * `POST /reports/generate` (RD-013a), tagged with `scheduleId`, then advances
 * `nextRunAt` so it isn't re-fired next hour.
 */
@Injectable()
export class ReportScheduleRunner {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportScheduleRunner.name);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'report-schedule-runner' })
  async runDueSchedules(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.reportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });

    let fired = 0;
    for (const schedule of due) {
      try {
        await this.reportsService.generateForSchedule({
          id: schedule.id,
          farmId: schedule.farmId,
          reportId: schedule.reportId,
          format: schedule.format,
          params: schedule.params,
          createdBy: schedule.createdBy,
        });
        const nextRunAt = computeNextRun(now, {
          frequency: schedule.frequency,
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
        });
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt },
        });
        fired += 1;
      } catch (err) {
        this.log.error('Report schedule firing failed', err, {
          scheduleId: schedule.id,
          farmId: schedule.farmId,
        });
      }
    }
    if (fired > 0) {
      this.log.info('Report schedules fired', { count: fired });
    }
    return fired;
  }
}
