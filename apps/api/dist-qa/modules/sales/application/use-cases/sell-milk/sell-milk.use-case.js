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
var SellMilkUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellMilkUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const milk_tank_service_1 = require("src/modules/inventory/application/services/milk-tank.service");
const milk_availability_service_1 = require("src/modules/milk/application/services/milk-availability.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const receivable_service_1 = require("src/modules/finance-v2/receivables/application/receivable.service");
const payment_service_1 = require("src/modules/finance-v2/payments/application/payment.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const sale_service_1 = require("../../sale.service");
const due_date_1 = require("../../../domain/due-date");
const ACCOUNTS_RECEIVABLE_CODE = '1100';
const MILK_SALES_REVENUE_CODE = '4000';
let SellMilkUseCase = SellMilkUseCase_1 = class SellMilkUseCase {
    prisma;
    saleService;
    milkTankService;
    milkAvailabilityService;
    ledgerAccountService;
    journalService;
    receivableService;
    paymentService;
    activityLog;
    log;
    constructor(prisma, saleService, milkTankService, milkAvailabilityService, ledgerAccountService, journalService, receivableService, paymentService, activityLog, logger) {
        this.prisma = prisma;
        this.saleService = saleService;
        this.milkTankService = milkTankService;
        this.milkAvailabilityService = milkAvailabilityService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.receivableService = receivableService;
        this.paymentService = paymentService;
        this.activityLog = activityLog;
        this.log = logger.setContext(SellMilkUseCase_1.name);
    }
    async execute(farmId, userId, input, tx) {
        const run = (client) => this.executeWithClient(client, farmId, userId, input);
        const result = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Milk Sale Recorded',
            actionDetails: `Sale ${result.sale.saleNumber}: ${input.volumeL}L milk sold for ৳${result.sale.totalAmount.toString()}${(input.amountReceived ?? 0) > 0 ? `, ৳${input.amountReceived} received` : ''}.`,
            actorId: userId,
            financialImpact: Number(result.sale.totalAmount),
        });
        return result;
    }
    async executeWithClient(client, farmId, userId, input) {
        if (!(input.volumeL > 0)) {
            throw new common_1.BadRequestException('Milk sale volume must be greater than zero');
        }
        if (input.pricePerLitre < 0) {
            throw new common_1.BadRequestException('Milk sale price per litre cannot be negative');
        }
        const amountReceived = input.amountReceived ?? 0;
        if (amountReceived > 0) {
            if (!input.paymentMethod) {
                throw new common_1.BadRequestException('paymentMethod is required when amountReceived is greater than zero');
            }
        }
        const saleDate = input.saleDate ?? new Date().toISOString();
        const sale = await this.saleService.createSale(farmId, userId, {
            customerId: input.customerId ?? undefined,
            saleDate,
            notes: input.notes,
            lines: [
                {
                    type: client_1.SaleLineType.MILK,
                    description: input.description ?? 'Milk sale',
                    quantity: input.volumeL,
                    unitPrice: input.pricePerLitre,
                },
            ],
        }, client);
        const saleLine = sale.lines[0];
        const tankUpdated = await this.decrementSellableTank(client, farmId, userId, input.volumeL, saleLine.id, sale.saleNumber);
        const [arAccount, revenueAccount] = await Promise.all([
            this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
            this.ledgerAccountService.findByCode(farmId, MILK_SALES_REVENUE_CODE),
        ]);
        if (!arAccount || !revenueAccount) {
            throw new common_1.BadRequestException('Accounts Receivable / Milk Sales ledger accounts are not seeded for this farm');
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'SALE',
            sourceId: sale.id,
            transactionDate: sale.saleDate,
            description: `Milk sale ${sale.saleNumber}`,
            idempotencyKey: `sale:${sale.id}`,
            createdById: userId,
            entries: [
                { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
                { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
            ],
        }, client);
        const dueDate = input.dueDate ?? (await this.deriveDueDate(client, sale));
        const receivable = await this.receivableService.createReceivable(farmId, sale.id, sale.totalAmount, dueDate, client, sale.customerId);
        let payment = null;
        if (amountReceived > 0 && (0, money_1.gt)(amountReceived, 0)) {
            payment = await this.paymentService.recordPayment(farmId, userId, {
                direction: client_1.PaymentDirection.INCOMING,
                financialAccountId: input.financialAccountId,
                amount: amountReceived,
                method: input.paymentMethod,
                transactionDate: saleDate,
                referenceNumber: input.referenceNumber,
                notes: input.notes,
            }, client);
            await this.paymentService.allocatePayment(farmId, payment.id, [{ receivableId: receivable.id, amount: amountReceived }], client);
        }
        await client.sale.update({
            where: { id: sale.id },
            data: { status: client_1.SaleStatus.CONFIRMED },
        });
        this.log.info('Milk sale completed', {
            farmId,
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            volumeL: input.volumeL,
            totalAmount: sale.totalAmount.toString(),
            amountReceived,
            tankUpdated,
        });
        return {
            sale: { ...sale, status: client_1.SaleStatus.CONFIRMED },
            receivable,
            payment,
            tankUpdated,
        };
    }
    async decrementSellableTank(client, farmId, userId, volumeL, saleLineId, saleNumber) {
        await this.milkTankService.ensureDefaultSellableTank(farmId, userId, client);
        const tanks = await client.milkTank.findMany({
            where: { farmId, tankType: client_1.MilkTankType.SELLABLE, deletedAt: null },
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        const locked = [];
        for (const tank of tanks) {
            locked.push(await this.milkAvailabilityService.lockAndValidate(farmId, tank.id, 0, client));
        }
        const totalL = locked.reduce((sum, t) => sum + t.currentVolumeL, 0);
        if (totalL < volumeL) {
            throw new common_1.BadRequestException(`Insufficient milk available: ${totalL}L in stock, ${volumeL}L requested`);
        }
        let remainingL = volumeL;
        for (const tank of [...locked].sort((a, b) => b.currentVolumeL - a.currentVolumeL)) {
            if (remainingL <= 0)
                break;
            const takeL = Math.min(remainingL, tank.currentVolumeL);
            if (takeL <= 0)
                continue;
            await this.milkTankService.adjustVolume(farmId, userId, tank.id, {
                delta: -takeL,
                activityType: client_1.MilkTankActivity.SALE,
                source: 'milk_sale',
                notes: `Sale ${saleNumber}`,
                saleLineId,
            }, client);
            remainingL -= takeL;
        }
        return true;
    }
    async deriveDueDate(client, sale) {
        if (!sale.customerId)
            return null;
        const buyer = await client.milkBuyer.findUnique({
            where: { id: sale.customerId },
            select: { paymentTermsDays: true },
        });
        return (0, due_date_1.deriveSaleDueDate)(sale.saleDate, buyer?.paymentTermsDays);
    }
};
exports.SellMilkUseCase = SellMilkUseCase;
exports.SellMilkUseCase = SellMilkUseCase = SellMilkUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_service_1.SaleService,
        milk_tank_service_1.MilkTankService,
        milk_availability_service_1.MilkAvailabilityService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        receivable_service_1.ReceivableService,
        payment_service_1.PaymentService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], SellMilkUseCase);
//# sourceMappingURL=sell-milk.use-case.js.map