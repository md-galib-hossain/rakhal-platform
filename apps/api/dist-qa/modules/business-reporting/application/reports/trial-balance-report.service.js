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
exports.TrialBalanceReportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
let TrialBalanceReportService = class TrialBalanceReportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getReport(farmId, asOf) {
        const accounts = await this.prisma.ledgerAccount.findMany({
            where: { farmId },
            select: { id: true, code: true, name: true, category: true },
            orderBy: { code: 'asc' },
        });
        if (accounts.length === 0) {
            return {
                asOf: asOf.toISOString(),
                lines: [],
                totalDebit: '0.00',
                totalCredit: '0.00',
                balanced: true,
            };
        }
        const grouped = await this.prisma.journalEntry.groupBy({
            by: ['ledgerAccountId'],
            where: {
                ledgerAccountId: { in: accounts.map((a) => a.id) },
                journalTransaction: { transactionDate: { lte: asOf } },
            },
            _sum: { debit: true, credit: true },
        });
        const sumsById = new Map(grouped.map((g) => [g.ledgerAccountId, g._sum]));
        let totalDebit = (0, money_1.toStorage)(0);
        let totalCredit = (0, money_1.toStorage)(0);
        const lines = [];
        for (const account of accounts) {
            const s = sumsById.get(account.id);
            const debit = Number(s?.debit ?? 0);
            const credit = Number(s?.credit ?? 0);
            const net = debit - credit;
            if (net === 0)
                continue;
            const debitColumn = (0, money_1.toStorage)(Math.max(net, 0));
            const creditColumn = (0, money_1.toStorage)(Math.max(-net, 0));
            totalDebit = (0, money_1.add)(totalDebit, debitColumn);
            totalCredit = (0, money_1.add)(totalCredit, creditColumn);
            lines.push({
                code: account.code,
                name: account.name,
                category: account.category,
                debit: debitColumn.toString(),
                credit: creditColumn.toString(),
            });
        }
        return {
            asOf: asOf.toISOString(),
            lines,
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            balanced: (0, money_1.isZero)(totalDebit.minus(totalCredit)),
        };
    }
};
exports.TrialBalanceReportService = TrialBalanceReportService;
exports.TrialBalanceReportService = TrialBalanceReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TrialBalanceReportService);
//# sourceMappingURL=trial-balance-report.service.js.map