import { BadRequestException, Injectable } from '@nestjs/common';
import {
  HerdStatus,
  HealthActionType,
  HealthCaseStatus,
  HealthTaskStatus,
  JournalTransactionStatus,
  LactationStatus,
  LedgerAccountCategory,
  MilkTankType,
  PregnancyStatus,
  ReproductionState,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { activeHerd as activeHerdScope } from 'src/modules/cattle/domain/herd-scope';
import { ledgerCategoryNet } from 'src/common/finance/txn-filters';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import {
  averageDailyYield,
  daysBetween as lactationDaysBetween,
  totalsByDisposition,
  YieldEntry,
} from 'src/modules/reproduction/domain/lactation-yield';
import {
  computeLactationPersistency,
  LactationPersistency,
} from 'src/modules/reproduction/domain/lactation-persistency';
import {
  deriveLactationStage,
  LactationStage,
} from 'src/modules/reproduction/domain/lactation-stage';
import { Cell, ReportData, ReportSection } from '../../domain/report-data';

export interface ReportParams {
  date?: string;
  month?: string; // YYYY-MM
  year?: string; // YYYY
  shedId?: string;
  cattleId?: string;
  lactationId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  search?: string;
  category?: string;
}

// RAKHAL-269: lifecycle exits (sold/deceased) live on HerdStatus now, not
// ProductionStatus (trimmed to MILKING|DRY) — was ACTIVE_PRODUCTION_EXCLUDE.
// RAKHAL-397: gained CULLED (was silently excluded from removals before).
const REMOVED_CATTLE_STATUSES: HerdStatus[] = [
  HerdStatus.SOLD,
  HerdStatus.CULLED,
  HerdStatus.DECEASED,
];

/**
 * The 12 MVP report generators (PRD §22.2) + the Feed Cost report (RD-013). Each
 * returns a renderer-agnostic {@link ReportData}. Read-only, farm-scoped via
 * direct Prisma queries (the Dashboard-aggregator pattern — no cross-module
 * service coupling, so no cycles).
 */
@Injectable()
export class ReportGeneratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmSettings: FarmSettingsService,
  ) {}

  async generate(
    farmId: string,
    reportId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    switch (reportId) {
      case 'rpt_daily_milk':
        return this.dailyMilk(farmId, params);
      case 'rpt_monthly_production':
        return this.monthlyProduction(farmId, params);
      case 'rpt_cow_history':
        return this.cowHistory(farmId, params);
      case 'rpt_repro_summary':
        return this.reproSummary(farmId, params);
      case 'rpt_open_cows':
        return this.openCows(farmId);
      case 'rpt_calving_forecast':
        return this.calvingForecast(farmId);
      case 'rpt_weekly_health':
        return this.weeklyHealth(farmId, params);
      case 'rpt_vaccination_compliance':
        return this.vaccinationCompliance(farmId);
      case 'rpt_withholding_compliance':
        return this.withholdingCompliance(farmId);
      case 'rpt_monthly_pl':
        return this.monthlyPl(farmId, params);
      case 'rpt_buyer_reconciliation':
        return this.buyerReconciliation(farmId, params);
      case 'rpt_annual_herd_inventory':
        return this.annualHerdInventory(farmId, params);
      case 'rpt_feed_cost':
        return this.feedCost(farmId, params);
      case 'rpt_monthly_farm_report':
        return this.monthlyFarmReport(farmId, params);
      case 'rpt_cattle_export':
        return this.cattleExport(farmId, params);
      case 'rpt_milk_export':
        return this.milkExport(farmId, params);
      case 'rpt_finance_export':
        return this.financeExport(farmId, params);
      case 'rpt_healthcare_export':
        return this.healthcareExport(farmId, params);
      case 'rpt_dashboard_export':
        return this.dashboardExport(farmId);
      case 'rpt_lactation_individual':
        return this.lactationIndividual(farmId, params);
      case 'rpt_lactation_herd_dashboard':
        return this.lactationHerdDashboard(farmId);
      default:
        throw new BadRequestException(`Unknown report: ${reportId}`);
    }
  }

  // ---- Production ---------------------------------------------------------

  private async dailyMilk(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const day = this.dayStart(params.date);
    const next = this.addDays(day, 1);
    const weekAgo = this.addDays(day, -7);

    const shedWhere = params.shedId ? { shedId: params.shedId } : {};
    const cattle = await this.prisma.cattle.findMany({
      where: { ...activeHerdScope(farmId), ...shedWhere },
      select: {
        id: true,
        name: true,
        tagNumber: true,
        shed: { select: { name: true } },
      },
      orderBy: { tagNumber: 'asc' },
    });
    const ids = cattle.map((c) => c.id);

    const [todayRows, weekRows] = await Promise.all([
      this.prisma.milkLogEntry.findMany({
        where: {
          farmId,
          cattleId: { in: ids },
          logDate: { gte: day, lt: next },
        },
        select: { cattleId: true, yieldL: true, anomalyFlag: true },
      }),
      this.prisma.milkLogEntry.findMany({
        where: {
          farmId,
          cattleId: { in: ids },
          logDate: { gte: weekAgo, lt: day },
        },
        select: { cattleId: true, yieldL: true },
      }),
    ]);

    const todayByCow = new Map<string, { total: number; anomaly: boolean }>();
    for (const r of todayRows) {
      const e = todayByCow.get(r.cattleId) ?? { total: 0, anomaly: false };
      e.total += r.yieldL;
      e.anomaly = e.anomaly || r.anomalyFlag;
      todayByCow.set(r.cattleId, e);
    }
    const weekByCow = new Map<string, number>();
    for (const r of weekRows) {
      weekByCow.set(r.cattleId, (weekByCow.get(r.cattleId) ?? 0) + r.yieldL);
    }

    const rows = cattle
      .map((c) => {
        const today = todayByCow.get(c.id);
        const avg7d = this.round((weekByCow.get(c.id) ?? 0) / 7);
        return [
          c.tagNumber,
          c.name ?? '',
          c.shed?.name ?? '',
          this.round(today?.total ?? 0),
          avg7d,
          today?.anomaly ? 'YES' : '',
        ];
      })
      .filter((r) => Number(r[3]) > 0 || Number(r[4]) > 0);

    const total = this.round(rows.reduce((acc, r) => acc + Number(r[3]), 0));

    return {
      title: 'Daily Milk Production',
      period: this.dateLabel(day),
      summary: [
        { label: 'Total litres', value: total },
        {
          label: 'Cows milked',
          value: rows.filter((r) => Number(r[3]) > 0).length,
        },
      ],
      columns: ['TAG', 'Name', 'Shed', 'Today (L)', '7-day avg (L)', 'Anomaly'],
      rows,
    };
  }

  private async monthlyProduction(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const rows = await this.prisma.milkLogEntry.findMany({
      where: { farmId, logDate: { gte: start, lt: end } },
      select: { cattleId: true, yieldL: true, tankType: true },
    });

    let total = 0;
    let sellable = 0;
    let withholding = 0;
    const cows = new Set<string>();
    for (const r of rows) {
      total += r.yieldL;
      cows.add(r.cattleId);
      if (r.tankType === MilkTankType.WITHHOLDING) withholding += r.yieldL;
      else sellable += r.yieldL;
    }
    const expense = await this.expenseTotal(farmId, start, end);
    const costPerLitre = total > 0 ? this.round(expense / total) : 0;

    return {
      title: 'Monthly Production Summary',
      period: label,
      summary: [
        { label: 'Total litres', value: this.round(total) },
        { label: 'Cows contributing', value: cows.size },
        {
          label: 'Per-cow average (L)',
          value: cows.size ? this.round(total / cows.size) : 0,
        },
        { label: 'Cost per litre (৳)', value: costPerLitre },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Total litres', this.round(total)],
        ['Sellable litres', this.round(sellable)],
        ['Withholding litres', this.round(withholding)],
        ['Total expense (৳)', this.round(expense)],
        ['Cost per litre (৳)', costPerLitre],
      ],
    };
  }

  private async cowHistory(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    if (!params.cattleId) {
      throw new BadRequestException('cattleId is required for this report');
    }
    // No `deletedAt` filter on the cattle lookup (RAKHAL-310): a per-animal
    // history report must still generate for an archived/sold cow.
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: params.cattleId, farmId },
      select: { id: true, name: true, tagNumber: true },
    });
    if (!cattle) throw new BadRequestException('Cattle not found');

    const [milk, calvings, cases] = await Promise.all([
      this.prisma.milkLogEntry.findMany({
        where: { cattleId: cattle.id },
        select: { logDate: true, yieldL: true },
      }),
      this.prisma.calvingEvent.count({ where: { cattleId: cattle.id } }),
      this.prisma.healthCase.findMany({
        where: { cattleId: cattle.id, deletedAt: null },
        select: { diagnosis: true, startDate: true, status: true },
        orderBy: { startDate: 'desc' },
        take: 20,
      }),
    ]);

    const byYear = new Map<number, number>();
    for (const r of milk) {
      const y = r.logDate.getUTCFullYear();
      byYear.set(y, (byYear.get(y) ?? 0) + r.yieldL);
    }
    const yieldRows = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, total]) => [`Lifetime yield ${year}`, this.round(total)]);
    const healthRows = cases.map((c) => [
      `Health: ${c.diagnosis} (${c.status})`,
      this.dateLabel(c.startDate),
    ]);

    return {
      title: `Cow Production History — ${cattle.tagNumber}`,
      period: cattle.name ?? cattle.tagNumber,
      summary: [
        { label: 'Total calvings', value: calvings },
        {
          label: 'Lifetime litres',
          value: this.round([...byYear.values()].reduce((a, b) => a + b, 0)),
        },
      ],
      columns: ['Event', 'Value'],
      rows: [...yieldRows, ...healthRows],
    };
  }

  // ---- Reproduction -------------------------------------------------------

  private async reproSummary(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    // `farmCattleIds` deliberately includes archived/sold cattle (RAKHAL-310)
    // — a monthly reproduction report must still count an event that happened
    // to a cow before she later exited the herd.
    const cattleIds = await this.farmCattleIds(farmId);

    const [calvings, ais, pregnancies, openCows] = await Promise.all([
      this.prisma.calvingEvent.count({
        where: {
          cattleId: { in: cattleIds },
          calvingDate: { gte: start, lt: end },
        },
      }),
      this.prisma.breedingEvent.count({
        where: {
          cattleId: { in: cattleIds },
          breedingDate: { gte: start, lt: end },
        },
      }),
      this.prisma.pregnancy.count({
        where: {
          cattleId: { in: cattleIds },
          conceptionDate: { gte: start, lt: end },
          // RAKHAL-325: a correction (data-entry mistake) must not count
          // toward the reported conception rate.
          status: { not: PregnancyStatus.CANCELLED_CORRECTION },
        },
      }),
      this.prisma.reproductionProfile.count({
        where: {
          cattleId: { in: cattleIds },
          reproductiveStatus: ReproductionState.OPEN,
        },
      }),
    ]);
    const conceptionRate = ais > 0 ? this.round((pregnancies / ais) * 100) : 0;

    return {
      title: 'Monthly Reproduction Summary',
      period: label,
      summary: [
        { label: 'Calvings', value: calvings },
        { label: 'AIs / services', value: ais },
        { label: 'Conception rate (%)', value: conceptionRate },
        { label: 'Open cows', value: openCows },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Calvings', calvings],
        ['AIs / services', ais],
        ['Pregnancies confirmed', pregnancies],
        ['Conception rate (%)', conceptionRate],
        ['Open cows', openCows],
      ],
    };
  }

  private async openCows(farmId: string): Promise<ReportData> {
    const profiles = await this.prisma.reproductionProfile.findMany({
      where: {
        reproductiveStatus: ReproductionState.OPEN,
        cattle: activeHerdScope(farmId),
      },
      select: {
        lastCalvingDate: true,
        lastBreedingDate: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
    });
    const now = new Date();
    const rows = profiles.map((p) => {
      const daysOpen = p.lastCalvingDate
        ? this.daysBetween(p.lastCalvingDate, now)
        : null;
      return [
        p.cattle.tagNumber,
        p.cattle.name ?? '',
        daysOpen ?? '',
        p.lastBreedingDate ? this.dateLabel(p.lastBreedingDate) : 'never',
        daysOpen && daysOpen > 85 ? 'Breed urgently' : 'Monitor / breed',
      ];
    });

    return {
      title: 'Open Cow Report',
      summary: [{ label: 'Open cows', value: rows.length }],
      columns: ['TAG', 'Name', 'Days open', 'Last AI', 'Recommended action'],
      rows,
    };
  }

  private async calvingForecast(farmId: string): Promise<ReportData> {
    const now = new Date();
    const horizon = this.addDays(now, 30);
    const pregnancies = await this.prisma.pregnancy.findMany({
      where: {
        status: 'ACTIVE',
        expectedCalvingDate: { gte: now, lte: horizon },
        cattle: { farmId },
      },
      select: {
        expectedCalvingDate: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
      orderBy: { expectedCalvingDate: 'asc' },
    });
    const rows = pregnancies.map((p) => [
      p.cattle.tagNumber,
      p.cattle.name ?? '',
      p.expectedCalvingDate ? this.dateLabel(p.expectedCalvingDate) : '',
      p.expectedCalvingDate ? this.daysBetween(now, p.expectedCalvingDate) : '',
    ]);

    return {
      title: 'Calving Forecast (30-day)',
      period: `${this.dateLabel(now)} → ${this.dateLabel(horizon)}`,
      summary: [{ label: 'Expected calvings', value: rows.length }],
      columns: ['TAG', 'Dam', 'Expected date', 'Days until'],
      rows,
    };
  }

  // ---- Health -------------------------------------------------------------

  private async weeklyHealth(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const end = params.toDate ? this.dayStart(params.toDate) : this.dayStart();
    const endNext = this.addDays(end, 1);
    const start = params.fromDate
      ? this.dayStart(params.fromDate)
      : this.addDays(end, -6);

    const [newCases, treatments, recoveries, withholding, medicineCost] =
      await Promise.all([
        this.prisma.healthCase.count({
          where: {
            farmId,
            deletedAt: null,
            startDate: { gte: start, lt: endNext },
          },
        }),
        this.prisma.treatmentLog.count({
          where: { farmId, administeredAt: { gte: start, lt: endNext } },
        }),
        this.prisma.healthCase.count({
          where: {
            farmId,
            deletedAt: null,
            status: HealthCaseStatus.RECOVERED,
            closedDate: { gte: start, lt: endNext },
          },
        }),
        this.prisma.safetyWithdrawal.count({
          where: { farmId, status: 'ACTIVE' },
        }),
        this.treatmentMedicineCost(farmId, start, endNext),
      ]);

    return {
      title: 'Weekly Herd Health Report',
      period: `${this.dateLabel(start)} → ${this.dateLabel(end)}`,
      summary: [
        { label: 'New cases', value: newCases },
        { label: 'Treatments', value: treatments },
        { label: 'Recoveries', value: recoveries },
        { label: 'Active withholding', value: withholding },
        { label: 'Medicine cost (৳)', value: medicineCost },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['New cases', newCases],
        ['Treatments administered', treatments],
        ['Recoveries', recoveries],
        ['Active withholding events', withholding],
        ['Medicine cost (৳)', medicineCost],
      ],
    };
  }

  /**
   * Sum of medicine cost for treatments in a window (RD-013e). `TreatmentLog`
   * has no cost field and `medicineId` isn't a declared Prisma relation (a
   * cross-batch dose split, RD-003, may only record the primary batch drawn),
   * so this approximates: current `Medicine.costPerUnit` × the logged
   * `stockDeductionQuantity` — not the historical unit price at the time of
   * treatment, and not the full per-batch split cost.
   */
  private async treatmentMedicineCost(
    farmId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<number> {
    const treatments = await this.prisma.treatmentLog.findMany({
      where: {
        farmId,
        administeredAt: { gte: start, lt: endExclusive },
        stockDeducted: true,
        medicineId: { not: null },
      },
      select: { medicineId: true, stockDeductionQuantity: true },
    });
    if (treatments.length === 0) return 0;

    const medicineIds = [
      ...new Set(treatments.map((t) => t.medicineId as string)),
    ];
    // No `deletedAt` filter (RAKHAL-310): these ids come from historical
    // treatment logs — a medicine archived since must still price its own
    // past usage correctly.
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
      select: { id: true, costPerUnit: true },
    });
    const costById = new Map(medicines.map((m) => [m.id, m.costPerUnit]));

    const total = treatments.reduce(
      (sum, t) =>
        sum +
        Number(t.stockDeductionQuantity ?? 0) *
          (costById.get(t.medicineId as string) ?? 0),
      0,
    );
    return this.round(total);
  }

  private async vaccinationCompliance(farmId: string): Promise<ReportData> {
    const now = new Date();
    const tasks = await this.prisma.healthTask.findMany({
      where: {
        farmId,
        deletedAt: null,
        taskType: HealthActionType.VACCINATION,
      },
      select: {
        title: true,
        dueDateTime: true,
        status: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
      orderBy: { dueDateTime: 'asc' },
    });
    const rows = tasks.map((t) => {
      let state: string;
      if (t.status === HealthTaskStatus.COMPLETED) state = 'Given';
      else if (t.dueDateTime < now) state = 'Overdue';
      else state = 'Upcoming';
      return [
        t.cattle.tagNumber,
        t.cattle.name ?? '',
        t.title,
        this.dateLabel(t.dueDateTime),
        state,
      ];
    });

    return {
      title: 'Vaccination Compliance Report',
      summary: [
        { label: 'Vaccinations tracked', value: rows.length },
        {
          label: 'Overdue',
          value: rows.filter((r) => r[4] === 'Overdue').length,
        },
      ],
      columns: ['TAG', 'Name', 'Vaccine', 'Due / given date', 'Status'],
      rows,
    };
  }

  private async withholdingCompliance(farmId: string): Promise<ReportData> {
    const events = await this.prisma.safetyWithdrawal.findMany({
      where: { farmId },
      select: {
        createdAt: true,
        milkWithdrawalUntil: true,
        meatWithdrawalUntil: true,
        status: true,
        cattle: { select: { tagNumber: true, name: true } },
        healthCase: { select: { diagnosis: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const rows = events.map((e) => [
      e.cattle.tagNumber,
      e.cattle.name ?? '',
      e.healthCase?.diagnosis ?? '',
      this.dateLabel(e.createdAt),
      e.milkWithdrawalUntil ? this.dateLabel(e.milkWithdrawalUntil) : '',
      e.meatWithdrawalUntil ? this.dateLabel(e.meatWithdrawalUntil) : '',
      e.status,
    ]);

    return {
      title: 'Withholding Compliance Report',
      summary: [
        { label: 'Withholding events', value: rows.length },
        {
          label: 'Currently active',
          value: rows.filter((r) => r[6] === 'ACTIVE').length,
        },
      ],
      columns: [
        'TAG',
        'Name',
        'Diagnosis',
        'Start',
        'Milk safe',
        'Meat safe',
        'Status',
      ],
      rows,
    };
  }

  // ---- Financial ----------------------------------------------------------

  private async monthlyPl(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const prevStart = this.monthsAgo(start, 1);

    const [income, expense, prevIncome, prevExpense, litres] =
      await Promise.all([
        this.revenueTotal(farmId, start, end),
        this.expenseTotal(farmId, start, end),
        this.revenueTotal(farmId, prevStart, start),
        this.expenseTotal(farmId, prevStart, start),
        this.litresTotal(farmId, start, end),
      ]);
    const net = income - expense;
    const prevNet = prevIncome - prevExpense;
    const costPerLitre = litres > 0 ? this.round(expense / litres) : 0;

    return {
      title: 'Monthly Profit & Loss',
      period: label,
      summary: [
        { label: 'Income (৳)', value: this.round(income) },
        { label: 'Expenses (৳)', value: this.round(expense) },
        { label: 'Net profit (৳)', value: this.round(net) },
        { label: 'Cost per litre (৳)', value: costPerLitre },
      ],
      columns: ['Metric', 'This month', 'Last month'],
      rows: [
        ['Income (৳)', this.round(income), this.round(prevIncome)],
        ['Expenses (৳)', this.round(expense), this.round(prevExpense)],
        ['Net profit (৳)', this.round(net), this.round(prevNet)],
        ['Litres produced', this.round(litres), ''],
        ['Cost per litre (৳)', costPerLitre, ''],
      ],
    };
  }

  private async buyerReconciliation(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const dispatches = await this.prisma.milkDispatch.findMany({
      where: { farmId, dispatchedAt: { gte: start, lt: end } },
      select: {
        volumeDispatchedL: true,
        volumeReceivedL: true,
        calculatedAmount: true,
        paidAmount: true,
        buyer: { select: { name: true } },
      },
    });
    const byBuyer = new Map<
      string,
      { dispatched: number; received: number; due: number; paid: number }
    >();
    for (const d of dispatches) {
      const key = d.buyer.name;
      const e = byBuyer.get(key) ?? {
        dispatched: 0,
        received: 0,
        due: 0,
        paid: 0,
      };
      e.dispatched += d.volumeDispatchedL;
      e.received += d.volumeReceivedL ?? d.volumeDispatchedL;
      e.due += d.calculatedAmount;
      e.paid += d.paidAmount;
      byBuyer.set(key, e);
    }
    const rows = [...byBuyer.entries()].map(([name, e]) => [
      name,
      this.round(e.dispatched),
      this.round(e.received),
      this.round(e.due),
      this.round(e.paid),
      this.round(e.due - e.paid),
    ]);

    return {
      title: 'Buyer Reconciliation Statement',
      period: label,
      summary: [
        { label: 'Buyers', value: rows.length },
        {
          label: 'Outstanding (৳)',
          value: this.round(rows.reduce((a, r) => a + Number(r[5]), 0)),
        },
      ],
      columns: [
        'Buyer',
        'Dispatched (L)',
        'Received (L)',
        'Due (৳)',
        'Paid (৳)',
        'Outstanding (৳)',
      ],
      rows,
    };
  }

  private async annualHerdInventory(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const year = params.year
      ? parseInt(params.year, 10)
      : new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    // Herd-movement report exception (RAKHAL-310): `opening`/`additions`/
    // `removals` deliberately omit `deletedAt` — the year's opening headcount
    // and any animal added during the year must count regardless of whether
    // it has since been archived/sold; only `closing` (the current tally)
    // filters to active.
    const [opening, additions, removals, closing, herdValue] =
      await Promise.all([
        this.prisma.cattle.count({
          where: { farmId, createdAt: { lt: yearStart } },
        }),
        this.prisma.cattle.count({
          where: { farmId, createdAt: { gte: yearStart, lt: yearEnd } },
        }),
        this.prisma.cattle.count({
          where: {
            farmId,
            herdStatus: { in: REMOVED_CATTLE_STATUSES },
            updatedAt: { gte: yearStart, lt: yearEnd },
          },
        }),
        this.prisma.cattle.count({
          where: activeHerdScope(farmId),
        }),
        this.herdPurchaseValue(),
      ]);

    return {
      title: 'Annual Herd Inventory',
      period: String(year),
      summary: [
        { label: 'Opening count', value: opening },
        { label: 'Closing count', value: closing },
        { label: 'Estimated value (৳)', value: herdValue },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Opening count', opening],
        ['Additions (born/purchased)', additions],
        ['Removals (sold/deceased)', removals],
        ['Closing count', closing],
        ['Estimated value (৳)', herdValue],
      ],
    };
  }

  /**
   * Herd value as of a point in time (RD-013d/RD-010e): sum of ANIMAL
   * acquisition cost up to that date — a purchase-cost approximation, not a
   * true per-head market revaluation (still OPEN, RD-010e — no per-head
   * market-price model exists yet).
   *
   * **RAKHAL-354 regression, documented not silent**: this used to read V1
   * `FinanceTransaction` (`type: INVENTORY_PURCHASE, category: INVENTORY,
   * subType: 'animal'`), the same read `FinanceService.assets()` used for its
   * `cattle_herd` allocation — RAKHAL-351 already flagged there is no V2
   * "animal acquisition cost" concept to re-point this at (`PurchaseLine`
   * only carries `medicineId`/`feedItemId`/`equipmentId`; an animal enters
   * the herd via the Cattle module, not Purchasing; `AnimalSaleLine` only
   * covers the *sale* side). Now that RAKHAL-354 drops V1's table outright,
   * this genuinely has zero data source and returns 0 rather than reading a
   * dropped table — filed as new tech debt (`docs/TECH_DEBT.md`) rather than
   * silently faked. A future ticket that designs animal acquisition cost
   * tracking in Finance V2 (e.g. a `Purchase`/`Expense` with a `cattleId`,
   * mirroring this same ticket's `Expense.cattleId` addition for breeding
   * cost) should replace this method's body.
   */
  private async herdPurchaseValue(): Promise<number> {
    return Promise.resolve(0);
  }

  /**
   * Feed Cost Report (PRD §1.5 North-Star: ৳/L). Feed spend source
   * (RAKHAL-351/354): a real FK join — `PurchaseLine.feedItemId`
   * (`prisma/schemas/purchasing/purchase.prisma`) — no string matching.
   * RAKHAL-351 originally added this V2 join *alongside* V1's old
   * `inventoryItemName` string-match read (`FinanceTransaction`, kept alive
   * so pre-cutover spend still counted); RAKHAL-354 drops that V1 table
   * outright, so this is now the sole source — a farm's pre-cutover feed
   * spend (recorded before Finance V2 existed) no longer counts here, same
   * "drop and rebuild" tradeoff `FINANCE_V2_DESIGN.md` §2 made for all V1
   * data (dev/seed only).
   *
   * Reported against litres produced → feed cost per litre, feed's share of
   * total expense, and cost per cow per day, with a per-item breakdown. No
   * feed-distribution tracking yet (V1.5), so this is purchase-based, not
   * consumption-based.
   */
  private async feedCost(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const now = new Date();
    const effectiveEnd = end > now ? now : end;
    const days = Math.max(1, this.daysBetween(start, effectiveEnd) || 1);

    const [v2Lines, litres, totalExpense, activeCows] = await Promise.all([
      // V2: real FK join, no name matching involved.
      this.prisma.purchaseLine.findMany({
        where: {
          feedItemId: { not: null },
          purchase: { farmId, purchaseDate: { gte: start, lt: end } },
        },
        select: {
          totalAmount: true,
          feedItem: { select: { name: true } },
        },
      }),
      this.litresTotal(farmId, start, end),
      this.expenseTotal(farmId, start, end),
      this.prisma.cattle.count({
        where: activeHerdScope(farmId),
      }),
    ]);

    const byItem = new Map<string, number>();
    for (const line of v2Lines) {
      const name = line.feedItem?.name;
      if (!name) continue;
      byItem.set(name, (byItem.get(name) ?? 0) + Number(line.totalAmount));
    }

    const feedCost = [...byItem.values()].reduce((a, b) => a + b, 0);
    const costPerLitre = litres > 0 ? this.round(feedCost / litres) : 0;
    const shareOfExpense =
      totalExpense > 0 ? this.round((feedCost / totalExpense) * 100) : 0;
    const perCowPerDay =
      activeCows > 0 ? this.round(feedCost / activeCows / days) : 0;

    const rows = [...byItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => [
        name,
        this.round(amount),
        feedCost > 0 ? this.round((amount / feedCost) * 100) : 0,
      ]);

    return {
      title: 'Feed Cost Report',
      period: label,
      summary: [
        { label: 'Feed spend (৳)', value: this.round(feedCost) },
        { label: 'Litres produced', value: this.round(litres) },
        { label: 'Feed cost per litre (৳)', value: costPerLitre },
        { label: 'Feed share of expense (%)', value: shareOfExpense },
        { label: 'Feed cost per cow/day (৳)', value: perCowPerDay },
      ],
      columns: ['Feed item', 'Spend (৳)', 'Share of feed (%)'],
      rows,
    };
  }

  // ---- Combined -------------------------------------------------------------

  /**
   * Monthly Farm Report: Cattle/Milk/Health/Finance combined into one
   * multi-section document. Sections are re-derived via direct Prisma queries
   * (not FinanceService.highlights()/MilkService.overview()/etc.) because
   * those live-dashboard methods are "now"-relative with no month param —
   * reusing them for a possibly-past month would silently mislabel today's
   * data as the requested month. Matches this service's own established
   * dashboard-aggregator convention (no cross-module coupling).
   */
  private async monthlyFarmReport(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const [cattle, milk, health, finance] = await Promise.all([
      this.cattleSection(farmId, start, end),
      this.milkSection(farmId, start, end),
      this.healthSection(farmId, start, end),
      this.financeSection(farmId, start, end),
    ]);

    return {
      title: 'Monthly Farm Report',
      period: label,
      columns: [],
      rows: [],
      sections: [cattle, milk, health, finance],
    };
  }

  private async cattleSection(
    farmId: string,
    start: Date,
    end: Date,
  ): Promise<ReportSection> {
    // Herd-movement exception (RAKHAL-310), same as `annualHerdInventory`:
    // `additions`/`removals` deliberately omit `deletedAt` — an animal added
    // in-period still counts even if since archived/sold.
    const [activeHerd, additions, removals, openCows] = await Promise.all([
      this.prisma.cattle.count({
        where: activeHerdScope(farmId),
      }),
      this.prisma.cattle.count({
        where: { farmId, createdAt: { gte: start, lt: end } },
      }),
      this.prisma.cattle.count({
        where: {
          farmId,
          herdStatus: { in: REMOVED_CATTLE_STATUSES },
          updatedAt: { gte: start, lt: end },
        },
      }),
      this.prisma.reproductionProfile.count({
        where: {
          cattle: activeHerdScope(farmId),
          reproductiveStatus: ReproductionState.OPEN,
        },
      }),
    ]);

    return {
      heading: 'Cattle',
      summary: [
        { label: 'Active herd', value: activeHerd },
        { label: 'Added this month', value: additions },
        { label: 'Removed this month', value: removals },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Active herd', activeHerd],
        ['Added this month (born/purchased)', additions],
        ['Removed this month (sold/deceased)', removals],
        ['Open cows (as of report date)', openCows],
      ],
    };
  }

  private async milkSection(
    farmId: string,
    start: Date,
    end: Date,
  ): Promise<ReportSection> {
    const monthRows = await this.prisma.milkLogEntry.findMany({
      where: { farmId, logDate: { gte: start, lt: end } },
      select: { cattleId: true, yieldL: true, tankType: true },
    });

    let total = 0;
    let sellable = 0;
    let withholding = 0;
    const cows = new Set<string>();
    for (const r of monthRows) {
      total += r.yieldL;
      cows.add(r.cattleId);
      if (r.tankType === MilkTankType.WITHHOLDING) withholding += r.yieldL;
      else sellable += r.yieldL;
    }
    const trend = await this.monthlyTrend(start, (mStart, mEnd) =>
      this.litresTotal(farmId, mStart, mEnd),
    );

    return {
      heading: 'Milk',
      summary: [
        { label: 'Total litres', value: this.round(total) },
        { label: 'Cows contributing', value: cows.size },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Total litres', this.round(total)],
        ['Sellable litres', this.round(sellable)],
        ['Withholding litres', this.round(withholding)],
        ...trend.map(([m, v]) => [`Litres — ${m}`, this.round(v)] as Cell[]),
      ],
    };
  }

  private async healthSection(
    farmId: string,
    start: Date,
    end: Date,
  ): Promise<ReportSection> {
    const [newCases, treatments, recoveries, withholding] = await Promise.all([
      this.prisma.healthCase.count({
        where: { farmId, deletedAt: null, startDate: { gte: start, lt: end } },
      }),
      this.prisma.treatmentLog.count({
        where: { farmId, administeredAt: { gte: start, lt: end } },
      }),
      this.prisma.healthCase.count({
        where: {
          farmId,
          deletedAt: null,
          status: HealthCaseStatus.RECOVERED,
          closedDate: { gte: start, lt: end },
        },
      }),
      this.prisma.safetyWithdrawal.count({
        where: { farmId, status: 'ACTIVE' },
      }),
    ]);

    return {
      heading: 'Health',
      summary: [
        { label: 'New cases', value: newCases },
        { label: 'Treatments', value: treatments },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['New cases', newCases],
        ['Treatments administered', treatments],
        ['Recoveries', recoveries],
        ['Active withholding events (as of report date)', withholding],
      ],
    };
  }

  private async financeSection(
    farmId: string,
    start: Date,
    end: Date,
  ): Promise<ReportSection> {
    const [income, expense, litres, trend] = await Promise.all([
      this.revenueTotal(farmId, start, end),
      this.expenseTotal(farmId, start, end),
      this.litresTotal(farmId, start, end),
      this.monthlyTrend(start, async (mStart, mEnd) => {
        const [inc, exp] = await Promise.all([
          this.revenueTotal(farmId, mStart, mEnd),
          this.expenseTotal(farmId, mStart, mEnd),
        ]);
        return inc - exp;
      }),
    ]);
    const net = income - expense;
    const costPerLitre = litres > 0 ? this.round(expense / litres) : 0;

    return {
      heading: 'Finance',
      summary: [
        { label: 'Income (৳)', value: this.round(income) },
        { label: 'Expenses (৳)', value: this.round(expense) },
        { label: 'Net profit (৳)', value: this.round(net) },
      ],
      columns: ['Metric', 'Value'],
      rows: [
        ['Income (৳)', this.round(income)],
        ['Expenses (৳)', this.round(expense)],
        ['Net profit (৳)', this.round(net)],
        ['Cost per litre (৳)', costPerLitre],
        ...trend.map(
          ([m, v]) => [`Net profit — ${m}`, this.round(v)] as Cell[],
        ),
      ],
    };
  }

  /** Last 6 months (oldest→newest, ending at `monthStart`'s month) via `fetch`. */
  private async monthlyTrend(
    monthStart: Date,
    fetch: (start: Date, end: Date) => Promise<number>,
  ): Promise<[string, number][]> {
    const bounds = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const start = this.monthsAgo(monthStart, i);
      const end = this.monthsAgo(monthStart, i - 1);
      const label = `${start.getUTCFullYear()}-${String(
        start.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      return { start, end, label };
    });
    const values = await Promise.all(bounds.map((b) => fetch(b.start, b.end)));
    return bounds.map((b, idx) => [b.label, values[idx]] as [string, number]);
  }

  // ---- Record exports -------------------------------------------------------

  /** Raw cattle list dump — not an aggregation, mirrors the live Cattle list's own filters. */
  private async cattleExport(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const cattle = await this.prisma.cattle.findMany({
      where: {
        ...activeHerdScope(farmId),
        ...(params.shedId ? { shedId: params.shedId } : {}),
        ...(params.status ? { status: params.status as HerdStatus } : {}),
        ...(params.search
          ? {
              OR: [
                {
                  tagNumber: {
                    contains: params.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  name: {
                    contains: params.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        tagNumber: true,
        name: true,
        gender: true,
        herdStatus: true,
        productionStatus: true,
        dateOfBirth: true,
        lastBcs: true,
        lastWeightKg: true,
        breed: { select: { name: true } },
        shed: { select: { name: true } },
      },
      orderBy: { tagNumber: 'asc' },
    });

    const rows = cattle.map((c) => [
      c.tagNumber,
      c.name ?? '',
      c.gender,
      c.breed?.name ?? '',
      c.dateOfBirth ? this.dateLabel(c.dateOfBirth) : '',
      c.herdStatus,
      c.productionStatus,
      c.shed?.name ?? '',
      c.lastBcs ?? '',
      c.lastWeightKg ?? '',
    ]);

    return {
      title: 'Cattle Export',
      period: `${cattle.length} record(s)`,
      summary: [{ label: 'Total cattle', value: cattle.length }],
      columns: [
        'TAG',
        'Name',
        'Gender',
        'Breed',
        'DOB',
        'Status',
        'Production Status',
        'Shed',
        'BCS',
        'Weight (kg)',
      ],
      rows,
    };
  }

  /** Raw milk log dump for a date range — not an aggregation. */
  private async milkExport(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const from = params.fromDate ? this.dayStart(params.fromDate) : undefined;
    const to = params.toDate
      ? this.addDays(this.dayStart(params.toDate), 1)
      : undefined;

    const entries = await this.prisma.milkLogEntry.findMany({
      where: {
        farmId,
        ...(from || to
          ? {
              logDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      select: {
        logDate: true,
        session: true,
        yieldL: true,
        tankType: true,
        submitted: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
      orderBy: [{ logDate: 'desc' }, { session: 'asc' }],
    });

    const rows = entries.map((e) => [
      this.dateLabel(e.logDate),
      e.session,
      e.cattle.tagNumber,
      e.cattle.name ?? '',
      this.round(e.yieldL),
      e.tankType,
      e.submitted ? 'Yes' : 'No',
    ]);
    const period =
      params.fromDate || params.toDate
        ? `${params.fromDate ?? '…'} to ${params.toDate ?? '…'}`
        : 'All time';

    return {
      title: 'Milk Log Export',
      period,
      summary: [{ label: 'Entries', value: entries.length }],
      columns: [
        'Date',
        'Session',
        'TAG',
        'Name',
        'Yield (L)',
        'Tank Type',
        'Submitted',
      ],
      rows,
    };
  }

  /**
   * Raw finance transactions dump for a date range. RAKHAL-354: rewritten
   * off the dropped V1 `FinanceTransaction` onto Finance V2's
   * `JournalTransaction` — every Sale/Purchase/Payment/Transfer/Expense/
   * OtherIncome posting, one row per transaction (not per debit/credit
   * line — `FINANCE_V2_DESIGN.md` §9's AC forbids exposing raw ledger
   * debit/credit rows to farmer-facing surfaces, same rule RAKHAL-360
   * followed for the frontend's own Ledger tab). `amount` is each posting's
   * total debit (== total credit for a balanced entry, `JournalService`'s
   * own invariant), computed once per transaction rather than joining in
   * every `JournalEntry` line. `params.category` filters on `sourceType`
   * (`SALE`/`PURCHASE`/`PAYMENT`/`TRANSFER`/`EXPENSE`/`OTHER_INCOME`);
   * `params.status` filters on `JournalTransactionStatus`
   * (`POSTED`/`REVERSED`) — both best-effort remaps of the old free-string
   * filters, since neither V1 concept (`FinanceCategory`/`FinanceTxnStatus`)
   * exists anymore. Reversal rows are intentionally included (an audit
   * export, not a money-sum aggregation, same precedent the V1 version
   * documented).
   */
  private async financeExport(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const rows = await this.prisma.journalTransaction.findMany({
      where: {
        farmId,
        ...(params.category ? { sourceType: params.category } : {}),
        ...(params.status
          ? { status: params.status as JournalTransactionStatus }
          : {}),
        ...(params.fromDate || params.toDate
          ? {
              transactionDate: {
                ...(params.fromDate ? { gte: new Date(params.fromDate) } : {}),
                ...(params.toDate ? { lte: new Date(params.toDate) } : {}),
              },
            }
          : {}),
        ...(params.search
          ? {
              description: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        transactionDate: true,
        sourceType: true,
        sourceId: true,
        description: true,
        status: true,
        reversalOfId: true,
        entries: { select: { debit: true } },
      },
    });

    const period =
      params.fromDate || params.toDate
        ? `${params.fromDate ?? '…'} to ${params.toDate ?? '…'}`
        : 'All time';

    return {
      title: 'Finance Transactions Export',
      period,
      summary: [{ label: 'Transactions', value: rows.length }],
      columns: [
        'Date',
        'Source Type',
        'Source Reference',
        'Description',
        'Amount',
        'Status',
        'Reversal',
      ],
      rows: rows.map((t) => [
        this.dateLabel(t.transactionDate),
        t.sourceType,
        t.sourceId,
        t.description,
        this.round(t.entries.reduce((s, e) => s + Number(e.debit), 0)),
        t.status,
        t.reversalOfId ? 'yes' : 'no',
      ]),
    };
  }

  /** Raw health cases dump — not an aggregation. */
  private async healthcareExport(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const cases = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        deletedAt: null,
        ...(params.status ? { status: params.status as HealthCaseStatus } : {}),
        ...(params.search
          ? {
              OR: [
                {
                  diagnosis: {
                    contains: params.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  caseCode: {
                    contains: params.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        caseCode: true,
        diagnosis: true,
        diagnosisType: true,
        priority: true,
        status: true,
        startDate: true,
        expectedRecoveryDate: true,
        closedDate: true,
        shedName: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const rows = cases.map((c) => [
      c.caseCode,
      c.cattle.tagNumber,
      c.cattle.name ?? '',
      c.diagnosis,
      c.diagnosisType,
      c.priority,
      c.status,
      c.shedName ?? '',
      this.dateLabel(c.startDate),
      c.expectedRecoveryDate ? this.dateLabel(c.expectedRecoveryDate) : '',
      c.closedDate ? this.dateLabel(c.closedDate) : '',
    ]);

    return {
      title: 'Healthcare Cases Export',
      period: `${cases.length} case(s)`,
      summary: [{ label: 'Total cases', value: cases.length }],
      columns: [
        'Case',
        'TAG',
        'Name',
        'Diagnosis',
        'Type',
        'Priority',
        'Status',
        'Shed',
        'Start',
        'Expected Recovery',
        'Closed',
      ],
      rows,
    };
  }

  /**
   * Dashboard Export (PDF only) — a multi-section snapshot mirroring the live
   * dashboard's own topics (production/reproduction/health/finance/feed),
   * composed by reusing the existing single-topic generators' `ReportData`
   * (converted to sections) rather than re-deriving the same aggregations —
   * no server-side chart-image rendering (would need a new charting
   * dependency and slower jobs); tables/numbers only, same as every other
   * report this engine produces.
   */
  private async dashboardExport(farmId: string): Promise<ReportData> {
    const params: ReportParams = {};
    const [production, openCows, calvingForecast, health, finance, feed] =
      await Promise.all([
        this.monthlyProduction(farmId, params),
        this.openCows(farmId),
        this.calvingForecast(farmId),
        this.weeklyHealth(farmId, params),
        this.monthlyPl(farmId, params),
        this.feedCost(farmId, params),
      ]);

    return {
      title: 'Dashboard Export',
      period: this.dateLabel(new Date()),
      columns: [],
      rows: [],
      sections: [
        this.toSection(production, 'Production'),
        this.toSection(openCows, 'Reproduction — Open Cows'),
        this.toSection(calvingForecast, 'Reproduction — Calving Forecast'),
        this.toSection(health, 'Health'),
        this.toSection(finance, 'Finance'),
        this.toSection(feed, 'Feed Cost'),
      ],
    };
  }

  private toSection(data: ReportData, heading: string): ReportSection {
    return {
      heading,
      summary: data.summary,
      columns: data.columns,
      rows: data.rows,
    };
  }

  // ---- Lactation (RAKHAL-288) ----------------------------------------------

  /**
   * Individual Lactation Report (RAKHAL-288, Milestone 16). Reads
   * `lactationId` directly when supplied, otherwise resolves it from
   * `cattleId` — the cow's current `ACTIVE` lactation, or her most recently
   * ended one if she has none (mirrors `LactationStatsService`'s own
   * fallback shape). Reuses the pure domain functions RAKHAL-283/284
   * (`lactation-yield.ts`/`lactation-persistency.ts`) already built rather
   * than re-deriving totals/persistency — same "peak/persistency here can
   * never disagree with `GET /reproduction/lactations/:id/stats`" guarantee
   * that service's own doc comments establish. Direct-Prisma throughout (no
   * `ReproductionModule`/`MilkModule` service injection), matching this
   * generator's own established no-cross-module-coupling convention.
   */
  private async lactationIndividual(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const lactation = await this.resolveLactationForReport(farmId, params);
    const now = new Date();
    const rangeEnd = lactation.endDate ?? now;
    const referenceDate = rangeEnd < now ? rangeEnd : now;

    const [
      entries,
      qualityTests,
      healthCases,
      breedingEvents,
      pregnancies,
      dryPeriod,
    ] = await Promise.all([
      this.prisma.milkLogEntry.findMany({
        where: {
          cattleId: lactation.cattleId,
          logDate: { gte: lactation.startDate, lte: rangeEnd },
        },
        select: { logDate: true, yieldL: true, disposition: true },
      }),
      this.prisma.milkQualityTest.findMany({
        where: { lactationId: lactation.id },
        orderBy: [{ sampleDate: 'desc' }],
        take: 20,
      }),
      this.prisma.healthCase.findMany({
        where: {
          cattleId: lactation.cattleId,
          deletedAt: null,
          startDate: { lte: rangeEnd },
          OR: [
            { closedDate: null },
            { closedDate: { gte: lactation.startDate } },
          ],
        },
        select: {
          diagnosis: true,
          priority: true,
          status: true,
          startDate: true,
          closedDate: true,
        },
        orderBy: { startDate: 'desc' },
        take: 50,
      }),
      this.prisma.breedingEvent.findMany({
        where: {
          cattleId: lactation.cattleId,
          breedingDate: { gte: lactation.startDate, lte: rangeEnd },
        },
        select: {
          breedingDate: true,
          breedingMethod: true,
          breedingNumber: true,
          status: true,
        },
        orderBy: { breedingDate: 'asc' },
      }),
      this.prisma.pregnancy.findMany({
        where: {
          cattleId: lactation.cattleId,
          conceptionDate: { gte: lactation.startDate, lte: rangeEnd },
        },
        select: {
          conceptionDate: true,
          expectedCalvingDate: true,
          actualCalvingDate: true,
          status: true,
        },
        orderBy: { conceptionDate: 'asc' },
      }),
      this.prisma.dryPeriod.findFirst({
        where: { cattleId: lactation.cattleId },
        select: {
          startDate: true,
          actualEndDate: true,
          reason: true,
          notes: true,
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    const yieldEntries: YieldEntry[] = entries;

    const dim = lactationDaysBetween(lactation.startDate, referenceDate);
    const sevenDayAvgYield = averageDailyYield(yieldEntries, {
      referenceDate,
      windowDays: 7,
      lactationStart: lactation.startDate,
    });
    const totals = totalsByDisposition(yieldEntries);
    const peak =
      lactation.peakMilkYield != null &&
      lactation.peakDaysInMilk != null &&
      lactation.peakMilkDate != null
        ? {
            yieldL: lactation.peakMilkYield,
            date: lactation.peakMilkDate,
            dim: lactation.peakDaysInMilk,
          }
        : null;
    const persistency: LactationPersistency | null =
      computeLactationPersistency({
        currentSevenDayAvgYield: sevenDayAvgYield,
        peakMilkYield: lactation.peakMilkYield,
        peakDaysInMilk: lactation.peakDaysInMilk,
        currentDaysInMilk: dim,
      });

    const overview: ReportSection = {
      heading: 'Overview',
      summary: [
        { label: 'DIM', value: lactation.endDate ? `${dim} (ended)` : dim },
        { label: 'Produced (L)', value: totals.produced },
        {
          label: 'Peak (L)',
          value: peak ? `${peak.yieldL} @ DIM ${peak.dim}` : 'Not yet recorded',
        },
        {
          label: 'Persistency (%)',
          value: persistency ? persistency.persistencyPct : 'N/A',
        },
      ],
      columns: ['Field', 'Value'],
      rows: [
        ['Cow', `${lactation.cattleTagNumber} (${lactation.cattleName ?? ''})`],
        ['Lactation number', lactation.lactationNumber],
        ['Estimated intake', lactation.isEstimated ? 'Yes' : 'No'],
        ['Start date', this.dateLabel(lactation.startDate)],
        [
          'End date',
          lactation.endDate ? this.dateLabel(lactation.endDate) : 'Ongoing',
        ],
        ['Status', lactation.status],
        ['DIM', dim],
        ['Shed', lactation.shedName ?? ''],
        ['Feed group', lactation.feedGroupName ?? ''],
      ],
    };

    const totalsSection: ReportSection = {
      heading: 'Totals & Yield',
      columns: ['Metric', 'Value'],
      rows: [
        ['7-day avg yield (L)', sevenDayAvgYield],
        ['Produced to date (L)', totals.produced],
        ['Saleable (L)', totals.saleable],
        ['Withheld (L)', totals.withheld],
        ['Colostrum (L)', totals.colostrum],
        ['Calf feed (L)', totals.calfFeed],
        ['Discarded (L)', totals.discarded],
        ['Household use (L)', totals.householdUse],
      ],
    };

    const peakSection: ReportSection = {
      heading: 'Peak & Persistency',
      columns: ['Metric', 'Value'],
      rows: peak
        ? [
            ['Peak yield (L)', peak.yieldL],
            ['Peak date', this.dateLabel(peak.date)],
            ['Peak DIM', peak.dim],
            ['Current 7-day avg (L)', sevenDayAvgYield],
            ['Persistency (%)', persistency?.persistencyPct ?? ''],
            ['Decline from peak (%)', persistency?.declinePct ?? ''],
            ['Days since peak', persistency?.daysSincePeak ?? ''],
          ]
        : [['Peak', 'Not yet recorded (no complete-quality day on record)']],
    };

    const qualitySection: ReportSection = {
      heading: 'Milk Quality Tests',
      summary: [{ label: 'Tests recorded', value: qualityTests.length }],
      columns: [
        'Date',
        'Fat %',
        'Protein %',
        'Lactose %',
        'SCC',
        'MUN',
        'Source',
      ],
      rows: qualityTests.map((t) => [
        this.dateLabel(t.sampleDate),
        t.fatPct,
        t.proteinPct,
        t.lactosePct,
        t.somaticCellCount,
        t.milkUreaNitrogen,
        t.source,
      ]),
    };

    const healthSection: ReportSection = {
      heading: 'Health Incidents',
      summary: [
        {
          label: 'Cases overlapping this lactation',
          value: healthCases.length,
        },
      ],
      columns: ['Diagnosis', 'Priority', 'Status', 'Started', 'Closed'],
      rows: healthCases.map((c) => [
        c.diagnosis,
        c.priority,
        c.status,
        this.dateLabel(c.startDate),
        c.closedDate ? this.dateLabel(c.closedDate) : '',
      ]),
    };

    const breedingRows: Cell[][] = [
      ...breedingEvents.map((b) => [
        this.dateLabel(b.breedingDate),
        `Breeding #${b.breedingNumber} (${b.breedingMethod})`,
        b.status,
      ]),
      ...pregnancies.map((p) => [
        this.dateLabel(p.conceptionDate),
        `Pregnancy confirmed (expected calving ${
          p.expectedCalvingDate
            ? this.dateLabel(p.expectedCalvingDate)
            : 'unknown'
        })`,
        p.status,
      ]),
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const breedingSection: ReportSection = {
      heading: 'Breeding Timeline',
      columns: ['Date', 'Event', 'Status'],
      rows: breedingRows,
    };

    const dryOffRows: Cell[][] = [];
    if (lactation.endReason) {
      dryOffRows.push(['End reason', lactation.endReason]);
    }
    if (dryPeriod && lactation.endDate) {
      dryOffRows.push([
        'Last milking (dry-off start)',
        this.dateLabel(dryPeriod.startDate),
      ]);
      dryOffRows.push(['Dry-off reason (recorded)', dryPeriod.reason ?? '']);
      dryOffRows.push([
        'Actual end of dry period',
        dryPeriod.actualEndDate
          ? this.dateLabel(dryPeriod.actualEndDate)
          : 'Ongoing',
      ]);
      dryOffRows.push(['Notes / dry-cow treatment', dryPeriod.notes ?? '']);
    }
    const dryOffSection: ReportSection = {
      heading: 'Dry-off',
      columns: ['Field', 'Value'],
      rows: dryOffRows.length
        ? dryOffRows
        : [
            [
              'Status',
              lactation.endDate
                ? 'Ended, no dry-off record found'
                : 'Still lactating',
            ],
          ],
    };

    return {
      title: `Individual Lactation Report — ${lactation.cattleTagNumber}`,
      period: `Lactation #${lactation.lactationNumber}`,
      columns: [],
      rows: [],
      sections: [
        overview,
        totalsSection,
        peakSection,
        qualitySection,
        healthSection,
        breedingSection,
        dryOffSection,
      ],
    };
  }

  private async resolveLactationForReport(
    farmId: string,
    params: ReportParams,
  ): Promise<{
    id: string;
    cattleId: string;
    cattleTagNumber: string;
    cattleName: string | null;
    lactationNumber: number;
    isEstimated: boolean;
    startDate: Date;
    endDate: Date | null;
    status: LactationStatus;
    endReason: string | null;
    peakMilkYield: number | null;
    peakMilkDate: Date | null;
    peakDaysInMilk: number | null;
    shedName: string | null;
    feedGroupName: string | null;
  }> {
    const select = {
      id: true,
      cattleId: true,
      lactationNumber: true,
      isEstimated: true,
      startDate: true,
      endDate: true,
      status: true,
      endReason: true,
      peakMilkYield: true,
      peakMilkDate: true,
      peakDaysInMilk: true,
      cattle: {
        select: {
          tagNumber: true,
          name: true,
          shed: { select: { name: true } },
          feedGroup: { select: { name: true } },
        },
      },
    } as const;

    let row: {
      id: string;
      cattleId: string;
      lactationNumber: number;
      isEstimated: boolean;
      startDate: Date;
      endDate: Date | null;
      status: LactationStatus;
      endReason: string | null;
      peakMilkYield: number | null;
      peakMilkDate: Date | null;
      peakDaysInMilk: number | null;
      cattle: {
        tagNumber: string;
        name: string | null;
        shed: { name: string } | null;
        feedGroup: { name: string } | null;
      };
    } | null = null;

    if (params.lactationId) {
      row = await this.prisma.lactation.findFirst({
        where: { id: params.lactationId, cattle: { farmId } },
        select,
      });
    } else if (params.cattleId) {
      row = await this.prisma.lactation.findFirst({
        where: {
          cattleId: params.cattleId,
          cattle: { farmId },
          status: LactationStatus.ACTIVE,
        },
        select,
      });
      if (!row) {
        row = await this.prisma.lactation.findFirst({
          where: {
            cattleId: params.cattleId,
            cattle: { farmId },
            endDate: { not: null },
          },
          orderBy: { endDate: 'desc' },
          select,
        });
      }
    } else {
      throw new BadRequestException(
        'cattleId or lactationId is required for this report',
      );
    }

    if (!row) {
      throw new BadRequestException('No lactation found for this cow');
    }

    return {
      id: row.id,
      cattleId: row.cattleId,
      cattleTagNumber: row.cattle.tagNumber,
      cattleName: row.cattle.name,
      lactationNumber: row.lactationNumber,
      isEstimated: row.isEstimated,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      endReason: row.endReason,
      peakMilkYield: row.peakMilkYield,
      peakMilkDate: row.peakMilkDate,
      peakDaysInMilk: row.peakDaysInMilk,
      shedName: row.cattle.shed?.name ?? null,
      feedGroupName: row.cattle.feedGroup?.name ?? null,
    };
  }

  /**
   * Herd Lactation Dashboard (RAKHAL-288). Currently-milking (`ACTIVE`
   * lactation) cows bucketed by `LactationStage` (reuses `deriveLactationStage`,
   * RAKHAL-273 — a cow with an `ACTIVE` lactation is never `DRY_PERIOD`, so
   * that bucket never appears here), plus farm-wide today/DIM/withholding
   * figures matching `dailyMilk`'s own conventions.
   */
  private async lactationHerdDashboard(farmId: string): Promise<ReportData> {
    const now = new Date();
    const today = this.dayStart();
    const tomorrow = this.addDays(today, 1);
    const thresholds = await this.farmSettings.lactationStageThresholds(farmId);

    const activeLactations = await this.prisma.lactation.findMany({
      where: {
        status: LactationStatus.ACTIVE,
        cattle: activeHerdScope(farmId),
      },
      select: {
        cattleId: true,
        startDate: true,
        cattle: { select: { tagNumber: true, name: true } },
      },
    });

    const cattleIds = activeLactations.map((l) => l.cattleId);
    const [todayRows, withheldTodayAgg] = await Promise.all([
      cattleIds.length
        ? this.prisma.milkLogEntry.findMany({
            where: {
              farmId,
              cattleId: { in: cattleIds },
              logDate: { gte: today, lt: tomorrow },
            },
            select: { cattleId: true, yieldL: true },
          })
        : Promise.resolve([]),
      this.prisma.milkLogEntry.aggregate({
        where: {
          farmId,
          logDate: { gte: today, lt: tomorrow },
          tankType: MilkTankType.WITHHOLDING,
        },
        _sum: { yieldL: true },
      }),
    ]);

    const todayByCow = new Map<string, number>();
    for (const r of todayRows) {
      todayByCow.set(r.cattleId, (todayByCow.get(r.cattleId) ?? 0) + r.yieldL);
    }

    const stageBuckets = new Map<LactationStage, number>();
    let dimTotal = 0;
    let highestProducer: {
      tagNumber: string;
      name: string | null;
      yieldL: number;
    } | null = null;
    for (const lactation of activeLactations) {
      const stage = deriveLactationStage({
        now,
        lactationStartDate: lactation.startDate,
        isInActiveDryPeriod: false,
        farmSettings: thresholds,
      });
      if (stage) stageBuckets.set(stage, (stageBuckets.get(stage) ?? 0) + 1);
      dimTotal += lactationDaysBetween(lactation.startDate, now);

      const todayYield = todayByCow.get(lactation.cattleId) ?? 0;
      if (!highestProducer || todayYield > highestProducer.yieldL) {
        highestProducer = {
          tagNumber: lactation.cattle.tagNumber,
          name: lactation.cattle.name,
          yieldL: todayYield,
        };
      }
    }

    const milkingCount = activeLactations.length;
    const cowsWithYieldToday = [...todayByCow.values()].filter(
      (v) => v > 0,
    ).length;
    const totalYieldToday = [...todayByCow.values()].reduce((a, b) => a + b, 0);
    const avgMilkPerCowPerDay = cowsWithYieldToday
      ? this.round(totalYieldToday / cowsWithYieldToday)
      : 0;
    const avgDim = milkingCount ? Math.round(dimTotal / milkingCount) : 0;
    const withheldToday = this.round(withheldTodayAgg._sum.yieldL ?? 0);

    const stageOrder: LactationStage[] = [
      'FRESH',
      'EARLY',
      'MID',
      'LATE',
      'DRY_PERIOD',
    ];

    return {
      title: 'Herd Lactation Dashboard',
      period: this.dateLabel(now),
      summary: [
        { label: 'Currently milking', value: milkingCount },
        { label: 'Avg milk/cow/day (L)', value: avgMilkPerCowPerDay },
        { label: 'Avg DIM', value: avgDim },
        {
          label: 'Highest producer',
          value: highestProducer
            ? `${highestProducer.tagNumber} (${this.round(highestProducer.yieldL)} L)`
            : 'N/A',
        },
        { label: 'Milk withheld today (L)', value: withheldToday },
      ],
      columns: ['Stage', 'Cows milking'],
      rows: stageOrder
        .filter((s) => stageBuckets.has(s))
        .map((s) => [s, stageBuckets.get(s) ?? 0]),
    };
  }

  // ---- shared aggregation helpers ----------------------------------------

  private async farmCattleIds(farmId: string): Promise<string[]> {
    // No `deletedAt` filter (RAKHAL-310) — every caller uses this for
    // historical-period aggregation, where an animal that has since been
    // archived/sold must still count for events inside the reported period.
    const rows = await this.prisma.cattle.findMany({
      where: { farmId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * RAKHAL-354: V1 `FinanceTransaction` dropped — this used to add it to
   * `JournalEntry` (RAKHAL-351's additive re-point; every report that calls
   * this — Monthly Farm Report, Financial Summary, Feed Cost's
   * `totalExpense` sibling call, etc — needed both sources while V1 was
   * still frozen-but-alive). V2's ledger is now the sole source.
   */
  private async revenueTotal(farmId: string, start: Date, end: Date) {
    return ledgerCategoryNet(
      this.prisma,
      farmId,
      LedgerAccountCategory.REVENUE,
      {
        gte: start,
        lt: end,
      },
    );
  }

  /** Same as {@link revenueTotal}, on the EXPENSE side. */
  private async expenseTotal(farmId: string, start: Date, end: Date) {
    return ledgerCategoryNet(
      this.prisma,
      farmId,
      LedgerAccountCategory.EXPENSE,
      {
        gte: start,
        lt: end,
      },
    );
  }

  private async litresTotal(farmId: string, start: Date, end: Date) {
    const agg = await this.prisma.milkLogEntry.aggregate({
      where: { farmId, logDate: { gte: start, lt: end } },
      _sum: { yieldL: true },
    });
    return agg._sum.yieldL ?? 0;
  }

  // ---- date helpers -------------------------------------------------------

  private dayStart(dateStr?: string): Date {
    const d = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addDays(date: Date, n: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }

  private monthRange(month?: string): {
    start: Date;
    end: Date;
    label: string;
  } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let m = now.getUTCMonth();
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, mm] = month.split('-').map(Number);
      year = y;
      m = mm - 1;
    }
    const start = new Date(Date.UTC(year, m, 1));
    const end = new Date(Date.UTC(year, m + 1, 1));
    return {
      start,
      end,
      label: `${year}-${String(m + 1).padStart(2, '0')}`,
    };
  }

  private monthsAgo(from: Date, n: number): Date {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 1));
  }

  private daysBetween(start: Date, end: Date): number {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private dateLabel(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
