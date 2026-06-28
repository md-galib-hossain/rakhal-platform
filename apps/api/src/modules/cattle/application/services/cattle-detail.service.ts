import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FinanceTxnType,
  LactationStatus,
  MilkSession,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import {
  buildLactationCurve,
  DailyYield,
  trendPct,
} from '../../domain/lactation-curve';

/**
 * Read-only aggregator for the Cattle detail page tabs (PRD §8.5 / API §4):
 * Overview (Tab 1), Pedigree (Tab 5), and per-animal Finance (Tab 4). Reads the
 * already-built Milk / Finance / Reproduction tables directly via the global
 * Prisma client (same pattern as the Dashboard aggregator) — every query is
 * farm-scoped through the owning cattle row. Reproduction (Tab 2) and Health
 * (Tab 3) are served by their own modules' `*-summary` endpoints.
 */
@Injectable()
export class CattleDetailService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(CattleDetailService.name);
  }

  // ---- Tab 1: Overview ----------------------------------------------------

  async overview(farmId: string, cattleId: string) {
    const cattle = await this.getCattleOrThrow(farmId, cattleId);
    const now = new Date();

    const [weightRecords, bcsRecords, activeLactation, last14Days, lifetime] =
      await Promise.all([
        this.prisma.weightRecord.findMany({
          where: { cattleId },
          orderBy: { recordedDate: 'desc' },
          take: 24,
        }),
        this.prisma.bodyConditionScore.findMany({
          where: { cattleId },
          orderBy: { recordedDate: 'desc' },
          take: 24,
        }),
        this.prisma.lactation.findFirst({
          where: { cattleId, status: LactationStatus.ACTIVE },
          orderBy: { startDate: 'desc' },
          select: { startDate: true },
        }),
        // Last 14 production days of entries → split into this-week vs last-week.
        this.prisma.milkLogEntry.findMany({
          where: {
            cattleId,
            logDate: { gte: this.daysAgo(now, 14) },
          },
          select: { logDate: true, session: true, yieldL: true },
        }),
        this.prisma.milkLogEntry.findMany({
          where: { cattleId },
          select: { logDate: true, yieldL: true },
        }),
      ]);

    const dailyTotals = this.dailyTotals(last14Days);
    const last7 = this.sumOnOrAfter(dailyTotals, this.daysAgo(now, 7));
    const prev7 = this.sumBetween(
      dailyTotals,
      this.daysAgo(now, 14),
      this.daysAgo(now, 7),
    );

    const [latestWeight, priorWeight] = weightRecords;

    return {
      aqr_score: cattle.aqrScore,
      // No historical AQR snapshots yet — trend deferred (TECH_DEBT RD-012).
      aqr_change_pct: null as number | null,
      avg_daily_yield_7d: this.round(last7 / 7),
      yield_change_pct: trendPct(last7, prev7),
      last_weight_kg: latestWeight?.weightKg ?? cattle.lastWeightKg ?? null,
      weight_change_pct:
        latestWeight && priorWeight
          ? trendPct(latestWeight.weightKg, priorWeight.weightKg)
          : null,
      bcs_records: bcsRecords.map((r) => ({
        date: r.recordedDate,
        score: r.score,
      })),
      weight_history: weightRecords.map((r) => ({
        date: r.recordedDate,
        weight_kg: r.weightKg,
      })),
      lactation_curve: activeLactation
        ? buildLactationCurve(
            activeLactation.startDate,
            await this.curveYields(cattleId, activeLactation.startDate),
          )
        : [],
      lifetime_yield: this.lifetimeByYear(lifetime),
      recent_milk_records: this.recentMilkRecords(last14Days),
    };
  }

  // ---- Tab 5: Pedigree ----------------------------------------------------

  async pedigree(farmId: string, cattleId: string) {
    const self = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      include: {
        mother: { select: this.pedigreeSelect() },
        father: { select: this.pedigreeSelect() },
      },
    });
    if (!self) {
      this.log.warn('Cattle not found', { cattleId, farmId });
      throw new NotFoundException('Cattle not found');
    }

    const siblings =
      self.motherId || self.fatherId
        ? await this.prisma.cattle.findMany({
            where: {
              farmId,
              id: { not: cattleId },
              OR: [
                ...(self.motherId ? [{ motherId: self.motherId }] : []),
                ...(self.fatherId ? [{ fatherId: self.fatherId }] : []),
              ],
            },
            orderBy: { tagNumber: 'asc' },
            select: {
              id: true,
              name: true,
              tagNumber: true,
              gender: true,
              motherId: true,
              fatherId: true,
            },
          })
        : [];

    const offspring = await this.prisma.cattle.findMany({
      where: { farmId, OR: [{ motherId: cattleId }, { fatherId: cattleId }] },
      orderBy: { tagNumber: 'asc' },
      select: {
        id: true,
        name: true,
        tagNumber: true,
        gender: true,
        dateOfBirth: true,
      },
    });

    return {
      self: this.pedigreeNode(self),
      dam: self.mother ? this.pedigreeNode(self.mother) : null,
      // Sire is external when no in-herd father is linked (PRD §8.4 free-text bull).
      sire: self.father
        ? { ...this.pedigreeNode(self.father), is_external: false }
        : {
            id: null,
            name: null,
            tag: null,
            gender: 'male',
            is_external: true,
          },
      siblings: siblings.map((s) => ({
        ...this.pedigreeNode(s),
        relation:
          self.motherId &&
          self.fatherId &&
          s.motherId === self.motherId &&
          s.fatherId === self.fatherId
            ? 'full_sibling'
            : 'half_sibling',
      })),
      offspring: offspring.map((o) => ({
        id: o.id,
        name: o.name,
        tag: o.tagNumber,
        gender: o.gender,
        birth_date: o.dateOfBirth,
      })),
    };
  }

  // ---- Tab 4: Finance (per-animal P&L) ------------------------------------

  async cattleFinance(farmId: string, cattleId: string, period?: string) {
    await this.getCattleOrThrow(farmId, cattleId);
    const { start, end, label } = this.monthRange(period);

    const [periodTxns, monthlyTxns] = await Promise.all([
      this.prisma.financeTransaction.findMany({
        where: {
          farmId,
          cattleId,
          ...NON_VOID_TXN,
          date: { gte: start, lt: end },
        },
        select: { type: true, category: true, subType: true, amount: true },
      }),
      // Last 6 months for the income-vs-cost chart.
      this.prisma.financeTransaction.findMany({
        where: {
          farmId,
          cattleId,
          ...NON_VOID_TXN,
          date: { gte: this.monthsAgo(start, 5) },
        },
        select: { type: true, amount: true, date: true },
      }),
    ]);

    let totalIncome = 0;
    let totalCost = 0;
    const expense = { feed: 0, health: 0, breeding: 0, others: 0 };
    const income = { milk_sales: 0, calf_sales: 0 };

    for (const txn of periodTxns) {
      if (txn.type === FinanceTxnType.REVENUE) {
        totalIncome += txn.amount;
        if (txn.subType === 'milk') income.milk_sales += txn.amount;
        else if (txn.subType === 'animal' || txn.subType === 'calf')
          income.calf_sales += txn.amount;
      } else if (
        txn.type === FinanceTxnType.OPERATING_EXPENSE ||
        txn.type === FinanceTxnType.INVENTORY_PURCHASE
      ) {
        totalCost += txn.amount;
        expense[this.expenseBucket(txn.category, txn.subType)] += txn.amount;
      }
    }

    return {
      period: label,
      total_income: this.round(totalIncome),
      total_cost: this.round(totalCost),
      net_profit: this.round(totalIncome - totalCost),
      expense_breakdown: this.roundAll(expense),
      income_breakdown: this.roundAll(income),
      monthly_chart: this.monthlyChart(monthlyTxns, start),
    };
  }

  // ---- internals ----------------------------------------------------------

  private async curveYields(
    cattleId: string,
    since: Date,
  ): Promise<DailyYield[]> {
    const rows = await this.prisma.milkLogEntry.findMany({
      where: { cattleId, logDate: { gte: since } },
      select: { logDate: true, yieldL: true },
    });
    return this.dailyTotals(rows);
  }

  private dailyTotals(
    rows: { logDate: Date; yieldL: number; session?: MilkSession }[],
  ): DailyYield[] {
    const byDay = new Map<number, number>();
    for (const row of rows) {
      const key = row.logDate.getTime();
      byDay.set(key, (byDay.get(key) ?? 0) + row.yieldL);
    }
    return [...byDay.entries()]
      .map(([time, totalL]) => ({ date: new Date(time), totalL }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private recentMilkRecords(
    rows: { logDate: Date; session: MilkSession; yieldL: number }[],
  ) {
    // Group the last window's entries into per-day, per-session totals.
    const byDay = new Map<
      number,
      { morning_l: number; noon_l: number; evening_l: number; night_l: number }
    >();
    for (const row of rows) {
      const key = row.logDate.getTime();
      const day = byDay.get(key) ?? {
        morning_l: 0,
        noon_l: 0,
        evening_l: 0,
        night_l: 0,
      };
      day[this.sessionField(row.session)] += row.yieldL;
      byDay.set(key, day);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 7)
      .map(([time, s]) => ({
        date: new Date(time),
        morning_l: this.round(s.morning_l),
        noon_l: this.round(s.noon_l),
        evening_l: this.round(s.evening_l),
        night_l: this.round(s.night_l),
        total_l: this.round(s.morning_l + s.noon_l + s.evening_l + s.night_l),
      }));
  }

  private sessionField(
    session: MilkSession,
  ): 'morning_l' | 'noon_l' | 'evening_l' | 'night_l' {
    switch (session) {
      case MilkSession.MORNING:
        return 'morning_l';
      case MilkSession.NOON:
        return 'noon_l';
      case MilkSession.EVENING:
        return 'evening_l';
      case MilkSession.NIGHT:
        return 'night_l';
    }
  }

  private lifetimeByYear(rows: { logDate: Date; yieldL: number }[]) {
    const byYear = new Map<number, number>();
    for (const row of rows) {
      const year = row.logDate.getUTCFullYear();
      byYear.set(year, (byYear.get(year) ?? 0) + row.yieldL);
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, total]) => ({ year, total_l: this.round(total) }));
  }

  private monthlyChart(
    rows: { type: FinanceTxnType; amount: number; date: Date }[],
    start: Date,
  ) {
    const months: { month: string; income: number; cost: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const m = this.monthsAgo(start, i);
      months.push({ month: this.monthLabel(m), income: 0, cost: 0 });
    }
    const index = new Map(months.map((m, i) => [m.month, i]));
    for (const txn of rows) {
      const i = index.get(this.monthLabel(txn.date));
      if (i === undefined) continue;
      if (txn.type === FinanceTxnType.REVENUE) months[i].income += txn.amount;
      else if (
        txn.type === FinanceTxnType.OPERATING_EXPENSE ||
        txn.type === FinanceTxnType.INVENTORY_PURCHASE
      )
        months[i].cost += txn.amount;
    }
    return months.map((m) => ({
      month: m.month,
      income: this.round(m.income),
      cost: this.round(m.cost),
    }));
  }

  private expenseBucket(
    category: string,
    subType: string | null,
  ): 'feed' | 'health' | 'breeding' | 'others' {
    if (category === 'INVENTORY') return 'feed';
    if (category === 'HEALTHCARE') return 'health';
    if (subType && /breed|semen|ai/i.test(subType)) return 'breeding';
    return 'others';
  }

  private sumOnOrAfter(daily: DailyYield[], from: Date) {
    return daily
      .filter((d) => d.date.getTime() >= from.getTime())
      .reduce((acc, d) => acc + d.totalL, 0);
  }

  private sumBetween(daily: DailyYield[], from: Date, to: Date) {
    return daily
      .filter(
        (d) =>
          d.date.getTime() >= from.getTime() && d.date.getTime() < to.getTime(),
      )
      .reduce((acc, d) => acc + d.totalL, 0);
  }

  private monthRange(period?: string) {
    const now = new Date();
    let year = now.getUTCFullYear();
    let month = now.getUTCMonth();
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-').map(Number);
      year = y;
      month = m - 1;
    }
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    return { start, end, label: this.monthLabel(start) };
  }

  private monthsAgo(from: Date, n: number) {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 1));
  }

  private monthLabel(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private daysAgo(from: Date, n: number) {
    const d = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  }

  private pedigreeSelect() {
    return {
      id: true,
      name: true,
      tagNumber: true,
      gender: true,
    } satisfies Prisma.CattleSelect;
  }

  private pedigreeNode(c: {
    id: string;
    name: string | null;
    tagNumber: string;
    gender: string;
  }) {
    return { id: c.id, name: c.name, tag: c.tagNumber, gender: c.gender };
  }

  private roundAll<T extends Record<string, number>>(obj: T): T {
    const out = {} as T;
    for (const key of Object.keys(obj) as (keyof T)[]) {
      out[key] = this.round(obj[key]) as T[keyof T];
    }
    return out;
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async getCattleOrThrow<T extends Prisma.CattleInclude | undefined>(
    farmId: string,
    id: string,
    include?: T,
  ) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id, farmId },
      include,
    });
    if (!cattle) {
      this.log.warn('Cattle not found', { cattleId: id, farmId });
      throw new NotFoundException('Cattle not found');
    }
    return cattle;
  }
}
