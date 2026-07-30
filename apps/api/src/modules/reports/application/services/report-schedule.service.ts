import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportScheduleFrequency } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { isKnownReport } from '../../domain/report-catalogue';
import { CreateReportScheduleDto } from '../../presentation/dto/create-report-schedule.dto';

/**
 * Scheduled reports (PRD §22.3, RD-013c, V1.5). Owns the `ReportSchedule` CRUD;
 * the actual firing (enqueue + `nextRunAt` advance) lives in
 * `ReportScheduleRunner`'s daily cron, which shares the `computeNextRun` helper
 * exported here so "create" and "re-fire" agree on the same cadence math.
 */
@Injectable()
export class ReportScheduleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportScheduleService.name);
  }

  /** `POST /reports/schedules`. */
  async create(farmId: string, userId: string, dto: CreateReportScheduleDto) {
    if (!isKnownReport(dto.reportId)) {
      throw new BadRequestException(`Unknown report: ${dto.reportId}`);
    }
    if (dto.frequency === ReportScheduleFrequency.WEEKLY && !dto.dayOfWeek) {
      throw new BadRequestException(
        'dayOfWeek is required for a WEEKLY schedule',
      );
    }
    if (dto.frequency === ReportScheduleFrequency.MONTHLY && !dto.dayOfMonth) {
      throw new BadRequestException(
        'dayOfMonth is required for a MONTHLY schedule',
      );
    }

    const nextRunAt = computeNextRun(new Date(), {
      frequency: dto.frequency,
      dayOfWeek: dto.dayOfWeek,
      dayOfMonth: dto.dayOfMonth,
    });

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        farmId,
        reportId: dto.reportId,
        format: dto.format,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: (dto.parameters ?? {}) as any,
        frequency: dto.frequency,
        dayOfWeek: dto.dayOfWeek,
        dayOfMonth: dto.dayOfMonth,
        nextRunAt,
        createdBy: userId,
      },
    });
    this.log.info('Report schedule created', {
      scheduleId: schedule.id,
      farmId,
      reportId: dto.reportId,
      frequency: dto.frequency,
      nextRunAt,
    });
    return this.toDto(schedule);
  }

  /** `GET /reports/schedules`. */
  async list(farmId: string) {
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { farmId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { schedules: schedules.map((s) => this.toDto(s)) };
  }

  /** `DELETE /reports/schedules/:id` — hard delete (no history value in keeping a cancelled schedule). */
  async remove(farmId: string, id: string): Promise<void> {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: { id, farmId },
      select: { id: true },
    });
    if (!schedule) {
      throw new NotFoundException('Report schedule not found');
    }
    await this.prisma.reportSchedule.delete({ where: { id } });
    this.log.info('Report schedule removed', { scheduleId: id, farmId });
  }

  private toDto(schedule: {
    id: string;
    reportId: string;
    format: string;
    frequency: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    isActive: boolean;
    nextRunAt: Date;
    lastRunAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: schedule.id,
      report_id: schedule.reportId,
      format: schedule.format.toLowerCase(),
      frequency: schedule.frequency.toLowerCase(),
      day_of_week: schedule.dayOfWeek,
      day_of_month: schedule.dayOfMonth,
      is_active: schedule.isActive,
      next_run_at: schedule.nextRunAt,
      last_run_at: schedule.lastRunAt,
      created_at: schedule.createdAt,
    };
  }
}

/**
 * Next fire time strictly after `from`, per the schedule's cadence. DAILY
 * fires once every 24h; WEEKLY/MONTHLY land on the given day at 06:00 UTC
 * (after the 5 AM notification sweeps, PRD §20.2) — deterministic and
 * independent of what time of day the schedule was created.
 */
export function computeNextRun(
  from: Date,
  schedule: {
    frequency: ReportScheduleFrequency;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
  },
): Date {
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (schedule.frequency === ReportScheduleFrequency.DAILY) {
    const next = new Date(from.getTime() + DAY_MS);
    next.setUTCHours(6, 0, 0, 0);
    if (next.getTime() <= from.getTime()) next.setTime(next.getTime() + DAY_MS);
    return next;
  }

  if (schedule.frequency === ReportScheduleFrequency.WEEKLY) {
    const targetIso = schedule.dayOfWeek ?? 1; // 1=Mon..7=Sun
    const next = new Date(from.getTime());
    next.setUTCHours(6, 0, 0, 0);
    do {
      next.setTime(next.getTime() + DAY_MS);
    } while (
      isoWeekday(next) !== targetIso ||
      next.getTime() <= from.getTime()
    );
    return next;
  }

  // MONTHLY
  const targetDay = schedule.dayOfMonth ?? 1;
  const next = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), targetDay, 6, 0, 0, 0),
  );
  if (next.getTime() <= from.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}
