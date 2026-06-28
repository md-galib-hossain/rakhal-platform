import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const BOSSES = ['Owner', 'Manager'];

/**
 * Scheduled-job runner (RAKHAL-095, PRD §20.2). A daily 5 AM cron fans out the
 * **time-based** notification sweeps — the events the engine (RAKHAL-098) can't
 * raise from an instantaneous trigger (calving-soon, payment overdue, tasks
 * overdue, medicine expiring). Sweeps read the data tables directly (the
 * Dashboard/Reports aggregator pattern — no cross-module service coupling) and
 * emit through `NotificationService` with a **dedupe key** so a re-run (or app
 * restart) on the same day doesn't double-notify. `runDailySweeps()` is public so
 * it can be invoked deterministically in tests instead of waiting for the cron.
 */
@Injectable()
export class SchedulerService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SchedulerService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM, { name: 'daily-notification-sweeps' })
  async runDailySweeps(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    for (const [name, sweep] of [
      ['calving_expected_3_days', () => this.sweepCalvingExpected()],
      ['payment_overdue', () => this.sweepPaymentOverdue()],
      ['task_overdue', () => this.sweepTasksOverdue()],
      ['medicine_expiring_30_days', () => this.sweepMedicineExpiring()],
    ] as const) {
      try {
        results[name] = await sweep();
      } catch (err) {
        results[name] = -1;
        this.log.error(`Sweep "${name}" failed`, err);
      }
    }
    this.log.info('Daily notification sweeps complete', results);
    return results;
  }

  // ---- sweeps -------------------------------------------------------------

  /** Pregnancies due to calve within 3 days (PRD §20.2). Re-reminds daily. */
  private async sweepCalvingExpected(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * DAY_MS);
    const pregnancies = await this.prisma.pregnancy.findMany({
      where: {
        status: 'ACTIVE',
        expectedCalvingDate: { gte: now, lte: horizon },
      },
      select: {
        id: true,
        expectedCalvingDate: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    let emitted = 0;
    for (const p of pregnancies) {
      const label = p.cattle.name ?? p.cattle.tagNumber;
      emitted += await this.emit({
        farmId: p.cattle.farmId,
        eventKey: 'calving_expected_3_days',
        title: 'Calving Expected in 3 Days',
        message: `${label} (${p.cattle.tagNumber}) is expected to calve on ${this.ymd(p.expectedCalvingDate!)}.`,
        link: '/reproduction',
        dedupeKey: `calving_expected_3_days:${p.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /** Receivables past their due date (PRD §20.2). Re-reminds daily until settled. */
  private async sweepPaymentOverdue(): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.financeReceivable.findMany({
      where: {
        kind: 'RECEIVABLE',
        dueDate: { lt: now },
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      select: {
        id: true,
        farmId: true,
        entityName: true,
        total: true,
        paid: true,
        dueDate: true,
      },
    });

    let emitted = 0;
    for (const r of overdue) {
      const outstanding = Math.round((r.total - r.paid) * 100) / 100;
      emitted += await this.emit({
        farmId: r.farmId,
        eventKey: 'payment_overdue',
        title: 'Payment Overdue',
        message: `${r.entityName ?? 'A receivable'} is overdue: ৳${outstanding} (due ${this.ymd(r.dueDate!)}).`,
        link: '/finance/receivables',
        dedupeKey: `payment_overdue:${r.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /** Tasks whose due date has passed and aren't completed (PRD §20.2). Daily. */
  private async sweepTasksOverdue(): Promise<number> {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: {
        dueAt: { lt: now },
        status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
      },
      select: { id: true, farmId: true, name: true, dueAt: true },
    });

    let emitted = 0;
    for (const t of tasks) {
      emitted += await this.emit({
        farmId: t.farmId,
        eventKey: 'task_overdue',
        title: 'Task Overdue',
        message: `"${t.name}" was due ${this.ymd(t.dueAt)} and is not complete.`,
        link: '/tasks',
        dedupeKey: `task_overdue:${t.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /** In-stock medicine batches expiring within 30 days (PRD §20.2). Once per batch. */
  private async sweepMedicineExpiring(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * DAY_MS);
    const meds = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expiryDate: { gte: now, lte: horizon },
      },
      select: { id: true, farmId: true, name: true, expiryDate: true },
    });

    let emitted = 0;
    for (const m of meds) {
      emitted += await this.emit({
        farmId: m.farmId,
        eventKey: 'medicine_expiring_30_days',
        title: 'Medicine Expiring in 30 Days',
        message: `${m.name} expires on ${this.ymd(m.expiryDate)}.`,
        link: '/inventory/medicine',
        // No date in the key → one alert per batch (avoids a 30-day daily drip).
        dedupeKey: `medicine_expiring_30_days:${m.id}`,
      });
    }
    return emitted;
  }

  // ---- helpers ------------------------------------------------------------

  private async emit(input: {
    farmId: string;
    eventKey: string;
    title: string;
    message: string;
    link: string;
    dedupeKey: string;
  }): Promise<number> {
    const created = await this.notifications.notifyFarmRoles({
      ...input,
      roleNames: BOSSES,
    });
    return created.length;
  }

  private ymd(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
