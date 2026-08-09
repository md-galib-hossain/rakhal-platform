import { Injectable } from '@nestjs/common';
import {
  CattleGender,
  CattlePurpose,
  HealthCaseStatus,
  HealthTaskStatus,
  LactationStatus,
  MilkTankType,
  PregnancyStatus,
  ProductionStatus,
  ReceivableKind,
  ReceivableStatus,
  ReproductionState,
  SafetyWithdrawalStatus,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import { FinanceService } from 'src/modules/finance/application/services/finance.service';
import { MilkService } from 'src/modules/milk/application/services/milk.service';
import { HealthService } from 'src/modules/health/application/services/health.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import {
  ANIMAL_CATEGORIES,
  buildAnimalCategoryWhere,
} from 'src/modules/cattle/domain/animal-category';
import { deriveLactationStage } from 'src/modules/reproduction/domain/lactation-stage';
import { DashboardPeriod } from '../../presentation/dto/dashboard-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/**
 * Dashboard — "Morning Briefing" (PRD §7, API §3). A **read-only** cross-module
 * aggregator: it composes the headline KPIs, priorities, and widgets from the
 * already-built feature modules. Heavy KPIs are delegated to the owning service
 * (`FinanceService`, `MilkService`, `HealthService`) to avoid logic drift; the
 * rest are direct farm-scoped reads. `farmId` comes from the token context.
 */
@Injectable()
export class DashboardService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly milk: MilkService,
    private readonly health: HealthService,
    private readonly farmSettings: FarmSettingsService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(DashboardService.name);
  }

  // ---- Headline KPI bar (§7.2) --------------------------------------------

  async kpis(farmId: string) {
    const [finance, milk, health, healthThreshold] = await Promise.all([
      this.finance.highlights(farmId),
      this.milk.overview(farmId),
      this.health.getHealthDashboard(farmId),
      this.farmSettings.healthScoreWarningPct(farmId),
    ]);
    const yieldChangePct = this.changePct(
      milk.today.totalL,
      milk.yesterday.totalL,
    );
    return {
      costPerLitre: {
        value: finance.costPerLitreThisMonth,
        currency: 'Tk',
      },
      todaysYield: {
        value: milk.today.totalL,
        unit: 'L',
        changePct: yieldChangePct,
        changeDirection:
          yieldChangePct == null ? null : yieldChangePct >= 0 ? 'up' : 'down',
        changePeriod: 'vs_yesterday',
      },
      herdHealth: {
        value: health.herdHealthScore,
        unit: '%',
        sickCount: health.sickBayCount,
        threshold: healthThreshold,
      },
      cashRunway: {
        value: finance.survivalRunwayDays,
        unit: 'days',
        status: finance.survivalRunwayStatus,
      },
    };
  }

  // ---- Production Summary widget (§7.3) ------------------------------------

  async productionSummary(farmId: string, period: DashboardPeriod) {
    const overview = await this.milk.overview(farmId);
    if (period === 'today') {
      return {
        period,
        totalYieldL: overview.today.totalL,
        sellableL: overview.today.sellableL,
        withholdingL: overview.today.withholdingL,
        calfAllocationL: overview.today.calfL,
        comparison: {
          yesterday: overview.yesterday.totalL,
          sameDayLastWeek: overview.sameDayLastWeek.totalL,
          sameDayLastYear: overview.sameDayLastYear.totalL,
        },
        sessions: overview.sessionsStatus,
      };
    }
    const { gte } = this.periodRange(period);
    const rows = await this.prisma.milkLogEntry.groupBy({
      by: ['tankType'],
      where: { farmId, submitted: true, logDate: { gte } },
      _sum: { yieldL: true },
    });
    const byType = new Map(rows.map((r) => [r.tankType, r._sum.yieldL ?? 0]));
    const sellableL = this.round(byType.get(MilkTankType.SELLABLE) ?? 0);
    const withholdingL = this.round(byType.get(MilkTankType.WITHHOLDING) ?? 0);
    return {
      period,
      totalYieldL: this.round(sellableL + withholdingL),
      sellableL,
      withholdingL,
      calfAllocationL: 0,
      comparison: null,
      sessions: null,
    };
  }

  // ---- 7-Day Calving Forecast widget (§7.3) -------------------------------

  async calvingForecast(farmId: string) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * DAY_MS);
    const pregnancies = await this.prisma.pregnancy.findMany({
      where: {
        status: PregnancyStatus.ACTIVE,
        expectedCalvingDate: { gte: now, lte: horizon },
        cattle: { farmId, isActive: true },
      },
      orderBy: { expectedCalvingDate: 'asc' },
      include: {
        cattle: {
          select: {
            id: true,
            name: true,
            tagNumber: true,
            shed: { select: { name: true } },
          },
        },
      },
    });
    return {
      forecast: pregnancies.map((p) => ({
        cattleId: p.cattleId,
        name: p.cattle.name,
        tag: p.cattle.tagNumber,
        shed: p.cattle.shed?.name ?? null,
        expectedCalvingDate: p.expectedCalvingDate,
        daysRemaining: p.expectedCalvingDate
          ? Math.max(
              0,
              Math.ceil(
                (p.expectedCalvingDate.getTime() - now.getTime()) / DAY_MS,
              ),
            )
          : null,
        conceptionDate: p.conceptionDate,
      })),
    };
  }

  // ---- Herd Status donut (§7.3) -------------------------------------------

  async herdStatus(farmId: string) {
    const now = new Date();
    const [
      totalActive,
      repro,
      milkingCount,
      dryCount,
      healthCaseByStatus,
      withholding,
      calves,
      femaleCattle,
      settings,
      categoryCounts,
    ] = await Promise.all([
      this.prisma.cattle.count({
        where: {
          farmId,
          isActive: true,
          purpose: { not: CattlePurpose.CALF },
        },
      }),
      this.prisma.reproductionProfile.groupBy({
        by: ['reproductiveStatus'],
        where: { cattle: { farmId, isActive: true } },
        _count: { _all: true },
      }),
      // "Milking"/"Dry" are deliberately sourced from `Cattle.productionStatus`,
      // not `ReproductiveStatus` — the two are independent dimensions of the
      // multi-state cattle model (RAKHAL-269/271), and `productionStatus` is
      // the field the Cattle list badge + status dialog actually set/show.
      this.prisma.cattle.count({
        where: {
          farmId,
          isActive: true,
          productionStatus: ProductionStatus.MILKING,
        },
      }),
      this.prisma.cattle.count({
        where: {
          farmId,
          isActive: true,
          productionStatus: ProductionStatus.DRY,
        },
      }),
      // Grouped by status (not a flat count) so `sick`/`inTreatment` below can
      // mirror `deriveHealthStatus()`'s own precedence (`domain/health-status.ts`)
      // instead of both reusing the same combined number.
      this.prisma.healthCase.groupBy({
        by: ['status'],
        where: {
          farmId,
          isActive: true,
          status: { in: ACTIVE_CASE_STATUSES },
        },
        _count: { _all: true },
      }),
      this.prisma.safetyWithdrawal.count({
        where: { farmId, status: SafetyWithdrawalStatus.ACTIVE },
      }),
      this.prisma.cattle.findMany({
        where: { farmId, isActive: true, purpose: CattlePurpose.CALF },
        select: { dateOfBirth: true },
      }),
      // Backing data for the real "fresh" count below (RAKHAL-273's
      // LactationStage — this used to proxy off retired ReproductiveStatus
      // values, see the removed comment this replaces).
      this.prisma.cattle.findMany({
        where: { farmId, isActive: true, gender: CattleGender.FEMALE },
        select: {
          dateOfBirth: true,
          reproductionProfile: { select: { totalCalvings: true } },
          lactations: {
            where: { status: LactationStatus.ACTIVE, endDate: null },
            select: { startDate: true },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
          dryPeriods: {
            where: { actualEndDate: null },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.farmSettings.getEffective(farmId),
      // The one TRUE mutually-exclusive partition of the herd (every active
      // cow has exactly one AnimalCategory) — reuses the same pure
      // `buildAnimalCategoryWhere()` the Cattle list filter uses (RAKHAL-289),
      // so this can never drift from that filter's own definition.
      Promise.all(
        ANIMAL_CATEGORIES.map((category) =>
          this.prisma.cattle.count({
            where: {
              farmId,
              isActive: true,
              ...buildAnimalCategoryWhere(category, now),
            },
          }),
        ),
      ),
    ]);

    const reproCount = (s: ReproductionState) =>
      repro.find((r) => r.reproductiveStatus === s)?._count._all ?? 0;

    // Mirrors `deriveHealthStatus()`'s precedence (`domain/health-status.ts`):
    // any open case whose status has moved past ACTIVE reads as in-treatment;
    // a still-ACTIVE case reads as sick.
    const sick =
      healthCaseByStatus.find((r) => r.status === HealthCaseStatus.ACTIVE)
        ?._count._all ?? 0;
    const inTreatment = healthCaseByStatus
      .filter((r) => r.status !== HealthCaseStatus.ACTIVE)
      .reduce((sum, r) => sum + r._count._all, 0);
    const activeCases = sick + inTreatment;
    const healthy = Math.max(totalActive - activeCases, 0);

    const categoryBreakdown = Object.fromEntries(
      ANIMAL_CATEGORIES.map((category, i) => [
        category.toLowerCase(),
        categoryCounts[i],
      ]),
    ) as Record<Lowercase<(typeof ANIMAL_CATEGORIES)[number]>, number>;

    // "Fresh" = real LactationStage.FRESH (early days in milk on the active
    // lactation), derived per-cow via the same pure function the Cattle
    // module uses (`deriveLactationStage`), not a stale ReproductiveStatus
    // proxy.
    let fresh = 0;
    for (const cow of femaleCattle) {
      const lactationStage = deriveLactationStage({
        now,
        lactationStartDate: cow.lactations[0]?.startDate ?? null,
        isInActiveDryPeriod: cow.dryPeriods.length > 0,
        farmSettings: {
          freshDays: settings.lactationFreshDays,
          earlyDays: settings.lactationEarlyDays,
          midDays: settings.lactationMidDays,
        },
      });
      if (lactationStage === 'FRESH') {
        fresh += 1;
      }
    }

    return {
      totalActive,
      productionBreakdown: {
        milking: milkingCount,
        dry: dryCount,
        fresh,
      },
      categoryBreakdown,
      reproductiveBreakdown: {
        open: reproCount(ReproductionState.OPEN),
        // v2 correction: RAKHAL-271's split renamed INSEMINATED to
        // BRED_AWAITING_CONFIRMATION (a waiting state, not an event type).
        inseminated: reproCount(ReproductionState.BRED_AWAITING_CONFIRMATION),
        pregnant: reproCount(ReproductionState.PREGNANT),
        dryPeriod: dryCount,
      },
      healthBreakdown: {
        healthy,
        sick,
        inTreatment,
        withholding,
      },
      calves: this.calfStageCounts(
        calves.map((c) => c.dateOfBirth),
        now,
      ),
    };
  }

  // ---- Livestock State bar chart (§7.3) -----------------------------------

  async livestockState(farmId: string, period: DashboardPeriod) {
    const herd = await this.herdStatus(farmId);
    return {
      period,
      states: [
        {
          state: 'fresh',
          count: herd.productionBreakdown.fresh,
          color: '#1A7A4A',
        },
        {
          state: 'milking',
          count: herd.productionBreakdown.milking,
          color: '#14B8A6',
        },
        { state: 'dry', count: herd.productionBreakdown.dry, color: '#7C3AED' },
        {
          state: 'pregnant',
          count: herd.reproductiveBreakdown.pregnant,
          color: '#D97706',
        },
        {
          state: 'insemination',
          count: herd.reproductiveBreakdown.inseminated,
          color: '#2563EB',
        },
        { state: 'sick', count: herd.healthBreakdown.sick, color: '#DC2626' },
      ],
    };
  }

  // ---- Financial Snapshot widget (§7.3) -----------------------------------

  async financialSnapshot(farmId: string) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const prevStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const [income, expense, prevIncome, prevExpense, finance] =
      await Promise.all([
        this.txnSum(farmId, true, monthStart, now),
        this.txnSum(farmId, false, monthStart, now),
        this.txnSum(farmId, true, prevStart, monthStart),
        this.txnSum(farmId, false, prevStart, monthStart),
        this.finance.highlights(farmId),
      ]);

    return {
      period: monthStart.toISOString().slice(0, 7),
      income: {
        current: income,
        previous: prevIncome,
        changePct: this.changePct(income, prevIncome),
      },
      expenses: {
        current: expense,
        previous: prevExpense,
        changePct: this.changePct(expense, prevExpense),
      },
      profit: {
        current: this.round(income - expense),
        previous: this.round(prevIncome - prevExpense),
        changePct: this.changePct(income - expense, prevIncome - prevExpense),
      },
      survivalRunway: {
        days: finance.survivalRunwayDays,
        availableLiquidity: finance.availableLiquidity,
        status: finance.survivalRunwayStatus,
      },
    };
  }

  // ---- Financial Performance Over Time chart (Figma "Dashboard" 732:1... ) --
  // 12-month income/expense/profit trend. No PRD-numbered widget backs this in
  // the 9 real `GET /dashboard/*` routes yet — added as its own read so the
  // Figma line-chart slot has real data instead of reusing FinancialSnapshotCard.

  async financialPerformance(farmId: string) {
    const months = this.lastNMonths(12);
    const rangeStart = months[0].start;
    const txns = await this.prisma.financeTransaction.findMany({
      where: {
        farmId,
        status: 'COMPLETED',
        date: { gte: rangeStart },
        ...NON_VOID_TXN,
      },
      select: { date: true, type: true, amount: true },
    });
    const buckets = new Map<string, { income: number; expense: number }>(
      months.map((m) => [m.key, { income: 0, expense: 0 }]),
    );
    for (const t of txns) {
      const key = this.monthKey(t.date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (t.type === 'REVENUE') bucket.income += t.amount;
      else bucket.expense += t.amount;
    }
    return {
      months: months.map((m) => {
        const b = buckets.get(m.key)!;
        const income = this.round(b.income);
        const expense = this.round(b.expense);
        return {
          month: m.key,
          label: m.label,
          income,
          expense,
          profit: this.round(income - expense),
        };
      }),
    };
  }

  // ---- Production vs Feedcost chart (Figma "Dashboard" 732:1...) -----------
  // Current-month daily milk yield vs feed distribution cost.

  async productionVsFeedcost(farmId: string) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();

    const [milk, feed] = await Promise.all([
      this.prisma.milkLogEntry.findMany({
        where: { farmId, submitted: true, logDate: { gte: monthStart } },
        select: { logDate: true, yieldL: true },
      }),
      this.prisma.feedDistribution.findMany({
        where: { farmId, distributedAt: { gte: monthStart } },
        select: { distributedAt: true, totalActualCost: true },
      }),
    ]);

    const production = new Array<number>(daysInMonth).fill(0);
    const feedcost = new Array<number>(daysInMonth).fill(0);
    for (const m of milk) {
      const day = m.logDate.getUTCDate();
      if (day >= 1 && day <= daysInMonth) production[day - 1] += m.yieldL;
    }
    for (const f of feed) {
      const day = f.distributedAt.getUTCDate();
      if (day >= 1 && day <= daysInMonth)
        feedcost[day - 1] += f.totalActualCost;
    }

    return {
      days: Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        productionL: this.round(production[i]),
        feedcost: this.round(feedcost[i]),
      })),
    };
  }

  // ---- Conception Rate chart (Figma "Dashboard" 732:1...) -------------------
  // 12-month monthly breeding count vs confirmed-pregnant rate.

  async conceptionRate(farmId: string) {
    const months = this.lastNMonths(12);
    const rangeStart = months[0].start;
    const events = await this.prisma.breedingEvent.findMany({
      where: {
        breedingDate: { gte: rangeStart },
        cattle: { farmId, isActive: true },
      },
      select: { breedingDate: true, status: true },
    });
    const buckets = new Map<string, { total: number; confirmed: number }>(
      months.map((m) => [m.key, { total: 0, confirmed: 0 }]),
    );
    for (const e of events) {
      const bucket = buckets.get(this.monthKey(e.breedingDate));
      if (!bucket) continue;
      bucket.total += 1;
      if (e.status === 'PREGNANT') bucket.confirmed += 1;
    }
    return {
      months: months.map((m) => {
        const b = buckets.get(m.key)!;
        return {
          month: m.key,
          label: m.label,
          inseminations: b.total,
          confirmedPregnancies: b.confirmed,
          ratePct: b.total
            ? Math.round((b.confirmed / b.total) * 1000) / 10
            : 0,
        };
      }),
    };
  }

  // ---- Feed Stock Alerts widget (§7.3) ------------------------------------

  async feedStockAlerts(farmId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);

    const [medicines, feedItems, medicineUsage] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { farmId, isActive: true, lowStockThreshold: { gt: 0 } },
        select: {
          id: true,
          name: true,
          unit: true,
          currentStock: true,
          lowStockThreshold: true,
        },
      }),
      this.prisma.feedItem.findMany({
        where: { farmId, isActive: true, lowStockThreshold: { gt: 0 } },
        select: {
          id: true,
          name: true,
          unit: true,
          currentStock: true,
          lowStockThreshold: true,
        },
      }),
      // Sum completed health-task dose amounts per medicine in last 30 days (RD-011).
      this.prisma.healthTask.groupBy({
        by: ['medicineId'],
        where: {
          farmId,
          medicineId: { not: null },
          status: HealthTaskStatus.COMPLETED,
          completedAt: { gte: thirtyDaysAgo },
        },
        _sum: { doseAmount: true },
      }),
    ]);

    const consumptionById = new Map(
      medicineUsage
        .filter((u) => u.medicineId != null)
        .map((u) => [u.medicineId!, Number(u._sum.doseAmount ?? 0)]),
    );

    const calcDaysRemaining = (id: string, stock: number): number | null => {
      const total30d = consumptionById.get(id);
      if (!total30d || total30d === 0) return null;
      const dailyRate = total30d / 30;
      return Math.floor(stock / dailyRate);
    };

    const toAlert =
      (type: 'medicine' | 'feed_item') =>
      (i: {
        id: string;
        name: string;
        unit: string;
        currentStock: number;
        lowStockThreshold: number;
      }) => ({
        itemId: i.id,
        itemType: type,
        name: i.name,
        currentStock: i.currentStock,
        unit: i.unit,
        threshold: i.lowStockThreshold,
        daysRemainingEstimate:
          type === 'medicine' ? calcDaysRemaining(i.id, i.currentStock) : null,
        status: i.currentStock <= i.lowStockThreshold / 2 ? 'critical' : 'low',
      });

    const alerts = [
      ...medicines
        .filter((m) => m.currentStock <= m.lowStockThreshold)
        .map(toAlert('medicine')),
      ...feedItems
        .filter((f) => f.currentStock <= f.lowStockThreshold)
        .map(toAlert('feed_item')),
    ];
    return { alerts };
  }

  // ---- Upcoming Tasks widget (§7.3) ---------------------------------------

  async upcomingTasks(farmId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const todays = await this.prisma.task.findMany({
      where: { farmId, dueAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { dueAt: 'asc' },
      include: { assignedTo: { select: { name: true } } },
    });
    const overdue = todays.filter(
      (t) =>
        t.status !== TaskStatus.COMPLETED && t.dueAt.getTime() < now.getTime(),
    );
    const byCategory: Record<string, { count: number; overdue: number }> = {};
    for (const t of todays) {
      const key = t.category.toLowerCase();
      const row = byCategory[key] ?? { count: 0, overdue: 0 };
      row.count += 1;
      if (
        t.status !== TaskStatus.COMPLETED &&
        t.dueAt.getTime() < now.getTime()
      ) {
        row.overdue += 1;
      }
      byCategory[key] = row;
    }
    return {
      totalToday: todays.length,
      completedToday: todays.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      overdue: overdue.length,
      byCategory,
      tasks: todays.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        priority: t.priority,
        dueAt: t.dueAt,
        status: t.status,
        assignedTo: t.assignedTo?.name ?? null,
      })),
    };
  }

  // ---- Today's Priorities panel (§7.1) ------------------------------------

  async priorities(farmId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const calvingHorizon = new Date(now.getTime() + 3 * DAY_MS);

    const [
      overdueDoses,
      soonCalving,
      lowMed,
      overdueRec,
      dueTasks,
      completedTasks,
    ] = await Promise.all([
      this.prisma.healthTask.count({
        where: {
          farmId,
          isActive: true,
          status: { in: [HealthTaskStatus.PENDING, HealthTaskStatus.OVERDUE] },
          dueDateTime: { lt: now },
        },
      }),
      this.prisma.pregnancy.findFirst({
        where: {
          status: PregnancyStatus.ACTIVE,
          expectedCalvingDate: { gte: now, lte: calvingHorizon },
          cattle: { farmId, isActive: true },
        },
        orderBy: { expectedCalvingDate: 'asc' },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
      }),
      this.prisma.medicine.findFirst({
        where: {
          farmId,
          isActive: true,
          lowStockThreshold: { gt: 0 },
          currentStock: { lte: this.prisma.medicine.fields.lowStockThreshold },
        },
        orderBy: { currentStock: 'asc' },
      }),
      this.prisma.financeReceivable.findFirst({
        where: {
          farmId,
          kind: ReceivableKind.RECEIVABLE,
          status: { not: ReceivableStatus.COMPLETED },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.task.count({
        where: { farmId, dueAt: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.task.count({
        where: {
          farmId,
          status: TaskStatus.COMPLETED,
          dueAt: { gte: dayStart, lt: dayEnd },
        },
      }),
    ]);

    const priorities: Array<Record<string, unknown>> = [];
    if (overdueDoses > 0) {
      priorities.push({
        priority: 'critical',
        icon: '🔴',
        message: `${overdueDoses} cow(s) overdue for treatment dose`,
        actionLabel: 'Log now',
        link: '/healthcare/sick-bay',
        count: overdueDoses,
      });
    }
    if (soonCalving?.expectedCalvingDate) {
      const days = Math.max(
        0,
        Math.ceil(
          (soonCalving.expectedCalvingDate.getTime() - now.getTime()) / DAY_MS,
        ),
      );
      priorities.push({
        priority: 'urgent',
        icon: '🟠',
        message: `${soonCalving.cattle.name ?? soonCalving.cattle.tagNumber} expected to calve in ${days} day(s)`,
        actionLabel: 'Prepare calving kit',
        link: `/reproduction/calving/${soonCalving.cattleId}`,
        cattleId: soonCalving.cattleId,
        expectedDate: soonCalving.expectedCalvingDate,
      });
    }
    if (lowMed) {
      priorities.push({
        priority: 'important',
        icon: '🟡',
        message: `${lowMed.name} stock: ${lowMed.currentStock} ${lowMed.unit} remaining (low)`,
        actionLabel: 'Reorder',
        link: `/inventory/medicines/${lowMed.id}`,
        count: lowMed.currentStock,
      });
    }
    if (overdueRec) {
      const daysOver = overdueRec.dueDate
        ? Math.floor((now.getTime() - overdueRec.dueDate.getTime()) / DAY_MS)
        : 0;
      priorities.push({
        priority: 'important',
        icon: '🟡',
        message: `${overdueRec.entityName ?? 'Buyer'} payment: Tk ${this.round(overdueRec.total - overdueRec.paid)} overdue by ${daysOver} day(s)`,
        actionLabel: 'Follow up',
        link: `/finance/receivables/${overdueRec.id}`,
      });
    }
    const pendingMilk = await this.pendingMilkCount(farmId, dayStart, dayEnd);
    if (pendingMilk > 0) {
      priorities.push({
        priority: 'operational',
        icon: '🟢',
        message: `Milk log pending — ${pendingMilk} cow(s) not yet logged`,
        actionLabel: 'Log milk',
        link: '/milk?session=morning',
      });
    }
    if (dueTasks > 0) {
      priorities.push({
        priority: 'routine',
        icon: '⚪',
        message: `${dueTasks} task(s) due today — ${completedTasks} completed`,
        actionLabel: 'View tasks',
        link: '/tasks',
      });
    }
    return { priorities: priorities.slice(0, 7) };
  }

  // ---- Helpers -------------------------------------------------------------

  private async pendingMilkCount(
    farmId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<number> {
    const milkingCows = await this.prisma.cattle.count({
      where: {
        farmId,
        isActive: true,
        purpose: { in: [CattlePurpose.MILK, CattlePurpose.DUAL_PURPOSE] },
      },
    });
    const logged = await this.prisma.milkLogEntry.findMany({
      where: { farmId, logDate: { gte: dayStart, lt: dayEnd } },
      select: { cattleId: true },
      distinct: ['cattleId'],
    });
    return Math.max(0, milkingCows - logged.length);
  }

  private async txnSum(
    farmId: string,
    revenue: boolean,
    from: Date,
    to: Date,
  ): Promise<number> {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        farmId,
        status: 'COMPLETED',
        type: revenue ? 'REVENUE' : { not: 'REVENUE' },
        date: { gte: from, lt: to },
        ...NON_VOID_TXN,
      },
      _sum: { amount: true },
    });
    return this.round(agg._sum.amount ?? 0);
  }

  private calfStageCounts(dobs: Array<Date | null>, now: Date) {
    const counts = {
      total: dobs.length,
      newborn_0_7: 0,
      young_7_60: 0,
      pre_weaning_60_90: 0,
      post_weaning_90plus: 0,
    };
    for (const dob of dobs) {
      if (!dob) continue;
      const age = Math.floor((now.getTime() - dob.getTime()) / DAY_MS);
      if (age < 7) counts.newborn_0_7 += 1;
      else if (age < 60) counts.young_7_60 += 1;
      else if (age < 90) counts.pre_weaning_60_90 += 1;
      else counts.post_weaning_90plus += 1;
    }
    return counts;
  }

  private periodRange(period: DashboardPeriod): { gte: Date } {
    const now = new Date();
    if (period === 'week') return { gte: new Date(now.getTime() - 7 * DAY_MS) };
    return { gte: new Date(now.getTime() - 30 * DAY_MS) };
  }

  private changePct(current: number, previous: number): number | null {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private monthKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Oldest-first list of the last N calendar months (UTC), each with its
   * `YYYY-MM` bucket key, a short display label, and the month's start date. */
  private lastNMonths(
    n: number,
  ): Array<{ key: string; label: string; start: Date }> {
    const now = new Date();
    const labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const months: Array<{ key: string; label: string; start: Date }> = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      months.push({
        key: this.monthKey(start),
        label: labels[start.getUTCMonth()],
        start,
      });
    }
    return months;
  }
}
