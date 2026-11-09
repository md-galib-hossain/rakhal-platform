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
var SellAnimalUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellAnimalUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const cattle_service_1 = require("src/modules/cattle/application/services/cattle.service");
const sale_service_1 = require("src/modules/sales/application/sale.service");
const receivable_service_1 = require("src/modules/finance-v2/receivables/application/receivable.service");
const payment_service_1 = require("src/modules/finance-v2/payments/application/payment.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const due_date_1 = require("src/modules/sales/domain/due-date");
const ACCOUNTS_RECEIVABLE_CODE = '1100';
const ANIMAL_SALES_REVENUE_CODE = '4100';
let SellAnimalUseCase = SellAnimalUseCase_1 = class SellAnimalUseCase {
    prisma;
    cattleService;
    saleService;
    receivableService;
    paymentService;
    ledgerAccountService;
    journalService;
    activityLog;
    log;
    constructor(prisma, cattleService, saleService, receivableService, paymentService, ledgerAccountService, journalService, activityLog, logger) {
        this.prisma = prisma;
        this.cattleService = cattleService;
        this.saleService = saleService;
        this.receivableService = receivableService;
        this.paymentService = paymentService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.activityLog = activityLog;
        this.log = logger.setContext(SellAnimalUseCase_1.name);
    }
    async execute(farmId, userId, cattleId, dto) {
        const salePrice = (0, money_1.toStorage)(dto.salePrice);
        if (!(0, money_1.gt)(salePrice, 0)) {
            throw new common_1.BadRequestException('salePrice must be greater than zero');
        }
        const hasAmountReceived = dto.amountReceived !== undefined && dto.amountReceived !== null;
        const amountReceived = hasAmountReceived
            ? (0, money_1.toStorage)(dto.amountReceived)
            : null;
        if (amountReceived && (0, money_1.gt)(amountReceived, salePrice)) {
            throw new common_1.BadRequestException('amountReceived cannot exceed salePrice');
        }
        const collectsPaymentNow = !!amountReceived && (0, money_1.gt)(amountReceived, 0);
        if (collectsPaymentNow && !dto.paymentMethod) {
            throw new common_1.BadRequestException('paymentMethod is required when amountReceived is greater than zero');
        }
        let soldTagNumber = '';
        const result = await this.prisma.$transaction(async (tx) => {
            const cattle = await tx.cattle.findFirst({
                where: { id: cattleId, farmId },
                select: { id: true, tagNumber: true },
            });
            if (!cattle) {
                throw new common_1.NotFoundException('Cattle not found');
            }
            soldTagNumber = cattle.tagNumber;
            const sale = await this.saleService.createSale(farmId, userId, {
                customerId: dto.buyerId ?? undefined,
                saleDate: dto.saleDate,
                lines: [
                    {
                        type: client_1.SaleLineType.ANIMAL,
                        description: `Sale of animal ${cattle.tagNumber}`,
                        quantity: 1,
                        unitPrice: dto.salePrice,
                        cattleId,
                    },
                ],
            }, tx);
            const disposition = await this.cattleService.recordDisposition(farmId, userId, cattleId, {
                type: client_1.CattleDispositionType.SALE,
                saleId: sale.id,
                date: new Date(dto.saleDate),
                price: sale.totalAmount,
            }, tx);
            const dueDate = sale.customerId
                ? (0, due_date_1.deriveSaleDueDate)(sale.saleDate, (await tx.milkBuyer.findUnique({
                    where: { id: sale.customerId },
                    select: { paymentTermsDays: true },
                }))?.paymentTermsDays)
                : null;
            const receivable = await this.receivableService.createReceivable(farmId, sale.id, sale.totalAmount, dueDate, tx, sale.customerId);
            const [arAccount, revenueAccount] = await Promise.all([
                this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
                this.ledgerAccountService.findByCode(farmId, ANIMAL_SALES_REVENUE_CODE),
            ]);
            if (!arAccount || !revenueAccount) {
                throw new common_1.BadRequestException('Chart of accounts is not seeded for this farm (Accounts Receivable / Animal Sales)');
            }
            const journal = await this.journalService.postJournal({
                farmId,
                sourceType: 'SALE',
                sourceId: sale.id,
                transactionDate: sale.saleDate,
                description: `Animal sale ${sale.saleNumber}`,
                idempotencyKey: `sale:${sale.id}`,
                createdById: userId,
                entries: [
                    { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
                    { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
                ],
            }, tx);
            let paymentId = null;
            if (collectsPaymentNow) {
                const payment = await this.paymentService.recordPayment(farmId, userId, {
                    direction: client_1.PaymentDirection.INCOMING,
                    financialAccountId: dto.financialAccountId,
                    amount: dto.amountReceived,
                    method: dto.paymentMethod,
                    transactionDate: dto.saleDate,
                    notes: `Payment for sale ${sale.saleNumber}`,
                }, tx);
                await this.paymentService.allocatePayment(farmId, payment.id, [{ receivableId: receivable.id, amount: dto.amountReceived }], tx);
                paymentId = payment.id;
            }
            await tx.sale.update({
                where: { id: sale.id },
                data: { status: client_1.SaleStatus.CONFIRMED },
            });
            this.log.info('Animal sold', {
                farmId,
                cattleId,
                saleId: sale.id,
                saleNumber: sale.saleNumber,
                dispositionId: disposition.id,
                receivableId: receivable.id,
                paymentId,
            });
            return {
                saleId: sale.id,
                saleNumber: sale.saleNumber,
                totalAmount: sale.totalAmount.toString(),
                dispositionId: disposition.id,
                receivableId: receivable.id,
                paymentId,
                journalTransactionId: journal.id,
            };
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Animal Sold',
            actionDetails: `Sale ${result.saleNumber}: animal ${soldTagNumber} sold for ৳${result.totalAmount}${result.paymentId ? `, ৳${dto.amountReceived} received` : ''}.`,
            actorId: userId,
            relatedCattleId: cattleId,
            financialImpact: Number(result.totalAmount),
        });
        return result;
    }
};
exports.SellAnimalUseCase = SellAnimalUseCase;
exports.SellAnimalUseCase = SellAnimalUseCase = SellAnimalUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cattle_service_1.CattleService,
        sale_service_1.SaleService,
        receivable_service_1.ReceivableService,
        payment_service_1.PaymentService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], SellAnimalUseCase);
//# sourceMappingURL=sell-animal.use-case.js.map