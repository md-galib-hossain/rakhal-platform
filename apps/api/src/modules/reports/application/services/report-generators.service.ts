import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FinanceCategory,
  FinanceTxnType,
  HealthActionType,
  HealthCaseStatus,
  HealthTaskStatus,
  MilkTankType,
  ProductionStatus,
  ReproductiveStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import { Cell, ReportData, ReportSection } from '../../domain/report-data';

export interface ReportParams {
  date?: string;
  month?: string; // YYYY-MM
  year?: string; // YYYY
  shedId?: string;
  cattleId?: string;
  fromDate?: string;
  toDate?: string;
}

const ACTIVE_PRODUCTION_EXCLUDE: ProductionStatus[] = [
  ProductionStatus.SOLD,
  ProductionStatus.DECEASED,
];

/**
 * The 12 MVP report generators (PRD §22.2) + the Feed Cost report (RD-013). Each
 * returns a renderer-agnostic {@link ReportData}. Read-only, farm-scoped via
 * direct Prisma queries (the Dashboard-aggregator pattern — no cross-module
 * service coupling, so no cycles).
 */
@Injectable()
export class ReportGeneratorsService {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { farmId, isActive: true, ...shedWhere },
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
        where: { cattleId: cattle.id },
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
        },
      }),
      this.prisma.reproductionProfile.count({
        where: {
          cattleId: { in: cattleIds },
          reproductiveStatus: ReproductiveStatus.OPEN,
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
        reproductiveStatus: ReproductiveStatus.OPEN,
        cattle: { farmId, isActive: true },
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
          where: { farmId, startDate: { gte: start, lt: endNext } },
        }),
        this.prisma.treatmentLog.count({
          where: { farmId, administeredAt: { gte: start, lt: endNext } },
        }),
        this.prisma.healthCase.count({
          where: {
            farmId,
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
      where: { farmId, taskType: HealthActionType.VACCINATION },
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
            productionStatus: { in: ACTIVE_PRODUCTION_EXCLUDE },
            updatedAt: { gte: yearStart, lt: yearEnd },
          },
        }),
        this.prisma.cattle.count({
          where: {
            farmId,
            isActive: true,
            productionStatus: { notIn: ACTIVE_PRODUCTION_EXCLUDE },
          },
        }),
        this.herdPurchaseValue(farmId, yearEnd),
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
   * Herd value as of a point in time (RD-013d/RD-010e): sum of non-voided
   * ANIMAL inventory-purchase transactions up to that date — the same
   * purchase-cost approximation `FinanceService.assets()` already uses for
   * its `cattle_herd` allocation, not a true per-head market revaluation
   * (still OPEN, RD-010e — no per-head market-price model exists yet).
   */
  private async herdPurchaseValue(farmId: string, asOf: Date): Promise<number> {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        farmId,
        ...NON_VOID_TXN,
        type: FinanceTxnType.INVENTORY_PURCHASE,
        category: FinanceCategory.INVENTORY,
        subType: 'animal',
        date: { lt: asOf },
      },
      _sum: { amount: true },
    });
    return this.round(agg._sum.amount ?? 0);
  }

  /**
   * Feed Cost Report (PRD §1.5 North-Star: ৳/L). Feed spend is identified by the
   * existing Finance↔FeedItem linkage (RD-010): non-voided transactions whose
   * `inventoryItemName` matches a feed item for the farm. Reported
   * against litres produced → feed cost per litre, feed's share of total expense,
   * and cost per cow per day, with a per-item breakdown. No feed-distribution
   * tracking yet (V1.5), so this is purchase-based, not consumption-based.
   */
  private async feedCost(
    farmId: string,
    params: ReportParams,
  ): Promise<ReportData> {
    const { start, end, label } = this.monthRange(params.month);
    const now = new Date();
    const effectiveEnd = end > now ? now : end;
    const days = Math.max(1, this.daysBetween(start, effectiveEnd) || 1);

    const [feedItems, txns, litres, totalExpense, activeCows] =
      await Promise.all([
        this.prisma.feedItem.findMany({
          where: { farmId },
          select: { name: true },
        }),
        this.prisma.financeTransaction.findMany({
          where: {
            farmId,
            ...NON_VOID_TXN,
            inventoryItemName: { not: null },
            date: { gte: start, lt: end },
          },
          select: { inventoryItemName: true, amount: true },
        }),
        this.litresTotal(farmId, start, end),
        this.expenseTotal(farmId, start, end),
        this.prisma.cattle.count({
          where: {
            farmId,
            isActive: true,
            productionStatus: { notIn: ACTIVE_PRODUCTION_EXCLUDE },
          },
        }),
      ]);

    const feedNames = new Set(feedItems.map((f) => f.name.toLowerCase()));
    const byItem = new Map<string, number>();
    for (const t of txns) {
      const name = t.inventoryItemName;
      if (!name || !feedNames.has(name.toLowerCase())) continue;
      byItem.set(name, (byItem.get(name) ?? 0) + t.amount);
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
    const [activeHerd, additions, removals, openCows] = await Promise.all([
      this.prisma.cattle.count({
        where: {
          farmId,
          isActive: true,
          productionStatus: { notIn: ACTIVE_PRODUCTION_EXCLUDE },
        },
      }),
      this.prisma.cattle.count({
        where: { farmId, createdAt: { gte: start, lt: end } },
      }),
      this.prisma.cattle.count({
        where: {
          farmId,
          productionStatus: { in: ACTIVE_PRODUCTION_EXCLUDE },
          updatedAt: { gte: start, lt: end },
        },
      }),
      this.prisma.reproductionProfile.count({
        where: {
          cattle: { farmId, isActive: true },
          reproductiveStatus: ReproductiveStatus.OPEN,
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
        where: { farmId, startDate: { gte: start, lt: end } },
      }),
      this.prisma.treatmentLog.count({
        where: { farmId, administeredAt: { gte: start, lt: end } },
      }),
      this.prisma.healthCase.count({
        where: {
          farmId,
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

  // ---- shared aggregation helpers ----------------------------------------

  private async farmCattleIds(farmId: string): Promise<string[]> {
    const rows = await this.prisma.cattle.findMany({
      where: { farmId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async revenueTotal(farmId: string, start: Date, end: Date) {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        farmId,
        ...NON_VOID_TXN,
        type: FinanceTxnType.REVENUE,
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  private async expenseTotal(farmId: string, start: Date, end: Date) {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        farmId,
        ...NON_VOID_TXN,
        type: {
          in: [
            FinanceTxnType.OPERATING_EXPENSE,
            FinanceTxnType.INVENTORY_PURCHASE,
          ],
        },
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
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
