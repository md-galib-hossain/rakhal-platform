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
var ExpenseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const financial_account_service_1 = require("src/modules/finance-v2/accounts/application/financial-account.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const assert_supplier_in_farm_1 = require("../domain/assert-supplier-in-farm");
const due_date_1 = require("../domain/due-date");
const payable_status_1 = require("../domain/payable-status");
const payable_service_1 = require("./payable.service");
function buildExpensePaymentStatusWhere(status) {
    const now = new Date();
    const notOverdue = {
        OR: [
            { payable: { dueDate: null } },
            { payable: { dueDate: { gte: now } } },
        ],
    };
    switch (status) {
        case payable_status_1.PayableStatus.PAID:
            return {
                OR: [{ payable: null }, { payable: { closedAt: { not: null } } }],
            };
        case payable_status_1.PayableStatus.UNPAID:
            return {
                AND: [
                    { payable: { isNot: null } },
                    { payable: { closedAt: null } },
                    { payable: { allocations: { none: {} } } },
                    notOverdue,
                ],
            };
        case payable_status_1.PayableStatus.PARTIALLY_PAID:
            return {
                AND: [
                    { payable: { isNot: null } },
                    { payable: { closedAt: null } },
                    { payable: { allocations: { some: {} } } },
                    notOverdue,
                ],
            };
        case payable_status_1.PayableStatus.OVERDUE:
            return {
                AND: [
                    { payable: { isNot: null } },
                    { payable: { closedAt: null } },
                    { payable: { dueDate: { lt: now } } },
                ],
            };
    }
}
const ACCOUNTS_PAYABLE_CODE = '2000';
const INVENTORY_CODE = '1200';
const EXPENSE_CATEGORY_LEDGER_CODE = {
    [client_1.ExpenseCategory.SALARY]: '5200',
    [client_1.ExpenseCategory.UTILITIES]: '5400',
    [client_1.ExpenseCategory.BREEDING]: '5300',
    [client_1.ExpenseCategory.TRANSFER_FEE]: '5500',
    [client_1.ExpenseCategory.DEPRECIATION]: '5600',
    [client_1.ExpenseCategory.OTHER]: '5900',
    [client_1.ExpenseCategory.HEALTH]: '5100',
};
let ExpenseService = ExpenseService_1 = class ExpenseService {
    prisma;
    journalService;
    ledgerAccountService;
    financialAccountService;
    payableService;
    activityLog;
    log;
    constructor(prisma, journalService, ledgerAccountService, financialAccountService, payableService, activityLog, logger) {
        this.prisma = prisma;
        this.journalService = journalService;
        this.ledgerAccountService = ledgerAccountService;
        this.financialAccountService = financialAccountService;
        this.payableService = payableService;
        this.activityLog = activityLog;
        this.log = logger.setContext(ExpenseService_1.name);
    }
    resolveAccountId(farmId, userId, provided) {
        return this.financialAccountService.resolveFarmAccountId(farmId, userId, provided);
    }
    async recordExpense(farmId, userId, dto) {
        const expense = await this.prisma.$transaction((tx) => this.recordWithClient(tx, farmId, userId, dto));
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle: 'Expense Recorded',
                actionDetails: `${dto.category} expense: ${dto.description} — ৳${expense.amount.toString()}${dto.financialAccountId ? ' (paid immediately)' : ' (unpaid, payable raised)'}.`,
                actorId: userId,
                financialImpact: -Number(expense.amount),
            });
        }
        catch (error) {
            this.log.error('Expense activity log failed', {
                farmId,
                expenseId: expense.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return expense;
    }
    async recordWithClient(client, farmId, userId, dto) {
        const amount = (0, money_1.toStorage)(dto.amount);
        if (dto.supplierId) {
            await (0, assert_supplier_in_farm_1.assertSupplierBelongsToFarm)(client, farmId, dto.supplierId);
        }
        let financialAccountLedgerAccountId = null;
        if (dto.financialAccountId) {
            await this.financialAccountService.assertAccountActive(farmId, dto.financialAccountId);
            const account = await client.financialAccount.findFirst({
                where: { id: dto.financialAccountId, farmId },
                select: { id: true, ledgerAccountId: true },
            });
            if (!account) {
                throw new common_1.NotFoundException('Financial account not found');
            }
            financialAccountLedgerAccountId = account.ledgerAccountId;
        }
        const expense = await client.expense.create({
            data: {
                farmId,
                category: dto.category,
                description: dto.description,
                amount,
                expenseDate: new Date(dto.expenseDate),
                financialAccountId: dto.financialAccountId ?? null,
                supplierId: dto.supplierId ?? null,
                notes: dto.notes ?? null,
                cattleId: dto.cattleId ?? null,
                createdById: userId,
            },
        });
        const expenseAccountCode = EXPENSE_CATEGORY_LEDGER_CODE[dto.category];
        const expenseAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, expenseAccountCode, client);
        if (!expenseAccount) {
            throw new common_1.BadRequestException(`Expense ledger account (${expenseAccountCode}) is not seeded for this farm`);
        }
        const entries = [
            { ledgerAccountId: expenseAccount.id, debit: amount },
        ];
        if (financialAccountLedgerAccountId) {
            entries.push({
                ledgerAccountId: financialAccountLedgerAccountId,
                credit: amount,
            });
        }
        else {
            const payableAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, ACCOUNTS_PAYABLE_CODE, client);
            if (!payableAccount) {
                throw new common_1.BadRequestException('Accounts Payable ledger account is not seeded for this farm');
            }
            entries.push({ ledgerAccountId: payableAccount.id, credit: amount });
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'EXPENSE',
            sourceId: expense.id,
            transactionDate: expense.expenseDate,
            description: `Expense: ${dto.description}`,
            idempotencyKey: `expense:${expense.id}`,
            createdById: userId,
            entries,
        }, client);
        if (!financialAccountLedgerAccountId) {
            const dueDate = dto.dueDate
                ? new Date(dto.dueDate)
                : await this.deriveDueDate(client, dto.supplierId, expense.expenseDate);
            await this.payableService.createPayable(farmId, {
                expenseId: expense.id,
                supplierId: dto.supplierId ?? null,
                totalAmount: amount,
                dueDate,
            }, client);
        }
        this.log.info('Expense recorded', {
            farmId,
            expenseId: expense.id,
            category: dto.category,
            amount: amount.toString(),
            paidImmediately: !!financialAccountLedgerAccountId,
        });
        return expense;
    }
    async recordInventoryConsumption(farmId, userId, dto) {
        const expense = await this.prisma.$transaction((tx) => this.recordInventoryConsumptionWithClient(tx, farmId, userId, dto));
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Expense Recorded',
            actionDetails: `${dto.category} expense: ${dto.description} — ৳${expense.amount.toString()} (inventory consumption, no cash movement).`,
            actorId: userId,
            financialImpact: 0,
        });
        return expense;
    }
    async recordInventoryConsumptionWithClient(client, farmId, userId, dto) {
        const amount = (0, money_1.toStorage)(dto.amount);
        const expense = await client.expense.create({
            data: {
                farmId,
                category: dto.category,
                description: dto.description,
                amount,
                expenseDate: new Date(dto.expenseDate),
                financialAccountId: null,
                supplierId: null,
                notes: null,
                cattleId: dto.cattleId ?? null,
                createdById: userId,
            },
        });
        const expenseAccountCode = EXPENSE_CATEGORY_LEDGER_CODE[dto.category];
        const expenseAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, expenseAccountCode, client);
        if (!expenseAccount) {
            throw new common_1.BadRequestException(`Expense ledger account (${expenseAccountCode}) is not seeded for this farm`);
        }
        const inventoryAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, INVENTORY_CODE, client);
        if (!inventoryAccount) {
            throw new common_1.BadRequestException('Inventory ledger account is not seeded for this farm');
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'EXPENSE',
            sourceId: expense.id,
            transactionDate: expense.expenseDate,
            description: `Expense: ${dto.description}`,
            idempotencyKey: `expense:${expense.id}`,
            createdById: userId,
            entries: [
                { ledgerAccountId: expenseAccount.id, debit: amount },
                { ledgerAccountId: inventoryAccount.id, credit: amount },
            ],
        }, client);
        this.log.info('Inventory consumption expense recorded', {
            farmId,
            expenseId: expense.id,
            category: dto.category,
            amount: amount.toString(),
        });
        return expense;
    }
    async deriveDueDate(client, supplierId, expenseDate) {
        if (!supplierId) {
            return null;
        }
        const supplier = await client.supplier.findUnique({
            where: { id: supplierId },
            select: { paymentTermsDays: true },
        });
        return (0, due_date_1.derivePayableDueDate)(expenseDate, supplier?.paymentTermsDays);
    }
    async findOne(farmId, id) {
        const expense = await this.prisma.expense.findFirst({
            where: { id, farmId },
        });
        if (!expense) {
            throw new common_1.NotFoundException('Expense not found');
        }
        return expense;
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.supplierId ? { supplierId: query.supplierId } : {}),
            ...(query.category ? { category: query.category } : {}),
            ...(query.from || query.to
                ? {
                    expenseDate: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
            ...(query.paymentStatus
                ? buildExpensePaymentStatusWhere(query.paymentStatus)
                : {}),
        };
        const rows = await this.prisma.expense.findMany({
            where,
            orderBy: [{ expenseDate: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async voidInventoryConsumption(farmId, expenseId, userId) {
        await this.reverseExpense(farmId, expenseId, userId);
        await this.prisma.expense.updateMany({
            where: { id: expenseId, farmId, voidedAt: null },
            data: { voidedAt: new Date() },
        });
    }
    async reverseExpense(farmId, expenseId, userId) {
        const journalTxn = await this.prisma.journalTransaction.findFirst({
            where: { farmId, sourceType: 'EXPENSE', sourceId: expenseId },
            select: { id: true },
        });
        if (!journalTxn) {
            return;
        }
        await this.journalService.reverseJournal({
            farmId,
            journalTransactionId: journalTxn.id,
            createdById: userId,
            idempotencyKey: `expense-reversal:${expenseId}`,
            description: `Reversal of expense ${expenseId}`,
        });
    }
};
exports.ExpenseService = ExpenseService;
exports.ExpenseService = ExpenseService = ExpenseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        journal_service_1.JournalService,
        ledger_account_service_1.LedgerAccountService,
        financial_account_service_1.FinancialAccountService,
        payable_service_1.PayableService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], ExpenseService);
//# sourceMappingURL=expense.service.js.map