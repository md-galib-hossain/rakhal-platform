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
exports.CashFlowReportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
let CashFlowReportService = class CashFlowReportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getReport(farmId, from, to) {
        const accounts = await this.prisma.financialAccount.findMany({
            where: { farmId, deletedAt: null },
            select: { id: true, name: true, type: true, ledgerAccountId: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const lines = await Promise.all(accounts.map(async (a) => {
            const opening = await this.balanceBefore(a.ledgerAccountId, from);
            const { inflow, outflow } = await this.movement(a.ledgerAccountId, from, to);
            const closing = (0, money_1.add)(opening, (0, money_1.subtract)(inflow, outflow));
            return {
                id: a.id,
                name: a.name,
                type: a.type,
                openingBalance: opening.toString(),
                inflow: inflow.toString(),
                outflow: outflow.toString(),
                closingBalance: closing.toString(),
            };
        }));
        const totals = lines.reduce((acc, l) => ({
            openingBalance: (0, money_1.add)(acc.openingBalance, l.openingBalance),
            inflow: (0, money_1.add)(acc.inflow, l.inflow),
            outflow: (0, money_1.add)(acc.outflow, l.outflow),
            closingBalance: (0, money_1.add)(acc.closingBalance, l.closingBalance),
        }), {
            openingBalance: (0, money_1.toStorage)(0),
            inflow: (0, money_1.toStorage)(0),
            outflow: (0, money_1.toStorage)(0),
            closingBalance: (0, money_1.toStorage)(0),
        });
        return {
            period: { from: from.toISOString(), to: to.toISOString() },
            accounts: lines,
            totals: {
                openingBalance: totals.openingBalance.toString(),
                inflow: totals.inflow.toString(),
                outflow: totals.outflow.toString(),
                closingBalance: totals.closingBalance.toString(),
            },
        };
    }
    async balanceBefore(ledgerAccountId, at) {
        const agg = await this.prisma.journalEntry.aggregate({
            where: {
                ledgerAccountId,
                journalTransaction: { transactionDate: { lt: at } },
            },
            _sum: { debit: true, credit: true },
        });
        return (0, money_1.subtract)(agg._sum.debit ?? 0, agg._sum.credit ?? 0);
    }
    async movement(ledgerAccountId, from, to) {
        const agg = await this.prisma.journalEntry.aggregate({
            where: {
                ledgerAccountId,
                journalTransaction: { transactionDate: { gte: from, lt: to } },
            },
            _sum: { debit: true, credit: true },
        });
        return {
            inflow: (0, money_1.toStorage)(agg._sum.debit ?? 0),
            outflow: (0, money_1.toStorage)(agg._sum.credit ?? 0),
        };
    }
};
exports.CashFlowReportService = CashFlowReportService;
exports.CashFlowReportService = CashFlowReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CashFlowReportService);
//# sourceMappingURL=cash-flow-report.service.js.map