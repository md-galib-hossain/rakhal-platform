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
var TransferService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const financial_account_service_1 = require("src/modules/finance-v2/accounts/application/financial-account.service");
const balance_service_1 = require("src/modules/finance-v2/accounts/application/balance.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const TRANSFER_FEE_EXPENSE_CODE = '5500';
let TransferService = TransferService_1 = class TransferService {
    prisma;
    financialAccountService;
    balanceService;
    ledgerAccountService;
    journalService;
    activityLog;
    log;
    constructor(prisma, financialAccountService, balanceService, ledgerAccountService, journalService, activityLog, logger) {
        this.prisma = prisma;
        this.financialAccountService = financialAccountService;
        this.balanceService = balanceService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.activityLog = activityLog;
        this.log = logger.setContext(TransferService_1.name);
    }
    async createTransfer(farmId, userId, dto, tx) {
        if (dto.fromFinancialAccountId === dto.toFinancialAccountId) {
            throw new common_1.BadRequestException('fromFinancialAccountId and toFinancialAccountId must differ — a transfer cannot target the same account');
        }
        const amount = (0, money_1.toStorage)(dto.amount);
        if (!(0, money_1.gt)(amount, 0)) {
            throw new common_1.BadRequestException('Transfer amount must be greater than zero');
        }
        const feeAmount = (0, money_1.toStorage)(dto.feeAmount ?? 0);
        if ((0, money_1.isNegative)(feeAmount)) {
            throw new common_1.BadRequestException('Transfer fee cannot be negative');
        }
        await this.financialAccountService.assertAccountActive(farmId, dto.fromFinancialAccountId);
        await this.financialAccountService.assertAccountActive(farmId, dto.toFinancialAccountId);
        const requiredFromSource = (0, money_1.add)(amount, feeAmount);
        const sourceBalance = await this.balanceService.getAccountBalance(farmId, dto.fromFinancialAccountId);
        if (!(0, money_1.gte)(sourceBalance.balance, requiredFromSource)) {
            throw new common_1.BadRequestException('Source account balance is insufficient to cover this transfer (amount + fee)');
        }
        const run = (client) => this.createWithClient(client, farmId, userId, dto, amount, feeAmount);
        const transfer = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Account Transfer',
            actionDetails: `Transfer ৳${transfer.amount.toString()}${(0, money_1.gt)(feeAmount, 0) ? ` + ৳${feeAmount.toString()} fee` : ''} between financial accounts.`,
            actorId: userId,
            financialImpact: Number(transfer.amount),
            taggedValues: [{ key: 'sensitive', value: 'owner-only' }],
        });
        return transfer;
    }
    async createWithClient(client, farmId, userId, dto, amount, feeAmount) {
        const [fromAccount, toAccount] = await Promise.all([
            client.financialAccount.findFirst({
                where: { id: dto.fromFinancialAccountId, farmId },
                select: { id: true, ledgerAccountId: true },
            }),
            client.financialAccount.findFirst({
                where: { id: dto.toFinancialAccountId, farmId },
                select: { id: true, ledgerAccountId: true },
            }),
        ]);
        if (!fromAccount) {
            throw new common_1.NotFoundException('Source financial account not found');
        }
        if (!toAccount) {
            throw new common_1.NotFoundException('Destination financial account not found');
        }
        const transfer = await client.transfer.create({
            data: {
                farmId,
                fromFinancialAccountId: fromAccount.id,
                toFinancialAccountId: toAccount.id,
                amount,
                feeAmount,
                transactionDate: new Date(dto.transactionDate),
                notes: dto.notes,
                createdById: userId,
            },
        });
        const entries = [
            { ledgerAccountId: toAccount.ledgerAccountId, debit: amount },
            { ledgerAccountId: fromAccount.ledgerAccountId, credit: amount },
        ];
        if ((0, money_1.gt)(feeAmount, 0)) {
            const feeAccount = await this.ledgerAccountService.findByCode(farmId, TRANSFER_FEE_EXPENSE_CODE);
            if (!feeAccount) {
                throw new common_1.BadRequestException('Transfer Fee Expense ledger account is not seeded for this farm');
            }
            entries.push({ ledgerAccountId: feeAccount.id, debit: feeAmount }, { ledgerAccountId: fromAccount.ledgerAccountId, credit: feeAmount });
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'FINANCE_TRANSFER',
            sourceId: transfer.id,
            transactionDate: transfer.transactionDate,
            description: (0, money_1.gt)(feeAmount, 0)
                ? `Transfer with ${feeAmount.toString()} fee`
                : 'Transfer',
            idempotencyKey: `finance-transfer:${transfer.id}`,
            createdById: userId,
            entries,
        }, client);
        this.log.info('Transfer recorded', {
            farmId,
            transferId: transfer.id,
            fromFinancialAccountId: fromAccount.id,
            toFinancialAccountId: toAccount.id,
            amount: amount.toString(),
            feeAmount: feeAmount.toString(),
        });
        return transfer;
    }
    async findOne(farmId, id) {
        const transfer = await this.prisma.transfer.findFirst({
            where: { id, farmId },
        });
        if (!transfer) {
            throw new common_1.NotFoundException('Transfer not found');
        }
        return transfer;
    }
    async findAll(farmId) {
        return this.prisma.transfer.findMany({
            where: { farmId },
            orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        });
    }
};
exports.TransferService = TransferService;
exports.TransferService = TransferService = TransferService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        financial_account_service_1.FinancialAccountService,
        balance_service_1.BalanceService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], TransferService);
//# sourceMappingURL=transfer.service.js.map