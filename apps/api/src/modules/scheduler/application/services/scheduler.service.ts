import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { RenewalReminderService } from 'src/modules/renewal/application/services/renewal-reminder.service';
import { ReconciliationService } from 'src/modules/billing/application/services/reconciliation.service';
import { FinanceService } from 'src/modules/finance/application/services/finance.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { HealthService } from 'src/modules/health/application/services/health.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const BOSSES = ['Owner', 'Manager'];

/**
 * Scheduled-job runner (RAKHAL-095, PRD §20.2). A daily 5 AM cron fans out the
 * **time-based** notification sweeps — the events the engine (RAKHAL-098) can't
 * raise from an instantaneous trigger (calving-soon, payment overdue, tasks
 * overdue, medicine expiring, heat-due, preg-check-due, dry-off-due,
 * supplier-due, runway-warning, semen-LN2-low, today's-tasks,
 * morbidity-outbreak). Sweeps read the data tables directly (the
 * Dashboard/Reports aggregator pattern — no cross-module service coupling),
 * **except `sweepSurvivalRunwayWarning`**, which calls `FinanceService` since
 * runway has no dedicated table — it's a live computation over liquidity/spend
 * shared with the Finance highlights endpoint. Sweeps emit through
 * `NotificationService` with a **dedupe key** so a re-run (or app restart) on
 * the same day doesn't double-notify. `runDailySweeps()` is public so it can be
 * invoked deterministically in tests instead of waiting for the cron.
 * `withholding_active` is deliberately NOT a sweep here — its PRD trigger is
 * "treatment logged with withdrawal days", an instant event, emitted directly
 * from `HealthService.logTreatment`. **(2026-08-05, RAKHAL-276)** this file
 * also hosts the daily `SafetyWithdrawal` `ACTIVE` -> `READY_FOR_RELEASE`
 * sweep (`sweepSafetyWithdrawalsReadyForRelease`) — not a notification, just
 * the status transition a query method must never perform as a side effect.
 */
@Injectable()
export class SchedulerService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
    private readonly renewalReminders: RenewalReminderService,
    private readonly reconciliation: ReconciliationService,
    private readonly financeService: FinanceService,
    private readonly farmSettings: FarmSettingsService,
    private readonly healthService: HealthService,
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
      ['cow_expected_in_heat', () => this.sweepHeatDue()],
      ['pregnancy_check_due', () => this.sweepPregnancyCheckDue()],
      ['dry_off_due_14_days', () => this.sweepDryOffDue()],
      ['supplier_payment_due_soon', () => this.sweepSupplierPaymentDue()],
      ['survival_runway_warning', () => this.sweepSurvivalRunwayWarning()],
      ['semen_tank_low_ln2', () => this.sweepSemenTankLowLn2()],
      ['todays_tasks_ready', () => this.sweepTodaysTasksReady()],
      ['morbidity_outbreak', () => this.sweepMorbidityOutbreak()],
      ['subscription_expiry', () => this.sweepSubscriptionExpiry()],
      // Runs after the expiry sweep so EXPIRED status is current for win-back.
      ['renewal_reminders', () => this.sweepRenewalReminders()],
      ['settlement_reconciliation', () => this.sweepReconciliation()],
      [
        'safety_withdrawals_ready_for_release',
        () => this.sweepSafetyWithdrawalsReadyForRelease(),
      ],
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
        params: {
          name: label,
          tagNumber: p.cattle.tagNumber,
          date: this.ymd(p.expectedCalvingDate!),
        },
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
        params: {
          entityName: r.entityName ?? 'A receivable',
          amount: outstanding,
          date: this.ymd(r.dueDate!),
        },
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
        params: { name: t.name, date: this.ymd(t.dueAt) },
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
        params: { name: m.name, date: this.ymd(m.expiryDate) },
        link: '/inventory/medicine',
        // No date in the key → one alert per batch (avoids a 30-day daily drip).
        dedupeKey: `medicine_expiring_30_days:${m.id}`,
      });
    }
    return emitted;
  }

  /** Cows ~19 days past their last heat with no newer heat/breeding since (PRD §20.2). Once per heat. */
  private async sweepHeatDue(): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 20 * DAY_MS);
    const windowEnd = new Date(now.getTime() - 19 * DAY_MS);
    const candidates = await this.prisma.heatEvent.findMany({
      where: { heatDateTime: { gte: windowStart, lt: windowEnd } },
      select: {
        id: true,
        cattleId: true,
        heatDateTime: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    let emitted = 0;
    for (const h of candidates) {
      const [newerHeat, bredSince] = await Promise.all([
        this.prisma.heatEvent.findFirst({
          where: { cattleId: h.cattleId, heatDateTime: { gt: h.heatDateTime } },
          select: { id: true },
        }),
        this.prisma.breedingEvent.findFirst({
          where: {
            cattleId: h.cattleId,
            breedingDate: { gte: h.heatDateTime },
          },
          select: { id: true },
        }),
      ]);
      if (newerHeat || bredSince) continue;
      const label = h.cattle.name ?? h.cattle.tagNumber;
      emitted += await this.emit({
        farmId: h.cattle.farmId,
        eventKey: 'cow_expected_in_heat',
        title: 'Cow Expected in Heat',
        message: `${label} (${h.cattle.tagNumber}) is expected back in heat (last heat ${this.ymd(h.heatDateTime)}).`,
        params: {
          name: label,
          tagNumber: h.cattle.tagNumber,
          date: this.ymd(h.heatDateTime),
        },
        link: '/reproduction',
        dedupeKey: `cow_expected_in_heat:${h.id}`,
      });
    }
    return emitted;
  }

  /** Breedings whose pregnancy-check date has arrived and are still pending (PRD §20.2). Once per breeding. */
  private async sweepPregnancyCheckDue(): Promise<number> {
    const now = new Date();
    const events = await this.prisma.breedingEvent.findMany({
      where: {
        status: 'PENDING_CHECK',
        expectedPregnancyCheckDate: { lte: now },
      },
      select: {
        id: true,
        expectedPregnancyCheckDate: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    let emitted = 0;
    for (const e of events) {
      const label = e.cattle.name ?? e.cattle.tagNumber;
      emitted += await this.emit({
        farmId: e.cattle.farmId,
        eventKey: 'pregnancy_check_due',
        title: 'Pregnancy Check Due',
        message: `${label} (${e.cattle.tagNumber}) is due for a pregnancy check (expected ${this.ymd(e.expectedPregnancyCheckDate!)}).`,
        params: {
          name: label,
          tagNumber: e.cattle.tagNumber,
          date: this.ymd(e.expectedPregnancyCheckDate!),
        },
        link: '/reproduction',
        dedupeKey: `pregnancy_check_due:${e.id}`,
      });
    }
    return emitted;
  }

  /** Active lactations within 14 days of the farm's dry-off target DIM (PRD §20.2). Once per lactation. */
  private async sweepDryOffDue(): Promise<number> {
    const now = new Date();
    const lactations = await this.prisma.lactation.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        startDate: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    const targetDaysCache = new Map<string, number>();
    let emitted = 0;
    for (const l of lactations) {
      const farmId = l.cattle.farmId;
      let targetDays = targetDaysCache.get(farmId);
      if (targetDays === undefined) {
        targetDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
        targetDaysCache.set(farmId, targetDays);
      }
      const dim = Math.floor((now.getTime() - l.startDate.getTime()) / DAY_MS);
      if (dim < targetDays - 14 || dim >= targetDays) continue;
      const label = l.cattle.name ?? l.cattle.tagNumber;
      emitted += await this.emit({
        farmId,
        eventKey: 'dry_off_due_14_days',
        title: 'Dry-Off Due in 14 Days',
        message: `${label} (${l.cattle.tagNumber}) is approaching dry-off (day ${dim} of ${targetDays}).`,
        params: {
          name: label,
          tagNumber: l.cattle.tagNumber,
          day: dim,
          target: targetDays,
        },
        link: '/reproduction',
        dedupeKey: `dry_off_due_14_days:${l.id}`,
      });
    }
    return emitted;
  }

  /** Payables due within 3 days (PRD §20.2). Re-reminds daily until settled. */
  private async sweepSupplierPaymentDue(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * DAY_MS);
    const payables = await this.prisma.financeReceivable.findMany({
      where: {
        kind: 'PAYABLE',
        dueDate: { gte: now, lte: horizon },
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
    for (const r of payables) {
      const outstanding = Math.round((r.total - r.paid) * 100) / 100;
      emitted += await this.emit({
        farmId: r.farmId,
        eventKey: 'supplier_payment_due_soon',
        title: 'Supplier Payment Due Soon',
        message: `${r.entityName ?? 'A payable'} is due soon: ৳${outstanding} (due ${this.ymd(r.dueDate!)}).`,
        params: {
          entityName: r.entityName ?? 'A payable',
          amount: outstanding,
          date: this.ymd(r.dueDate!),
        },
        link: '/finance',
        dedupeKey: `supplier_payment_due_soon:${r.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /** Cash runway below the farm's warning/critical thresholds (PRD §20.2). Re-reminds daily while unhealthy. */
  private async sweepSurvivalRunwayWarning(): Promise<number> {
    const now = new Date();
    const farms = await this.prisma.farm.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    let emitted = 0;
    for (const f of farms) {
      const snapshot = await this.financeService.getRunwaySnapshot(f.id, now);
      if (snapshot.status !== 'warning' && snapshot.status !== 'critical')
        continue;
      emitted += await this.emit({
        farmId: f.id,
        eventKey: 'survival_runway_warning',
        title: 'Survival Runway Warning',
        message: `Cash runway is ${snapshot.status} — about ${snapshot.days ?? 0} day(s) left at current spend.`,
        params: { status: snapshot.status, days: snapshot.days ?? 0 },
        link: '/finance',
        dedupeKey: `survival_runway_warning:${f.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /** Active semen tanks with LN2 below 30% (PRD §20.2). Ongoing risk — re-reminds daily. */
  private async sweepSemenTankLowLn2(): Promise<number> {
    const now = new Date();
    const tanks = await this.prisma.semenTank.findMany({
      where: { isActive: true, ln2LevelPct: { lt: 30 } },
      select: { id: true, farmId: true, name: true, ln2LevelPct: true },
    });

    let emitted = 0;
    for (const t of tanks) {
      emitted += await this.emit({
        farmId: t.farmId,
        eventKey: 'semen_tank_low_ln2',
        title: 'Semen Tank Low LN2',
        message: `${t.name}'s LN2 level is low (${t.ln2LevelPct}%).`,
        params: { name: t.name, level: t.ln2LevelPct ?? 0 },
        link: '/inventory',
        dedupeKey: `semen_tank_low_ln2:${t.id}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /**
   * Each assignee's tasks due today (PRD §20.2) — per-user, unlike every other
   * sweep (which notifies Owner+Manager). Unassigned tasks are skipped: there's
   * no "your tasks" framing without an owner.
   */
  private async sweepTodaysTasksReady(): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endOfDay = new Date(startOfDay.getTime() + DAY_MS);
    const tasks = await this.prisma.task.findMany({
      where: {
        dueAt: { gte: startOfDay, lt: endOfDay },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        assignedToId: { not: null },
      },
      select: { farmId: true, assignedToId: true },
    });

    const byUser = new Map<string, { farmId: string; count: number }>();
    for (const t of tasks) {
      if (!t.assignedToId) continue;
      const entry = byUser.get(t.assignedToId) ?? {
        farmId: t.farmId,
        count: 0,
      };
      entry.count += 1;
      byUser.set(t.assignedToId, entry);
    }

    let emitted = 0;
    for (const [userId, { farmId, count }] of byUser) {
      const created = await this.notifications.notifyUsers({
        farmId,
        userIds: [userId],
        eventKey: 'todays_tasks_ready',
        title: "Today's Tasks Ready",
        message: `You have ${count} task(s) due today.`,
        params: { count },
        link: '/tasks',
        dedupeKey: `todays_tasks_ready:${userId}:${this.ymd(now)}`,
      });
      emitted += created.length;
    }
    return emitted;
  }

  /** >5% of a farm's active herd sick within the last 48h (PRD §20.2). Re-reminds daily while active. */
  private async sweepMorbidityOutbreak(): Promise<number> {
    const now = new Date();
    const since = new Date(now.getTime() - 2 * DAY_MS);
    const sickCounts = await this.prisma.healthCase.groupBy({
      by: ['farmId'],
      where: {
        status: { in: ['ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE'] },
        startDate: { gte: since },
      },
      _count: { _all: true },
    });

    let emitted = 0;
    for (const row of sickCounts) {
      const herdSize = await this.prisma.cattle.count({
        where: { farmId: row.farmId, status: 'ACTIVE' },
      });
      if (herdSize === 0) continue;
      const rate = row._count._all / herdSize;
      if (rate <= 0.05) continue;
      emitted += await this.emit({
        farmId: row.farmId,
        eventKey: 'morbidity_outbreak',
        title: 'Morbidity Outbreak Alert',
        message: `${row._count._all} of ${herdSize} animals (${Math.round(rate * 100)}%) reported sick in the last 48 hours.`,
        params: {
          sick: row._count._all,
          herd: herdSize,
          pct: Math.round(rate * 100),
        },
        link: '/healthcare',
        dedupeKey: `morbidity_outbreak:${row.farmId}:${this.ymd(now)}`,
      });
    }
    return emitted;
  }

  /**
   * Subscription lifecycle transitions (RAKHAL-218, SUB-03): flip expired
   * ACTIVE/TRIALING → PAST_DUE (grace) → EXPIRED. Delegates to the subscription
   * module (owns the cache invalidation). **No auto-charge** (ADR-014); renewal
   * reminders are RAKHAL-240. Returns the count of transitions.
   */
  private async sweepSubscriptionExpiry(): Promise<number> {
    const { pastDue, expired } =
      await this.subscriptionLifecycle.runExpirySweep();
    return pastDue + expired;
  }

  /**
   * Renewal reminders + win-back (RAKHAL-240): pre-expiry T-7/3/1/expiry-day +
   * post-expiry T+3/7/30 nudges, idempotent per (subscription, stage). **No
   * auto-charge** — reminders only.
   */
  private async sweepRenewalReminders(): Promise<number> {
    const { preExpiry, winback } =
      await this.renewalReminders.runRenewalSweep();
    return preExpiry + winback;
  }

  /**
   * Settlement reconciliation (RAKHAL-239): re-query the gateway for recent
   * payments + flag discrepancies for admin clearing. Read-only to the ledger.
   */
  private async sweepReconciliation(): Promise<number> {
    const { flagged } = await this.reconciliation.runReconciliation();
    return flagged;
  }

  /**
   * RAKHAL-276: the real home for the `ACTIVE` -> `READY_FOR_RELEASE`
   * transition that a v1 design had incorrectly running as a side effect of
   * `HealthService.activeMilkWithholdingCattleIds` (a query method). Across
   * every farm, once a day — delegates to `HealthService` rather than
   * duplicating the update query directly, since that service is the single
   * source of truth for `SafetyWithdrawal` writes (mirrors this file's
   * existing precedent of calling into `SubscriptionLifecycleService`/
   * `RenewalReminderService`/`ReconciliationService`/`FinanceService` for
   * their respective domains rather than hand-rolling the query here). Not a
   * notification sweep — nothing to `emit()`, just the status transition; the
   * count returned is rows swept, for the `runDailySweeps()` results summary.
   */
  private async sweepSafetyWithdrawalsReadyForRelease(): Promise<number> {
    const { updated } =
      await this.healthService.sweepWithdrawalsReadyForRelease();
    return updated;
  }

  // ---- helpers ------------------------------------------------------------

  private async emit(input: {
    farmId: string;
    eventKey: string;
    title: string;
    message: string;
    params?: Record<string, string | number>;
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
