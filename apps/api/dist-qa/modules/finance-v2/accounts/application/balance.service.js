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
var BalanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
let BalanceService = BalanceService_1 = class BalanceService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(BalanceService_1.name);
    }
    async getAccountBalance(farmId, financialAccountId) {
        const account = await this.prisma.financialAccount.findFirst({
            where: { id: financialAccountId, farmId },
            select: { id: true, name: true, type: true, ledgerAccountId: true },
        });
        if (!account) {
            throw new common_1.NotFoundException('Financial account not found');
        }
        const balance = await this.sumLedgerAccount(account.ledgerAccountId);
        return { id: account.id, name: account.name, type: account.type, balance };
    }
    async getFarmBalances(farmId, includeArchived = false) {
        const rows = await this.prisma.financialAccount.findMany({
            where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
            select: { id: true, name: true, type: true, ledgerAccountId: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const accounts = [];
        const byType = {
            [client_1.FinancialAccountType.CASH]: (0, money_1.zero)(),
            [client_1.FinancialAccountType.BANK]: (0, money_1.zero)(),
            [client_1.FinancialAccountType.MFS]: (0, money_1.zero)(),
        };
        for (const row of rows) {
            const balance = await this.sumLedgerAccount(row.ledgerAccountId);
            accounts.push({
                id: row.id,
                name: row.name,
                type: row.type,
                balance,
            });
            byType[row.type] = (0, money_1.add)(byType[row.type], balance);
        }
        return { accounts, byType };
    }
    async getRakhalBalance(farmId) {
        const { accounts, byType } = await this.getFarmBalances(farmId, false);
        const rakhalBalance = (0, money_1.sum)([
            byType[client_1.FinancialAccountType.CASH],
            byType[client_1.FinancialAccountType.BANK],
            byType[client_1.FinancialAccountType.MFS],
        ]);
        this.log.info('Rakhal Balance computed', {
            farmId,
            rakhalBalance: rakhalBalance.toString(),
            accountCount: accounts.length,
        });
        return {
            rakhalBalance,
            breakdown: {
                cash: byType[client_1.FinancialAccountType.CASH],
                bank: byType[client_1.FinancialAccountType.BANK],
                mfs: byType[client_1.FinancialAccountType.MFS],
            },
            accounts,
        };
    }
    async sumLedgerAccount(ledgerAccountId) {
        const agg = await this.prisma.journalEntry.aggregate({
            where: { ledgerAccountId },
            _sum: { debit: true, credit: true },
        });
        return (0, money_1.subtract)(agg._sum.debit ?? 0, agg._sum.credit ?? 0);
    }
};
exports.BalanceService = BalanceService;
exports.BalanceService = BalanceService = BalanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], BalanceService);
//# sourceMappingURL=balance.service.js.map