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
exports.PeriodSummaryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const txn_filters_1 = require("src/common/finance/txn-filters");
const period_1 = require("src/common/finance/period");
const balance_service_1 = require("src/modules/finance-v2/accounts/application/balance.service");
const aging_service_1 = require("./aging.service");
let PeriodSummaryService = class PeriodSummaryService {
    prisma;
    balance;
    aging;
    constructor(prisma, balance, aging) {
        this.prisma = prisma;
        this.balance = balance;
        this.aging = aging;
    }
    async getSummary(farmId, from, to) {
        const previous = (0, period_1.derivePreviousPeriod)({ from, to });
        const [revenueCurrent, revenuePrevious, expensesCurrent, expensesPrevious, cashFlowCurrent, cashFlowPrevious, rakhalBalance, receivablesAging, payablesAging,] = await Promise.all([
            (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, client_1.LedgerAccountCategory.REVENUE, {
                gte: from,
                lt: to,
            }),
            (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, client_1.LedgerAccountCategory.REVENUE, {
                gte: previous.from,
                lt: previous.to,
            }),
            (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, client_1.LedgerAccountCategory.EXPENSE, {
                gte: from,
                lt: to,
            }),
            (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, client_1.LedgerAccountCategory.EXPENSE, {
                gte: previous.from,
                lt: previous.to,
            }),
            this.cashFlowNet(farmId, from, to),
            this.cashFlowNet(farmId, previous.from, previous.to),
            this.balance.getRakhalBalance(farmId),
            this.aging.getReceivablesAging(farmId, new Date()),
            this.aging.getPayablesAging(farmId, new Date()),
        ]);
        const profitCurrent = revenueCurrent - expensesCurrent;
        const profitPrevious = revenuePrevious - expensesPrevious;
        return {
            period: { from: from.toISOString(), to: to.toISOString() },
            previousPeriod: {
                from: previous.from.toISOString(),
                to: previous.to.toISOString(),
            },
            revenue: {
                current: revenueCurrent,
                previous: revenuePrevious,
                changePct: (0, period_1.changePct)(revenueCurrent, revenuePrevious),
            },
            expenses: {
                current: expensesCurrent,
                previous: expensesPrevious,
                changePct: (0, period_1.changePct)(expensesCurrent, expensesPrevious),
            },
            netProfit: {
                current: profitCurrent,
                previous: profitPrevious,
                changePct: (0, period_1.changePct)(profitCurrent, profitPrevious),
            },
            netCashFlow: {
                current: cashFlowCurrent,
                previous: cashFlowPrevious,
                changePct: (0, period_1.changePct)(cashFlowCurrent, cashFlowPrevious),
            },
            position: {
                availableBalance: rakhalBalance.rakhalBalance.toString(),
                totalReceivable: receivablesAging.totalOutstanding,
                receivableCount: receivablesAging.totalCount,
                totalPayable: payablesAging.totalOutstanding,
                payableCount: payablesAging.totalCount,
                accountCount: rakhalBalance.accounts.length,
            },
        };
    }
    async cashFlowNet(farmId, from, to) {
        const accounts = await this.prisma.financialAccount.findMany({
            where: { farmId },
            select: { ledgerAccountId: true },
        });
        if (accounts.length === 0)
            return 0;
        const agg = await this.prisma.journalEntry.aggregate({
            where: {
                ledgerAccountId: { in: accounts.map((a) => a.ledgerAccountId) },
                journalTransaction: { transactionDate: { gte: from, lt: to } },
            },
            _sum: { debit: true, credit: true },
        });
        return Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
    }
};
exports.PeriodSummaryService = PeriodSummaryService;
exports.PeriodSummaryService = PeriodSummaryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        balance_service_1.BalanceService,
        aging_service_1.AgingService])
], PeriodSummaryService);
//# sourceMappingURL=period-summary.service.js.map