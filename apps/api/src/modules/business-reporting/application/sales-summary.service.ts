import { Injectable } from '@nestjs/common';
import { Prisma, SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  toStorage,
  toMoney,
  subtract,
  clampNonNegative,
} from 'src/common/money';
import { changePct, derivePreviousPeriod } from 'src/common/finance/period';
import { SalesSummaryGranularity } from '../presentation/dto/sales-summary-query.dto';

interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface SalesSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  kpis: {
    totalSales: PeriodMetric;
    totalInvoices: PeriodMetric;
    paidAmount: PeriodMetric;
    outstanding: PeriodMetric;
  };
  trend: { bucket: string; amount: string }[];
  byProduct: { lineType: SaleLineType; amount: string; sharePct: number }[];
  topBuyers: {
    customerId: string;
    name: string;
    amount: string;
    invoiceCount: number;
  }[];
}

interface KpiRow {
  totalInvoices: bigint;
  totalSales: string | null;
  paidAmount: string | null;
}

interface TrendRow {
  bucket: Date;
  amount: string | null;
}

/**
 * `GET /sales/summary?from&to&granularity` (RAKHAL-374, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.7, §11). KPIs delegate to the same
 * `derivePreviousPeriod`/`changePct` pair `PeriodSummaryService` (RAKHAL-371)
 * uses — one implementation of the previous-period rule, per that ticket's
 * own AC extended here.
 *
 * `totalSales`/`totalInvoices`/`paidAmount` are computed by one raw-SQL CTE
 * (same allocation-sum pattern `AgingService`/`TransactionFeedService` use):
 * a `Sale` with no `Receivable` was paid in full at creation
 * (`deriveSalePaymentStatus`'s own rule, `sale.service.ts`), otherwise
 * `paidAmount` is the real `SUM(PaymentAllocation.amount)` across that sale's
 * receivable. `outstanding` is `totalSales - paidAmount`, never a second
 * query. `DRAFT` sales are excluded — same default `findAll` uses.
 *
 * `trend` uses Postgres `date_trunc(granularity, "saleDate")` so bucketing
 * happens in SQL, then the **empty buckets are filled in Node** by walking
 * the requested range at the same granularity — a zero day renders as zero,
 * never a gap (this ticket's own AC). `granularity` is one of 3 literal
 * strings validated by `@IsIn` on the DTO before it ever reaches
 * `Prisma.raw`, so this carries no injection risk despite being raw SQL.
 *
 * `byProduct` and `topBuyers` are plain `Prisma.groupBy` — no join-before-sum
 * needed, so no raw SQL required for those two.
 */
@Injectable()
export class SalesSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    farmId: string,
    from: Date,
    to: Date,
    granularity: SalesSummaryGranularity,
  ): Promise<SalesSummary> {
    const previous = derivePreviousPeriod({ from, to });

    const [current, prior, trend, byProduct, topBuyers] = await Promise.all([
      this.queryKpis(farmId, from, to),
      this.queryKpis(farmId, previous.from, previous.to),
      this.queryTrend(farmId, from, to, granularity),
      this.queryByProduct(farmId, from, to),
      this.queryTopBuyers(farmId, from, to),
    ]);

    const metric = (curr: number, prev: number): PeriodMetric => ({
      current: curr,
      previous: prev,
      changePct: changePct(curr, prev),
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      previousPeriod: {
        from: previous.from.toISOString(),
        to: previous.to.toISOString(),
      },
      kpis: {
        totalSales: metric(current.totalSales, prior.totalSales),
        totalInvoices: metric(current.totalInvoices, prior.totalInvoices),
        paidAmount: metric(current.paidAmount, prior.paidAmount),
        outstanding: metric(current.outstanding, prior.outstanding),
      },
      trend,
      byProduct,
      topBuyers,
    };
  }

  private async queryKpis(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalSales: number;
    totalInvoices: number;
    paidAmount: number;
    outstanding: number;
  }> {
    const rows = await this.prisma.$queryRaw<KpiRow[]>(Prisma.sql`
      WITH period_sales AS (
        SELECT s.id, s."totalAmount", r.id AS receivable_id
        FROM "Sale" s
        LEFT JOIN "Receivable" r ON r."saleId" = s.id
        WHERE s."farmId" = ${farmId}
          AND s.status != ${SaleStatus.DRAFT}::"SaleStatus"
          AND s."saleDate" >= ${from}
          AND s."saleDate" < ${to}
      ),
      alloc AS (
        SELECT ps.id AS sale_id, COALESCE(SUM(pa.amount), 0) AS allocated
        FROM period_sales ps
        LEFT JOIN "PaymentAllocation" pa ON pa."receivableId" = ps.receivable_id
        GROUP BY ps.id
      )
      SELECT
        COUNT(*)::int AS "totalInvoices",
        COALESCE(SUM(ps."totalAmount"), 0)::text AS "totalSales",
        COALESCE(
          SUM(
            CASE WHEN ps.receivable_id IS NULL THEN ps."totalAmount"
            ELSE alloc.allocated END
          ), 0
        )::text AS "paidAmount"
      FROM period_sales ps
      JOIN alloc ON alloc.sale_id = ps.id
    `);

    const row = rows[0];
    const totalSales = toStorage(row?.totalSales ?? 0);
    const paidAmount = toStorage(row?.paidAmount ?? 0);
    const outstanding = clampNonNegative(subtract(totalSales, paidAmount));

    return {
      totalSales: toMoney(totalSales).toNumber(),
      totalInvoices: row ? Number(row.totalInvoices) : 0,
      paidAmount: toMoney(paidAmount).toNumber(),
      outstanding: toMoney(outstanding).toNumber(),
    };
  }

  private async queryTrend(
    farmId: string,
    from: Date,
    to: Date,
    granularity: SalesSummaryGranularity,
  ): Promise<{ bucket: string; amount: string }[]> {
    // `granularity` is one of 'day'|'week'|'month', validated by `@IsIn` on
    // the DTO before this method ever runs — safe to interpolate as a SQL
    // identifier via `Prisma.raw`, never user-controlled beyond that set.
    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        date_trunc(${granularity}, "saleDate") AS bucket,
        SUM("totalAmount")::text AS amount
      FROM "Sale"
      WHERE "farmId" = ${farmId}
        AND status != ${SaleStatus.DRAFT}::"SaleStatus"
        AND "saleDate" >= ${from}
        AND "saleDate" < ${to}
      GROUP BY bucket
    `);

    const byBucket = new Map(
      rows.map((r) => [r.bucket.toISOString(), toStorage(r.amount ?? 0)]),
    );

    const buckets: { bucket: string; amount: string }[] = [];
    let cursor = truncToGranularity(from, granularity);
    while (cursor < to) {
      const key = cursor.toISOString();
      const amount = byBucket.get(key) ?? toStorage(0);
      buckets.push({ bucket: key, amount: amount.toString() });
      cursor = nextBucket(cursor, granularity);
    }
    return buckets;
  }

  private async queryByProduct(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<{ lineType: SaleLineType; amount: string; sharePct: number }[]> {
    const groups = await this.prisma.saleLine.groupBy({
      by: ['type'],
      where: {
        sale: {
          farmId,
          status: { not: SaleStatus.DRAFT },
          saleDate: { gte: from, lt: to },
        },
      },
      _sum: { totalAmount: true },
    });

    const total = groups.reduce(
      (sum, g) => sum + Number(g._sum.totalAmount ?? 0),
      0,
    );

    return groups.map((g) => {
      const amount = Number(g._sum.totalAmount ?? 0);
      return {
        lineType: g.type,
        amount: toStorage(amount).toString(),
        sharePct: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      };
    });
  }

  private async queryTopBuyers(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<
    { customerId: string; name: string; amount: string; invoiceCount: number }[]
  > {
    const groups = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        farmId,
        status: { not: SaleStatus.DRAFT },
        saleDate: { gte: from, lt: to },
        customerId: { not: null },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });
    if (groups.length === 0) return [];

    const customerIds = groups
      .map((g) => g.customerId)
      .filter((id): id is string => id != null);
    const buyers = await this.prisma.milkBuyer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(buyers.map((b) => [b.id, b.name]));

    return groups.map((g) => ({
      customerId: g.customerId as string,
      name: nameById.get(g.customerId as string) ?? 'Unknown',
      amount: toStorage(g._sum.totalAmount ?? 0).toString(),
      invoiceCount: g._count._all,
    }));
  }
}

function truncToGranularity(
  d: Date,
  granularity: SalesSummaryGranularity,
): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (granularity === 'month') {
    return new Date(Date.UTC(y, m, 1));
  }
  if (granularity === 'week') {
    const truncDay = new Date(Date.UTC(y, m, day));
    const dow = truncDay.getUTCDay(); // 0=Sun..6=Sat
    const offset = (dow + 6) % 7; // days since Monday
    truncDay.setUTCDate(truncDay.getUTCDate() - offset);
    return truncDay;
  }
  return new Date(Date.UTC(y, m, day));
}

function nextBucket(d: Date, granularity: SalesSummaryGranularity): Date {
  const next = new Date(d);
  if (granularity === 'month') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else if (granularity === 'week') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}
