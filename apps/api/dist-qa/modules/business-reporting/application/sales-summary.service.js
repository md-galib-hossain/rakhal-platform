"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesSummaryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
const period_1 = require("src/common/finance/period");
let SalesSummaryService = class SalesSummaryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(farmId, from, to, granularity) {
        const previous = (0, period_1.derivePreviousPeriod)({ from, to });
        const [current, prior, trend, byProduct, topBuyers] = await Promise.all([
            this.queryKpis(farmId, from, to),
            this.queryKpis(farmId, previous.from, previous.to),
            this.queryTrend(farmId, from, to, granularity),
            this.queryByProduct(farmId, from, to),
            this.queryTopBuyers(farmId, from, to),
        ]);
        const metric = (curr, prev) => ({
            current: curr,
            previous: prev,
            changePct: (0, period_1.changePct)(curr, prev),
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
    async queryKpis(farmId, from, to) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH period_sales AS (
        SELECT s.id, s."totalAmount", r.id AS receivable_id
        FROM "Sale" s
        LEFT JOIN "Receivable" r ON r."saleId" = s.id
        WHERE s."farmId" = ${farmId}
          AND s.status != ${client_1.SaleStatus.DRAFT}::"SaleStatus"
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
        const totalSales = (0, money_1.toStorage)(row?.totalSales ?? 0);
        const paidAmount = (0, money_1.toStorage)(row?.paidAmount ?? 0);
        const outstanding = (0, money_1.clampNonNegative)((0, money_1.subtract)(totalSales, paidAmount));
        return {
            totalSales: (0, money_1.toMoney)(totalSales).toNumber(),
            totalInvoices: row ? Number(row.totalInvoices) : 0,
            paidAmount: (0, money_1.toMoney)(paidAmount).toNumber(),
            outstanding: (0, money_1.toMoney)(outstanding).toNumber(),
        };
    }
    async queryTrend(farmId, from, to, granularity) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        date_trunc(${granularity}, "saleDate") AS bucket,
        SUM("totalAmount")::text AS amount
      FROM "Sale"
      WHERE "farmId" = ${farmId}
        AND status != ${client_1.SaleStatus.DRAFT}::"SaleStatus"
        AND "saleDate" >= ${from}
        AND "saleDate" < ${to}
      GROUP BY bucket
    `);
        const byBucket = new Map(rows.map((r) => [r.bucket.toISOString(), (0, money_1.toStorage)(r.amount ?? 0)]));
        const buckets = [];
        let cursor = truncToGranularity(from, granularity);
        while (cursor < to) {
            const key = cursor.toISOString();
            const amount = byBucket.get(key) ?? (0, money_1.toStorage)(0);
            buckets.push({ bucket: key, amount: amount.toString() });
            cursor = nextBucket(cursor, granularity);
        }
        return buckets;
    }
    async queryByProduct(farmId, from, to) {
        const groups = await this.prisma.saleLine.groupBy({
            by: ['type'],
            where: {
                sale: {
                    farmId,
                    status: { not: client_1.SaleStatus.DRAFT },
                    saleDate: { gte: from, lt: to },
                },
            },
            _sum: { totalAmount: true },
        });
        const total = groups.reduce((sum, g) => sum + Number(g._sum.totalAmount ?? 0), 0);
        return groups.map((g) => {
            const amount = Number(g._sum.totalAmount ?? 0);
            return {
                lineType: g.type,
                amount: (0, money_1.toStorage)(amount).toString(),
                sharePct: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
            };
        });
    }
    async queryTopBuyers(farmId, from, to) {
        const groups = await this.prisma.sale.groupBy({
            by: ['customerId'],
            where: {
                farmId,
                status: { not: client_1.SaleStatus.DRAFT },
                saleDate: { gte: from, lt: to },
                customerId: { not: null },
            },
            _sum: { totalAmount: true },
            _count: { _all: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 5,
        });
        if (groups.length === 0)
            return [];
        const customerIds = groups
            .map((g) => g.customerId)
            .filter((id) => id != null);
        const buyers = await this.prisma.milkBuyer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
        });
        const nameById = new Map(buyers.map((b) => [b.id, b.name]));
        return groups.map((g) => ({
            customerId: g.customerId,
            name: nameById.get(g.customerId) ?? 'Unknown',
            amount: (0, money_1.toStorage)(g._sum.totalAmount ?? 0).toString(),
            invoiceCount: g._count._all,
        }));
    }
};
exports.SalesSummaryService = SalesSummaryService;
exports.SalesSummaryService = SalesSummaryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesSummaryService);
function truncToGranularity(d, granularity) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    if (granularity === 'month') {
        return new Date(Date.UTC(y, m, 1));
    }
    if (granularity === 'week') {
        const truncDay = new Date(Date.UTC(y, m, day));
        const dow = truncDay.getUTCDay();
        const offset = (dow + 6) % 7;
        truncDay.setUTCDate(truncDay.getUTCDate() - offset);
        return truncDay;
    }
    return new Date(Date.UTC(y, m, day));
}
function nextBucket(d, granularity) {
    const next = new Date(d);
    if (granularity === 'month') {
        next.setUTCMonth(next.getUTCMonth() + 1);
    }
    else if (granularity === 'week') {
        next.setUTCDate(next.getUTCDate() + 7);
    }
    else {
        next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
}
//# sourceMappingURL=sales-summary.service.js.map