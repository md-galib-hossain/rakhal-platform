import { Injectable } from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  toStorage,
  toMoney,
  subtract,
  clampNonNegative,
} from 'src/common/money';
import { changePct, derivePreviousPeriod } from 'src/common/finance/period';

interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface PurchasingSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  kpis: {
    totalPurchases: PeriodMetric;
    paidAmount: PeriodMetric;
    payable: PeriodMetric;
    purchaseOrders: PeriodMetric;
  };
}

interface KpiRow {
  purchaseOrders: bigint;
  totalPurchases: string | null;
  paidAmount: string | null;
}

/**
 * `GET /purchasing/summary?from&to` (RAKHAL-375, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.13). Same shape as `SalesSummaryService`'s own
 * `kpis` block (RAKHAL-374) — Total Purchases / Paid Amount / Payable /
 * Purchase Orders, each with `previous`/`changePct` via the shared
 * `derivePreviousPeriod`/`changePct` pair (`common/finance/period.ts`,
 * RAKHAL-371's one implementation).
 *
 * One raw-SQL allocation-sum CTE (same pattern `AgingService`/
 * `SalesSummaryService` use): a `Purchase` with no `Payable` was paid in
 * full at creation (mirrors `purchase.service.ts`'s own
 * `buildPurchasePaymentStatusWhere`'s `PAID` case), otherwise `paidAmount`
 * is the real `SUM(PaymentAllocation.amount)` across that purchase's
 * payable. `payable` (outstanding) is `totalPurchases - paidAmount`, never
 * a second query. `VOIDED` purchases are excluded — same default
 * `PurchaseController`'s create flow assumes a `Purchase` stays `CONFIRMED`
 * unless explicitly voided (RAKHAL-367/377).
 */
@Injectable()
export class PurchasingSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<PurchasingSummary> {
    const previous = derivePreviousPeriod({ from, to });

    const [current, prior] = await Promise.all([
      this.queryKpis(farmId, from, to),
      this.queryKpis(farmId, previous.from, previous.to),
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
        totalPurchases: metric(current.totalPurchases, prior.totalPurchases),
        paidAmount: metric(current.paidAmount, prior.paidAmount),
        payable: metric(current.payable, prior.payable),
        purchaseOrders: metric(current.purchaseOrders, prior.purchaseOrders),
      },
    };
  }

  private async queryKpis(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalPurchases: number;
    paidAmount: number;
    payable: number;
    purchaseOrders: number;
  }> {
    const rows = await this.prisma.$queryRaw<KpiRow[]>(Prisma.sql`
      WITH period_purchases AS (
        SELECT p.id, p."totalAmount", pay.id AS payable_id
        FROM "Purchase" p
        LEFT JOIN "Payable" pay ON pay."purchaseId" = p.id
        WHERE p."farmId" = ${farmId}
          AND p.status != ${PurchaseStatus.VOIDED}::"PurchaseStatus"
          AND p."purchaseDate" >= ${from}
          AND p."purchaseDate" < ${to}
      ),
      alloc AS (
        SELECT pp.id AS purchase_id, COALESCE(SUM(pa.amount), 0) AS allocated
        FROM period_purchases pp
        LEFT JOIN "PaymentAllocation" pa ON pa."payableId" = pp.payable_id
        GROUP BY pp.id
      )
      SELECT
        COUNT(*)::int AS "purchaseOrders",
        COALESCE(SUM(pp."totalAmount"), 0)::text AS "totalPurchases",
        COALESCE(
          SUM(
            CASE WHEN pp.payable_id IS NULL THEN pp."totalAmount"
            ELSE alloc.allocated END
          ), 0
        )::text AS "paidAmount"
      FROM period_purchases pp
      JOIN alloc ON alloc.purchase_id = pp.id
    `);

    const row = rows[0];
    const totalPurchases = toStorage(row?.totalPurchases ?? 0);
    const paidAmount = toStorage(row?.paidAmount ?? 0);
    const payable = clampNonNegative(subtract(totalPurchases, paidAmount));

    return {
      totalPurchases: toMoney(totalPurchases).toNumber(),
      paidAmount: toMoney(paidAmount).toNumber(),
      payable: toMoney(payable).toNumber(),
      purchaseOrders: row ? Number(row.purchaseOrders) : 0,
    };
  }
}
