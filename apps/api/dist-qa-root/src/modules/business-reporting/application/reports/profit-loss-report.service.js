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
exports.ProfitLossReportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
const CREDIT_NORMAL = new Set([
    client_1.LedgerAccountCategory.REVENUE,
]);
let ProfitLossReportService = class ProfitLossReportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getReport(farmId, from, to) {
        const [revenue, expenses] = await Promise.all([
            this.categoryLines(farmId, client_1.LedgerAccountCategory.REVENUE, from, to),
            this.categoryLines(farmId, client_1.LedgerAccountCategory.EXPENSE, from, to),
        ]);
        const revenueTotal = revenue.reduce((sum, l) => (0, money_1.add)(sum, l.amount), (0, money_1.toStorage)(0));
        const expensesTotal = expenses.reduce((sum, l) => (0, money_1.add)(sum, l.amount), (0, money_1.toStorage)(0));
        return {
            period: { from: from.toISOString(), to: to.toISOString() },
            revenue: {
                lines: revenue.map((l) => ({ ...l, amount: l.amount.toString() })),
                total: revenueTotal.toString(),
            },
            expenses: {
                lines: expenses.map((l) => ({ ...l, amount: l.amount.toString() })),
                total: expensesTotal.toString(),
            },
            netProfit: revenueTotal.minus(expensesTotal).toString(),
        };
    }
    async categoryLines(farmId, category, from, to) {
        const accounts = await this.prisma.ledgerAccount.findMany({
            where: { farmId, category },
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
        });
        if (accounts.length === 0)
            return [];
        const grouped = await this.prisma.journalEntry.groupBy({
            by: ['ledgerAccountId'],
            where: {
                ledgerAccountId: { in: accounts.map((a) => a.id) },
                journalTransaction: { transactionDate: { gte: from, lt: to } },
            },
            _sum: { debit: true, credit: true },
        });
        const sumsById = new Map(grouped.map((g) => [g.ledgerAccountId, g._sum]));
        const isCreditNormal = CREDIT_NORMAL.has(category);
        return accounts
            .map((a) => {
            const s = sumsById.get(a.id);
            const debit = Number(s?.debit ?? 0);
            const credit = Number(s?.credit ?? 0);
            const net = isCreditNormal ? credit - debit : debit - credit;
            return { code: a.code, name: a.name, amount: (0, money_1.toStorage)(net) };
        })
            .filter((l) => !(0, money_1.isZero)(l.amount));
    }
};
exports.ProfitLossReportService = ProfitLossReportService;
exports.ProfitLossReportService = ProfitLossReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProfitLossReportService);
//# sourceMappingURL=profit-loss-report.service.js.map