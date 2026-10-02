import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MilkSession,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { deriveOutstanding } from 'src/common/finance/txn-filters';
import { computeRunwaySnapshot } from 'src/common/finance/runway';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { RenewalReminderService } from 'src/modules/renewal/application/services/renewal-reminder.service';
import { ReconciliationService } from 'src/modules/billing/application/services/reconciliation.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { HealthService } from 'src/modules/health/application/services/health.service';
import { HealthReminderService } from 'src/modules/health/application/services/health-reminder.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { FeedPlanFitSweepService } from 'src/modules/feed/application/services/feed-plan-fit-sweep.service';
import { DEFAULT_SESSION_CONFIG } from 'src/modules/milk/domain/milk-anomaly';
import { buildDailyYieldSeries } from 'src/modules/reproduction/domain/lactation-curve';
import { daysBetween } from 'src/modules/reproduction/domain/lactation-yield';
import {
  DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS,
  DEFAULT_LOW_PEAK_BY_DIM_DAYS,
  DEFAULT_LOW_PEAK_MIN_YIELD_L,
  DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS,
  DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L,
  detectDryOffApproaching,
  detectDryOffOverdue,
  detectLongLactationNotPregnant,
  detectLowPeakByDim,
  detectLowProductionDryOffReview,
  detectMissingSession,
  detectPlannedDryOffDue,
  detectSuddenDrop,
} from 'src/modules/reproduction/domain/lactation-alerts';

const DAY_MS = 24 * 60 * 60 * 1000;
const BOSSES = ['Owner', 'Manager'];
/** 7 baseline days + the evaluated day (RAKHAL-286's sudden-drop/low-production window). */
const LACTATION_ALERT_WINDOW_DAYS = 8;

/**
 * Scheduled-job runner (RAKHAL-095, PRD §20.2). A daily 5 AM cron fans out the
 * **time-based** notification sweeps — the events the engine (RAKHAL-098) can't
 * raise from an instantaneous trigger (calving-soon, payment overdue, tasks
 * overdue, medicine expiring, heat-due, preg-check-due, dry-off-due,
 * supplier-due, runway-warning, semen-LN2-low, today's-tasks,
 * morbidity-outbreak). Sweeps read the data tables directly (the
 * Dashboard/Reports aggregator pattern — no cross-module service coupling),
 * **except `sweepSurvivalRunwayWarning`**, which calls Finance V2's
 * `BalanceService` + the shared `computeRunwaySnapshot` (`src/common/finance/
 * runway.ts`, RAKHAL-354) since runway has no dedicated table — it's a live
 * computation over liquidity/spend, same helper `DashboardService`'s
 * `financeSnapshot()` uses. Sweeps emit through
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
    private readonly balance: BalanceService,
    private readonly farmSettings: FarmSettingsService,
    private readonly healthService: HealthService,
    private readonly taskService: TaskService,
    private readonly feedFitSweep: FeedPlanFitSweepService,
    private readonly healthReminders: HealthReminderService,
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
      ['lactation_alerts', () => this.sweepLactationAlerts()],
      // MILESTONE 27 (RAKHAL-459b): stores each animal's program fit for the day; raises the 3-days-off-target digest.
      ['feed_plan_fit', () => this.feedFitSweep.sweepAll()],
      // RAKHAL-465 (MILESTONE 29): protocol-step reminders at T-7/T-3/T-1/day-of + the daily overdue nag.
      ['health_task_reminders', () => this.healthReminders.sweepAll()],
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
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
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

  /**
   * Receivables past their due date (PRD §20.2). Re-reminds daily until
   * settled. RAKHAL-354: V1 `FinanceReceivable` dropped — this used to sweep
   * it alongside V2 `Receivable` (RAKHAL-351's additive re-point, "V1 stays
   * live until RAKHAL-354 drops it"). V2 is now the sole source.
   */
  private async sweepPaymentOverdue(): Promise<number> {
    return this.sweepPaymentOverdueV2();
  }

  /**
   * `closedAt: null` already excludes
   * a fully-settled receivable (`ReceivableService.closeIfSettled` sets it
   * exactly when outstanding reaches zero); outstanding for the remaining
   * candidates is derived from `PaymentAllocation` in one batched query,
   * mirroring `ReceivableService.listReceivables`'s own approach.
   */
  private async sweepPaymentOverdueV2(): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.receivable.findMany({
      where: { dueDate: { lt: now }, closedAt: null },
      select: {
        id: true,
        farmId: true,
        totalAmount: true,
        dueDate: true,
        sale: { select: { saleNumber: true } },
      },
    });
    if (overdue.length === 0) return 0;

    const sums = await this.prisma.paymentAllocation.groupBy({
      by: ['receivableId'],
      where: { receivableId: { in: overdue.map((r) => r.id) } },
      _sum: { amount: true },
    });
    const allocatedById = new Map(
      sums.map((s) => [s.receivableId as string, s._sum.amount ?? 0]),
    );

    let emitted = 0;
    for (const r of overdue) {
      const outstanding = deriveOutstanding(
        r.totalAmount,
        allocatedById.get(r.id) ?? 0,
      );
      if (outstanding <= 0) continue;
      emitted += await this.emit({
        farmId: r.farmId,
        eventKey: 'payment_overdue',
        title: 'Payment Overdue',
        message: `${r.sale.saleNumber} is overdue: ৳${outstanding} (due ${this.ymd(r.dueDate!)}).`,
        params: {
          entityName: r.sale.saleNumber,
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
        deletedAt: null,
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
      where: {
        heatDateTime: { gte: windowStart, lt: windowEnd },
        resolvedAt: null,
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        cattleId: true,
        heatDateTime: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    let emitted = 0;
    for (const h of candidates) {
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
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
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
      where: {
        status: 'ACTIVE',
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
      },
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

  /**
   * Payables due within 3 days (PRD §20.2). Re-reminds daily until settled.
   * RAKHAL-354: V1 `FinanceReceivable(kind: PAYABLE)` dropped — this used to
   * sweep it alongside V2 `Payable` (RAKHAL-351's additive re-point). V2
   * (Purchasing module, RAKHAL-348 — a Purchase/Expense not fully paid at
   * creation) is now the sole source.
   */
  private async sweepSupplierPaymentDue(): Promise<number> {
    return this.sweepSupplierPaymentDueV2();
  }

  /**
   * `closedAt: null` already
   * excludes a fully-settled payable (`PayableService.closeIfSettled`), same
   * derived-outstanding batching as {@link sweepPaymentOverdueV2}. Display
   * name comes from whichever of `purchase.purchaseNumber`/`expense.
   * description` is set — exactly one always is (`Payable`'s own schema
   * invariant, `purchasing/payable.prisma`).
   */
  private async sweepSupplierPaymentDueV2(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 3 * DAY_MS);
    const payables = await this.prisma.payable.findMany({
      where: { dueDate: { gte: now, lte: horizon }, closedAt: null },
      select: {
        id: true,
        farmId: true,
        totalAmount: true,
        dueDate: true,
        purchase: { select: { purchaseNumber: true } },
        expense: { select: { description: true } },
      },
    });
    if (payables.length === 0) return 0;

    const sums = await this.prisma.paymentAllocation.groupBy({
      by: ['payableId'],
      where: { payableId: { in: payables.map((p) => p.id) } },
      _sum: { amount: true },
    });
    const allocatedById = new Map(
      sums.map((s) => [s.payableId as string, s._sum.amount ?? 0]),
    );

    let emitted = 0;
    for (const p of payables) {
      const outstanding = deriveOutstanding(
        p.totalAmount,
        allocatedById.get(p.id) ?? 0,
      );
      if (outstanding <= 0) continue;
      const entityName =
        p.purchase?.purchaseNumber ?? p.expense?.description ?? 'A payable';
      emitted += await this.emit({
        farmId: p.farmId,
        eventKey: 'supplier_payment_due_soon',
        title: 'Supplier Payment Due Soon',
        message: `${entityName} is due soon: ৳${outstanding} (due ${this.ymd(p.dueDate!)}).`,
        params: {
          entityName,
          amount: outstanding,
          date: this.ymd(p.dueDate!),
        },
        link: '/finance',
        dedupeKey: `supplier_payment_due_soon:${p.id}:${this.ymd(now)}`,
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
      const [rakhalBalance, thresholds] = await Promise.all([
        this.balance.getRakhalBalance(f.id),
        this.farmSettings.financeRunwayThresholds(f.id),
      ]);
      const snapshot = await computeRunwaySnapshot(
        this.prisma,
        f.id,
        Number(rakhalBalance.rakhalBalance),
        thresholds,
        now,
      );
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
      where: { deletedAt: null, ln2LevelPct: { lt: 30 } },
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
        deletedAt: null,
        status: { in: ['ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE'] },
        startDate: { gte: since },
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
      },
      _count: { _all: true },
    });

    let emitted = 0;
    for (const row of sickCounts) {
      // Normalized to deletedAt (RAKHAL-310) — status: 'ACTIVE' was a redundant,
      // less-reliable outlier: archival always sets deletedAt alongside
      // status (SOLD/DEAD/ARCHIVED/CULLED), deletedAt is the single source of truth.
      const herdSize = await this.prisma.cattle.count({
        where: activeHerd(row.farmId),
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
   * `RenewalReminderService`/`ReconciliationService`/`BalanceService` for
   * their respective domains rather than hand-rolling the query here). Not a
   * notification sweep — nothing to `emit()`, just the status transition; the
   * count returned is rows swept, for the `runDailySweeps()` results summary.
   */
  private async sweepSafetyWithdrawalsReadyForRelease(): Promise<number> {
    const { updated } =
      await this.healthService.sweepWithdrawalsReadyForRelease();
    return updated;
  }

  /**
   * RAKHAL-286: the 8-alert lactation set (missing session / sudden drop /
   * low-peak-by-DIM / long-lactation-not-pregnant / dry-off-approaching /
   * planned-dry-off-due / dry-off-overdue / low-production-dry-off-review).
   * Surfaces via the existing Task Hub (`TaskService.createInternal`) — **not**
   * a new notification channel, per the ticket's own explicit AC. Dedupe is a
   * marker embedded in `Task.details` (see `raiseLactationAlertTask`) rather
   * than this file's usual `NotificationService` `dedupeKey`, since these are
   * Tasks, not notifications. Detection logic itself is pure
   * (`domain/lactation-alerts.ts`) — this method only queries + assembles
   * inputs + raises tasks, mirroring every other sweep in this file.
   */
  private async sweepLactationAlerts(): Promise<number> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - DAY_MS);
    const windowStart = new Date(
      now.getTime() - LACTATION_ALERT_WINDOW_DAYS * DAY_MS,
    );

    const lactations = await this.prisma.lactation.findMany({
      where: {
        status: 'ACTIVE',
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        cattleId: true,
        startDate: true,
        recommendedDryOffAt: true,
        plannedDryOffAt: true,
        peakMilkYield: true,
        cattle: { select: { farmId: true, tagNumber: true, name: true } },
      },
    });

    const sessionsCache = new Map<string, MilkSession[]>();
    let created = 0;

    for (const l of lactations) {
      const farmId = l.cattle.farmId;
      const label = l.cattle.name ?? l.cattle.tagNumber;
      const tagNumber = l.cattle.tagNumber;

      let expectedSessions = sessionsCache.get(farmId);
      if (!expectedSessions) {
        const configured = await this.farmSettings.milkActiveSessions(farmId);
        expectedSessions =
          configured.length > 0 ? configured : DEFAULT_SESSION_CONFIG;
        sessionsCache.set(farmId, expectedSessions);
      }

      const entries = await this.prisma.milkLogEntry.findMany({
        where: {
          cattleId: l.cattleId,
          logDate: { gte: windowStart, lte: yesterday },
        },
        select: { logDate: true, session: true, yieldL: true },
      });
      const series = buildDailyYieldSeries({
        startDate: windowStart,
        endDate: yesterday,
        entries,
        expectedSessions,
      });
      if (series.length === 0) continue;

      const evalPoint = series[series.length - 1]; // yesterday — the most recent fully-elapsed day
      const baseline = series.slice(0, -1); // the (up to 7) days preceding it
      const currentDim = daysBetween(l.startDate, now);

      // 1. Missing session
      if (detectMissingSession({ dataQuality: evalPoint.dataQuality })) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: `MISSING_SESSION:${evalPoint.date}`,
          dedupeOpenOnly: false,
          name: `Missing milk-log session — ${label}`,
          details: `No milk-log session was recorded for ${label} (${tagNumber}) on ${evalPoint.date}.`,
          category: TaskCategory.MILKING,
          priority: TaskPriority.MEDIUM,
          dueAt: now,
        });
      }

      // 2. Sudden drop vs the preceding 7-day average
      if (baseline.length > 0) {
        const baselineAvgYieldL =
          Math.round(
            (baseline.reduce((sum, p) => sum + p.yieldL, 0) / baseline.length) *
              100,
          ) / 100;
        const dropThresholdPct =
          await this.farmSettings.lactationSuddenDropThresholdPct(farmId);
        const drop = detectSuddenDrop({
          evaluatedDayYieldL: evalPoint.yieldL,
          evaluatedDayDataQuality: evalPoint.dataQuality,
          baselineDaysDataQuality: baseline.map((p) => p.dataQuality),
          baselineAvgYieldL,
          dropThresholdPct,
        });
        if (drop.fired) {
          created += await this.raiseLactationAlertTask({
            farmId,
            cattleId: l.cattleId,
            tag: `SUDDEN_DROP:${evalPoint.date}`,
            dedupeOpenOnly: false,
            name: `Sudden milk-yield drop — ${label}`,
            details: `${label} (${tagNumber}) produced ${evalPoint.yieldL}L on ${evalPoint.date}, a ${drop.dropPct}% drop vs the preceding 7-day average (${baselineAvgYieldL}L).`,
            category: TaskCategory.MILKING,
            priority: TaskPriority.HIGH,
            dueAt: now,
          });
        }
      }

      // 3. Low-peak-by-DIM
      if (
        detectLowPeakByDim({
          currentDim,
          peakMilkYield: l.peakMilkYield,
          lowPeakByDimDays: DEFAULT_LOW_PEAK_BY_DIM_DAYS,
          minExpectedPeakYieldL: DEFAULT_LOW_PEAK_MIN_YIELD_L,
        })
      ) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: 'LOW_PEAK_BY_DIM',
          dedupeOpenOnly: true,
          name: `Low peak yield by DIM — ${label}`,
          details: `${label} (${tagNumber}) is at day ${currentDim} of milk without approaching a reasonable peak (recorded peak: ${l.peakMilkYield ?? 'none'} L).`,
          category: TaskCategory.MILKING,
          priority: TaskPriority.MEDIUM,
          dueAt: now,
        });
      }

      // 4. Long-lactation-not-pregnant (doubles as RAKHAL-285's "projection unavailable" surface)
      const longLactationDimThresholdDays =
        await this.farmSettings.lactationLongNotPregnantDimDays(farmId);
      if (currentDim >= longLactationDimThresholdDays) {
        const activePregnancy = await this.prisma.pregnancy.findFirst({
          where: { cattleId: l.cattleId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (
          detectLongLactationNotPregnant({
            currentDim,
            longLactationDimThresholdDays,
            hasActivePregnancy: !!activePregnancy,
          })
        ) {
          created += await this.raiseLactationAlertTask({
            farmId,
            cattleId: l.cattleId,
            tag: 'LONG_LACTATION_NOT_PREGNANT',
            dedupeOpenOnly: true,
            name: `Long lactation, not pregnant — ${label}`,
            details: `${label} (${tagNumber}) is at day ${currentDim} of milk with no active pregnancy on record — dry-off projection is a management estimate only.`,
            category: TaskCategory.BREEDING,
            priority: TaskPriority.MEDIUM,
            dueAt: now,
          });
        }
      }

      // 5. Recommended-dry-off-approaching
      if (
        detectDryOffApproaching({
          recommendedDryOffAt: l.recommendedDryOffAt,
          now,
          leadDays: DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS,
        })
      ) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: 'DRY_OFF_APPROACHING',
          dedupeOpenOnly: true,
          name: `Dry-off approaching — ${label}`,
          details: `${label} (${tagNumber}) has a recommended dry-off date of ${this.ymd(l.recommendedDryOffAt!)}.`,
          category: TaskCategory.BREEDING,
          priority: TaskPriority.MEDIUM,
          dueAt: l.recommendedDryOffAt!,
        });
      }

      // 6. Planned-dry-off-due (today)
      if (detectPlannedDryOffDue({ plannedDryOffAt: l.plannedDryOffAt, now })) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: `PLANNED_DRY_OFF_DUE:${this.ymd(now)}`,
          dedupeOpenOnly: false,
          name: `Planned dry-off due today — ${label}`,
          details: `${label} (${tagNumber}) is scheduled for dry-off today (${this.ymd(now)}).`,
          category: TaskCategory.BREEDING,
          priority: TaskPriority.HIGH,
          dueAt: now,
        });
      }

      // 7. Dry-off-overdue
      if (
        detectDryOffOverdue({ recommendedDryOffAt: l.recommendedDryOffAt, now })
      ) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: 'DRY_OFF_OVERDUE',
          dedupeOpenOnly: true,
          name: `Dry-off overdue — ${label}`,
          details: `${label} (${tagNumber})'s recommended dry-off date (${this.ymd(l.recommendedDryOffAt!)}) has passed with no dry-off recorded.`,
          category: TaskCategory.BREEDING,
          priority: TaskPriority.HIGH,
          dueAt: now,
        });
      }

      // 8. Low-production-dry-off-review — a recommendation only, never an automatic dry-off
      if (
        detectLowProductionDryOffReview({
          recentDailyYieldsL: series.map((p) => p.yieldL),
          thresholdL: DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L,
          consecutiveDaysRequired:
            DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS,
        })
      ) {
        created += await this.raiseLactationAlertTask({
          farmId,
          cattleId: l.cattleId,
          tag: 'LOW_PRODUCTION_DRY_OFF_REVIEW',
          dedupeOpenOnly: true,
          name: `Low production — review for dry-off — ${label}`,
          details: `${label} (${tagNumber}) has produced at or below ${DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L}L/day for ${DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS}+ consecutive days — recommend reviewing for dry-off (this is a suggestion, not an automatic dry-off).`,
          category: TaskCategory.BREEDING,
          priority: TaskPriority.MEDIUM,
          dueAt: now,
        });
      }
    }

    return created;
  }

  /**
   * Raises a Task Hub task for one lactation alert, deduped via a
   * `[LACTATION_ALERT:<tag>]` marker embedded in `Task.details` (Tasks have
   * no `dedupeKey` column the way notifications do). Date-scoped alerts
   * (`tag` includes an ISO date) dedupe against ANY existing task carrying
   * that exact marker — it's a one-time historical record, never re-raised.
   * Ongoing-condition alerts (`dedupeOpenOnly: true`) dedupe against any
   * still-OPEN (`PENDING`/`IN_PROGRESS`/`BLOCKED`) task with that marker, so
   * they re-fire once the farmer completes/dismisses the previous one rather
   * than spamming a fresh task every single day the condition persists.
   */
  private async raiseLactationAlertTask(params: {
    farmId: string;
    cattleId: string;
    tag: string;
    dedupeOpenOnly: boolean;
    name: string;
    details: string;
    category: TaskCategory;
    priority: TaskPriority;
    dueAt: Date;
  }): Promise<number> {
    const marker = `[LACTATION_ALERT:${params.tag}]`;
    const existing = await this.prisma.task.findFirst({
      where: {
        farmId: params.farmId,
        relatedCattleId: params.cattleId,
        details: { contains: marker },
        ...(params.dedupeOpenOnly
          ? { status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] } }
          : {}),
      },
      select: { id: true },
    });
    if (existing) return 0;

    await this.taskService.createInternal({
      farmId: params.farmId,
      createdBy: 'SYSTEM',
      name: params.name,
      details: `${marker} ${params.details}`,
      category: params.category,
      priority: params.priority,
      dueAt: params.dueAt,
      source: TaskSource.SYSTEM_AUTO,
      relatedCattleId: params.cattleId,
    });
    return 1;
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
