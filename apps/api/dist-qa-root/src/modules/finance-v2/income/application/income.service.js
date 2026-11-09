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
var IncomeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncomeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const financial_account_service_1 = require("src/modules/finance-v2/accounts/application/financial-account.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const OTHER_INCOME_LEDGER_CODE = '4900';
let IncomeService = IncomeService_1 = class IncomeService {
    prisma;
    financialAccountService;
    ledgerAccountService;
    journalService;
    activityLog;
    log;
    constructor(prisma, financialAccountService, ledgerAccountService, journalService, activityLog, logger) {
        this.prisma = prisma;
        this.financialAccountService = financialAccountService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.activityLog = activityLog;
        this.log = logger.setContext(IncomeService_1.name);
    }
    async listCategories(farmId) {
        return this.prisma.incomeCategory.findMany({
            where: { OR: [{ farmId: null }, { farmId }] },
            orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        });
    }
    async createCategory(farmId, dto) {
        const category = await this.prisma.incomeCategory.create({
            data: {
                name: dto.name,
                isSystem: false,
                farmId,
            },
        });
        this.log.info('Income category created', {
            farmId,
            incomeCategoryId: category.id,
        });
        return category;
    }
    async recordOtherIncome(farmId, userId, dto, tx) {
        const run = (client) => this.recordWithClient(client, farmId, userId, dto);
        const otherIncome = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Other Income Recorded',
            actionDetails: `${dto.description} — ৳${otherIncome.amount.toString()}.`,
            actorId: userId,
            financialImpact: Number(otherIncome.amount),
        });
        return otherIncome;
    }
    async recordWithClient(client, farmId, userId, dto) {
        const category = await client.incomeCategory.findFirst({
            where: {
                id: dto.categoryId,
                OR: [{ farmId: null }, { farmId }],
            },
        });
        if (!category) {
            throw new common_1.NotFoundException('Income category not found');
        }
        const financialAccountId = await this.financialAccountService.resolveFarmAccountId(farmId, userId, dto.financialAccountId, client);
        await this.financialAccountService.assertAccountActive(farmId, financialAccountId);
        const account = await client.financialAccount.findFirst({
            where: { id: financialAccountId, farmId },
            select: { id: true, ledgerAccountId: true },
        });
        if (!account) {
            throw new common_1.NotFoundException('Financial account not found');
        }
        const amount = (0, money_1.toStorage)(dto.amount);
        if (!(0, money_1.gt)(amount, 0)) {
            throw new common_1.BadRequestException('Amount must be greater than zero');
        }
        const otherIncomeLedgerAccount = await this.ledgerAccountService.findByCode(farmId, OTHER_INCOME_LEDGER_CODE);
        if (!otherIncomeLedgerAccount) {
            throw new common_1.BadRequestException('Other Income ledger account is not seeded for this farm');
        }
        const otherIncome = await client.otherIncome.create({
            data: {
                farmId,
                categoryId: category.id,
                description: dto.description,
                amount,
                date: new Date(dto.date),
                financialAccountId: account.id,
                createdById: userId,
            },
        });
        await this.journalService.postJournal({
            farmId,
            sourceType: 'OTHER_INCOME',
            sourceId: otherIncome.id,
            transactionDate: otherIncome.date,
            description: `Other income: ${category.name}`,
            idempotencyKey: `other-income:${otherIncome.id}`,
            createdById: userId,
            entries: [
                { ledgerAccountId: account.ledgerAccountId, debit: amount },
                { ledgerAccountId: otherIncomeLedgerAccount.id, credit: amount },
            ],
        }, client);
        this.log.info('Other income recorded', {
            farmId,
            otherIncomeId: otherIncome.id,
            categoryId: category.id,
            financialAccountId: account.id,
            amount: amount.toString(),
        });
        return otherIncome;
    }
    async findOne(farmId, id) {
        const otherIncome = await this.prisma.otherIncome.findFirst({
            where: { id, farmId },
        });
        if (!otherIncome) {
            throw new common_1.NotFoundException('Other income not found');
        }
        return otherIncome;
    }
    async findAll(farmId) {
        return this.prisma.otherIncome.findMany({
            where: { farmId },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
        });
    }
};
exports.IncomeService = IncomeService;
exports.IncomeService = IncomeService = IncomeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        financial_account_service_1.FinancialAccountService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], IncomeService);
//# sourceMappingURL=income.service.js.map