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
exports.PurchasingSummaryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
const period_1 = require("src/common/finance/period");
let PurchasingSummaryService = class PurchasingSummaryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(farmId, from, to) {
        const previous = (0, period_1.derivePreviousPeriod)({ from, to });
        const [current, prior] = await Promise.all([
            this.queryKpis(farmId, from, to),
            this.queryKpis(farmId, previous.from, previous.to),
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
                totalPurchases: metric(current.totalPurchases, prior.totalPurchases),
                paidAmount: metric(current.paidAmount, prior.paidAmount),
                payable: metric(current.payable, prior.payable),
                purchaseOrders: metric(current.purchaseOrders, prior.purchaseOrders),
            },
        };
    }
    async queryKpis(farmId, from, to) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH period_purchases AS (
        SELECT p.id, p."totalAmount", pay.id AS payable_id,
               pay."totalAmount" AS payable_total
        FROM "Purchase" p
        LEFT JOIN "Payable" pay ON pay."purchaseId" = p.id
        WHERE p."farmId" = ${farmId}
          AND p.status != ${client_1.PurchaseStatus.VOIDED}::"PurchaseStatus"
          AND p."purchaseDate" >= ${from}
          AND p."purchaseDate" < ${to}
      ),
      alloc AS (
        SELECT pp.id AS purchase_id, COALESCE(SUM(pa.amount), 0) AS allocated
        FROM period_purchases pp
        LEFT JOIN "PaymentAllocation" pa ON pa."payableId" = pp.payable_id
        GROUP BY pp.id
      )
      -- A Payable holds only the UNPAID REMAINDER at creation (its totalAmount =
      -- purchase total - paid up front), so money paid so far is
      --   (total - payable.totalAmount)  paid at creation
      -- + allocations                    paid since.
      -- No Payable at all = paid in full at creation.
      SELECT
        COUNT(*)::int AS "purchaseOrders",
        COALESCE(SUM(pp."totalAmount"), 0)::text AS "totalPurchases",
        COALESCE(
          SUM(
            CASE WHEN pp.payable_id IS NULL THEN pp."totalAmount"
            ELSE pp."totalAmount" - pp.payable_total + alloc.allocated END
          ), 0
        )::text AS "paidAmount"
      FROM period_purchases pp
      JOIN alloc ON alloc.purchase_id = pp.id
    `);
        const row = rows[0];
        const totalPurchases = (0, money_1.toStorage)(row?.totalPurchases ?? 0);
        const paidAmount = (0, money_1.toStorage)(row?.paidAmount ?? 0);
        const payable = (0, money_1.clampNonNegative)((0, money_1.subtract)(totalPurchases, paidAmount));
        return {
            totalPurchases: (0, money_1.toMoney)(totalPurchases).toNumber(),
            paidAmount: (0, money_1.toMoney)(paidAmount).toNumber(),
            payable: (0, money_1.toMoney)(payable).toNumber(),
            purchaseOrders: row ? Number(row.purchaseOrders) : 0,
        };
    }
};
exports.PurchasingSummaryService = PurchasingSummaryService;
exports.PurchasingSummaryService = PurchasingSummaryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchasingSummaryService);
//# sourceMappingURL=purchasing-summary.service.js.map