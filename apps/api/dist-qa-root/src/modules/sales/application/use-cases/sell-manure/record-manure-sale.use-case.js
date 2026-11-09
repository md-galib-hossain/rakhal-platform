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
var RecordManureSaleUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordManureSaleUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const receivable_service_1 = require("src/modules/finance-v2/receivables/application/receivable.service");
const payment_service_1 = require("src/modules/finance-v2/payments/application/payment.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const sale_service_1 = require("../../sale.service");
const ACCOUNTS_RECEIVABLE_CODE = '1100';
const MANURE_SALES_REVENUE_CODE = '4200';
let RecordManureSaleUseCase = RecordManureSaleUseCase_1 = class RecordManureSaleUseCase {
    prisma;
    saleService;
    receivableService;
    paymentService;
    ledgerAccountService;
    journalService;
    activityLog;
    log;
    constructor(prisma, saleService, receivableService, paymentService, ledgerAccountService, journalService, activityLog, logger) {
        this.prisma = prisma;
        this.saleService = saleService;
        this.receivableService = receivableService;
        this.paymentService = paymentService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.activityLog = activityLog;
        this.log = logger.setContext(RecordManureSaleUseCase_1.name);
    }
    async execute(farmId, userId, dto) {
        if (!(0, money_1.gt)(dto.totalAmount, 0)) {
            throw new common_1.BadRequestException('totalAmount must be greater than zero');
        }
        if (dto.quantity !== undefined && !(0, money_1.gt)(dto.quantity, 0)) {
            throw new common_1.BadRequestException('quantity, when provided, must be greater than zero');
        }
        const wantsPayment = dto.amountReceived !== undefined && (0, money_1.gt)(dto.amountReceived, 0);
        if (wantsPayment) {
            if ((0, money_1.gt)(dto.amountReceived, dto.totalAmount)) {
                throw new common_1.BadRequestException('amountReceived cannot exceed totalAmount');
            }
        }
        const quantity = dto.quantity ?? 1;
        const unitPrice = dto.quantity
            ? (0, money_1.toMoney)(dto.totalAmount).dividedBy(quantity).toNumber()
            : dto.totalAmount;
        const result = await this.prisma.$transaction(async (tx) => {
            const saleDto = {
                saleDate: dto.saleDate,
                notes: dto.notes,
                lines: [
                    {
                        type: client_1.SaleLineType.MANURE,
                        description: dto.notes?.trim() || 'Manure sale',
                        quantity,
                        unitId: dto.unitId,
                        unitPrice,
                        manureNotes: dto.notes,
                    },
                ],
            };
            const sale = await this.saleService.createSale(farmId, userId, saleDto, tx);
            const [arAccount, revenueAccount] = await Promise.all([
                this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
                this.ledgerAccountService.findByCode(farmId, MANURE_SALES_REVENUE_CODE),
            ]);
            if (!arAccount || !revenueAccount) {
                throw new common_1.BadRequestException('Accounts Receivable / Manure Sales ledger accounts are not seeded for this farm');
            }
            await this.journalService.postJournal({
                farmId,
                sourceType: 'SALE',
                sourceId: sale.id,
                transactionDate: sale.saleDate,
                description: `Manure sale ${sale.saleNumber}`,
                idempotencyKey: `sale:${sale.id}`,
                createdById: userId,
                entries: [
                    { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
                    { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
                ],
            }, tx);
            const receivable = await this.receivableService.createReceivable(farmId, sale.id, sale.totalAmount, null, tx, sale.customerId);
            let paymentId = null;
            if (wantsPayment) {
                const payment = await this.paymentService.recordPayment(farmId, userId, {
                    direction: client_1.PaymentDirection.INCOMING,
                    financialAccountId: dto.financialAccountId,
                    amount: dto.amountReceived,
                    method: dto.paymentMethod ?? client_1.PaymentMethod.CASH,
                    transactionDate: dto.saleDate,
                }, tx);
                paymentId = payment.id;
                await this.paymentService.allocatePayment(farmId, payment.id, [
                    {
                        receivableId: receivable.id,
                        amount: dto.amountReceived,
                    },
                ], tx);
            }
            await tx.sale.update({
                where: { id: sale.id },
                data: { status: client_1.SaleStatus.CONFIRMED },
            });
            this.log.info('Manure sale recorded', {
                farmId,
                saleId: sale.id,
                receivableId: receivable.id,
                paymentId,
                totalAmount: sale.totalAmount.toString(),
                hadQuantity: dto.quantity !== undefined,
            });
            return {
                sale: { ...sale, status: client_1.SaleStatus.CONFIRMED },
                receivableId: receivable.id,
                paymentId,
            };
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Manure Sale Recorded',
            actionDetails: `Sale ${result.sale.saleNumber}: manure sold for ৳${result.sale.totalAmount.toString()}${result.paymentId ? `, ৳${dto.amountReceived} received` : ''}.`,
            actorId: userId,
            financialImpact: Number(result.sale.totalAmount),
        });
        return result;
    }
};
exports.RecordManureSaleUseCase = RecordManureSaleUseCase;
exports.RecordManureSaleUseCase = RecordManureSaleUseCase = RecordManureSaleUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_service_1.SaleService,
        receivable_service_1.ReceivableService,
        payment_service_1.PaymentService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], RecordManureSaleUseCase);
//# sourceMappingURL=record-manure-sale.use-case.js.map