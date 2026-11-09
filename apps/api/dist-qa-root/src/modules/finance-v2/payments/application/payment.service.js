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
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const financial_account_service_1 = require("src/modules/finance-v2/accounts/application/financial-account.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const receivable_service_1 = require("src/modules/finance-v2/receivables/application/receivable.service");
const payable_service_1 = require("src/modules/purchasing/application/payable.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const ACCOUNTS_RECEIVABLE_CODE = '1100';
const ACCOUNTS_PAYABLE_CODE = '2000';
let PaymentService = PaymentService_1 = class PaymentService {
    prisma;
    financialAccountService;
    ledgerAccountService;
    journalService;
    receivableService;
    payableService;
    activityLog;
    log;
    constructor(prisma, financialAccountService, ledgerAccountService, journalService, receivableService, payableService, activityLog, logger) {
        this.prisma = prisma;
        this.financialAccountService = financialAccountService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.receivableService = receivableService;
        this.payableService = payableService;
        this.activityLog = activityLog;
        this.log = logger.setContext(PaymentService_1.name);
    }
    async recordPayment(farmId, userId, dto, tx) {
        const run = (client) => this.recordWithClient(client, farmId, userId, dto);
        if (!tx) {
            const payment = await this.prisma.$transaction((t) => run(t));
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle: 'Finance Payment Recorded',
                actionDetails: `${dto.direction === client_1.PaymentDirection.INCOMING ? 'Received' : 'Paid'} ৳${payment.amount.toString()} via ${dto.method}.`,
                actorId: userId,
                financialImpact: dto.direction === client_1.PaymentDirection.INCOMING
                    ? Number(payment.amount)
                    : -Number(payment.amount),
            });
            return payment;
        }
        return run(tx);
    }
    async recordWithClient(client, farmId, userId, dto) {
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
            throw new common_1.BadRequestException('Payment amount must be greater than zero');
        }
        const counterpartCode = dto.direction === client_1.PaymentDirection.INCOMING
            ? ACCOUNTS_RECEIVABLE_CODE
            : ACCOUNTS_PAYABLE_CODE;
        const counterpartAccount = await this.ledgerAccountService.findByCode(farmId, counterpartCode);
        if (!counterpartAccount) {
            throw new common_1.BadRequestException(`${counterpartCode === ACCOUNTS_RECEIVABLE_CODE ? 'Accounts Receivable' : 'Accounts Payable'} ledger account is not seeded for this farm`);
        }
        const payment = await client.financePayment.create({
            data: {
                farmId,
                direction: dto.direction,
                financialAccountId: account.id,
                amount,
                method: dto.method,
                transactionDate: new Date(dto.transactionDate),
                referenceNumber: dto.referenceNumber,
                notes: dto.notes,
                createdById: userId,
            },
        });
        const entries = dto.direction === client_1.PaymentDirection.INCOMING
            ? [
                { ledgerAccountId: account.ledgerAccountId, debit: amount },
                { ledgerAccountId: counterpartAccount.id, credit: amount },
            ]
            : [
                { ledgerAccountId: counterpartAccount.id, debit: amount },
                { ledgerAccountId: account.ledgerAccountId, credit: amount },
            ];
        await this.journalService.postJournal({
            farmId,
            sourceType: 'FINANCE_PAYMENT',
            sourceId: payment.id,
            transactionDate: payment.transactionDate,
            description: dto.direction === client_1.PaymentDirection.INCOMING
                ? `Payment received via ${dto.method}`
                : `Payment made via ${dto.method}`,
            idempotencyKey: `finance-payment:${payment.id}`,
            createdById: userId,
            entries,
        }, client);
        this.log.info('Finance payment recorded', {
            farmId,
            paymentId: payment.id,
            direction: payment.direction,
            financialAccountId: payment.financialAccountId,
            amount: amount.toString(),
        });
        return payment;
    }
    async allocatePayment(farmId, paymentId, lines, tx) {
        const run = (client) => this.allocateWithClient(client, farmId, paymentId, lines);
        if (!tx) {
            const created = await this.prisma.$transaction((t) => run(t));
            const total = (0, money_1.sum)(created.map((a) => a.amount));
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle: 'Payment Allocated',
                actionDetails: `Payment ${paymentId} allocated ৳${total.toString()} across ${created.length} line(s).`,
                actorId: null,
                financialImpact: Number(total),
                taggedValues: [{ key: 'sensitive', value: 'payment-allocation' }],
            });
            return created;
        }
        return run(tx);
    }
    async allocateWithClient(client, farmId, paymentId, lines) {
        const payment = await client.financePayment.findFirst({
            where: { id: paymentId, farmId },
            include: { allocations: true },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        for (const line of lines) {
            const hasReceivable = !!line.receivableId;
            const hasPayable = !!line.payableId;
            if (hasReceivable === hasPayable) {
                throw new common_1.BadRequestException('Each allocation must set exactly one of receivableId or payableId');
            }
            if (!(0, money_1.gt)(line.amount, 0)) {
                throw new common_1.BadRequestException('Allocation amount must be greater than zero');
            }
        }
        const alreadyAllocated = (0, money_1.sum)(payment.allocations.map((a) => a.amount));
        const newAllocated = (0, money_1.sum)(lines.map((l) => l.amount));
        const totalAfter = (0, money_1.add)(alreadyAllocated, newAllocated);
        if ((0, money_1.gt)(totalAfter, payment.amount)) {
            throw new common_1.BadRequestException('Allocation total exceeds the payment amount — a payment cannot be over-allocated');
        }
        const created = [];
        for (const line of lines) {
            const amount = (0, money_1.toStorage)(line.amount);
            if (line.receivableId) {
                await this.receivableService.assertWithinOutstanding(farmId, line.receivableId, amount, client);
            }
            else if (line.payableId) {
                await this.payableService.assertWithinOutstanding(farmId, line.payableId, amount, client);
            }
            const row = await client.paymentAllocation.create({
                data: {
                    paymentId: payment.id,
                    receivableId: line.receivableId ?? null,
                    payableId: line.payableId ?? null,
                    amount,
                },
            });
            created.push(row);
            if (line.receivableId) {
                await this.receivableService.closeIfSettled(farmId, line.receivableId, client);
            }
            else if (line.payableId) {
                await this.payableService.closeIfSettled(farmId, line.payableId, client);
            }
        }
        this.log.info('Payment allocated', {
            farmId,
            paymentId: payment.id,
            lines: created.length,
            totalAllocated: totalAfter.toString(),
        });
        return created;
    }
    async findOne(farmId, id) {
        const payment = await this.prisma.financePayment.findFirst({
            where: { id, farmId },
            include: { allocations: true },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        return payment;
    }
    async findAll(farmId) {
        return this.prisma.financePayment.findMany({
            where: { farmId },
            orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        });
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        financial_account_service_1.FinancialAccountService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        receivable_service_1.ReceivableService,
        payable_service_1.PayableService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map