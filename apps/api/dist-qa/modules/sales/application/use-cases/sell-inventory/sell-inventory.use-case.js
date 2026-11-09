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
var SellInventoryUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellInventoryUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const medicine_service_1 = require("src/modules/inventory/application/services/medicine.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const equipment_service_1 = require("src/modules/inventory/application/services/equipment.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const receivable_service_1 = require("src/modules/finance-v2/receivables/application/receivable.service");
const payment_service_1 = require("src/modules/finance-v2/payments/application/payment.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const sale_service_1 = require("../../sale.service");
const ACCOUNTS_RECEIVABLE_CODE = '1100';
const INVENTORY_SALES_REVENUE_CODE = '4300';
let SellInventoryUseCase = SellInventoryUseCase_1 = class SellInventoryUseCase {
    prisma;
    saleService;
    medicineService;
    feedItemService;
    equipmentService;
    ledgerAccountService;
    journalService;
    receivableService;
    paymentService;
    activityLog;
    log;
    constructor(prisma, saleService, medicineService, feedItemService, equipmentService, ledgerAccountService, journalService, receivableService, paymentService, activityLog, logger) {
        this.prisma = prisma;
        this.saleService = saleService;
        this.medicineService = medicineService;
        this.feedItemService = feedItemService;
        this.equipmentService = equipmentService;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.receivableService = receivableService;
        this.paymentService = paymentService;
        this.activityLog = activityLog;
        this.log = logger.setContext(SellInventoryUseCase_1.name);
    }
    async execute(farmId, userId, dto, tx) {
        const run = (client) => this.executeWithClient(client, farmId, userId, dto);
        const result = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        const lineDescription = result.sale.lines[0]?.description ?? dto.itemType;
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Inventory Item Sold',
            actionDetails: `Sale ${result.sale.saleNumber}: ${dto.quantity} x ${lineDescription} for ৳${result.sale.totalAmount.toString()}${(dto.amountReceived ?? 0) > 0 ? `, ৳${dto.amountReceived} received` : ''}.`,
            actorId: userId,
            financialImpact: Number(result.sale.totalAmount),
        });
        return result;
    }
    async executeWithClient(client, farmId, userId, dto) {
        this.assertInputShape(dto);
        const item = await this.getItemOrThrow(client, farmId, dto.itemType, dto.itemId);
        if (dto.quantity > item.currentStock) {
            throw new common_1.BadRequestException(`Insufficient stock: ${item.currentStock} on hand, ${dto.quantity} requested`);
        }
        const line = {
            type: client_1.SaleLineType.INVENTORY,
            description: `Sold ${item.name}`,
            quantity: dto.quantity,
            unitId: item.unitId ?? undefined,
            unitPrice: dto.unitPrice,
            medicineId: dto.itemType === 'MEDICINE' ? dto.itemId : undefined,
            feedItemId: dto.itemType === 'FEED_ITEM' ? dto.itemId : undefined,
            equipmentId: dto.itemType === 'EQUIPMENT' ? dto.itemId : undefined,
        };
        const sale = await this.saleService.createSale(farmId, userId, {
            saleDate: dto.saleDate,
            discountAmount: dto.discountAmount,
            notes: dto.notes,
            lines: [line],
        }, client);
        const saleLine = sale.lines[0];
        await this.adjustStockForSale(client, farmId, userId, dto, saleLine.id);
        const [arAccount, revenueAccount] = await Promise.all([
            this.ledgerAccountService.findByCode(farmId, ACCOUNTS_RECEIVABLE_CODE),
            this.ledgerAccountService.findByCode(farmId, INVENTORY_SALES_REVENUE_CODE),
        ]);
        if (!arAccount || !revenueAccount) {
            throw new common_1.BadRequestException('Accounts Receivable / Inventory Sales ledger accounts are not seeded for this farm');
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'SALE',
            sourceId: sale.id,
            transactionDate: sale.saleDate,
            description: `Inventory sale ${sale.saleNumber}`,
            idempotencyKey: `sale:${sale.id}`,
            createdById: userId,
            entries: [
                { ledgerAccountId: arAccount.id, debit: sale.totalAmount },
                { ledgerAccountId: revenueAccount.id, credit: sale.totalAmount },
            ],
        }, client);
        const receivable = await this.receivableService.createReceivable(farmId, sale.id, sale.totalAmount, null, client, sale.customerId);
        let payment = null;
        const amountReceived = dto.amountReceived ?? 0;
        if ((0, money_1.gt)(amountReceived, 0)) {
            payment = await this.paymentService.recordPayment(farmId, userId, {
                direction: client_1.PaymentDirection.INCOMING,
                financialAccountId: dto.financialAccountId,
                amount: amountReceived,
                method: dto.paymentMethod,
                transactionDate: dto.saleDate,
                referenceNumber: sale.saleNumber,
                notes: dto.notes,
            }, client);
            await this.paymentService.allocatePayment(farmId, payment.id, [{ amount: amountReceived, receivableId: receivable.id }], client);
        }
        await client.sale.update({
            where: { id: sale.id },
            data: { status: client_1.SaleStatus.CONFIRMED },
        });
        this.log.info('Inventory item sold', {
            farmId,
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            itemType: dto.itemType,
            itemId: dto.itemId,
            quantity: dto.quantity,
            totalAmount: sale.totalAmount.toString(),
            amountReceived,
        });
        return {
            sale: { ...sale, status: client_1.SaleStatus.CONFIRMED },
            receivable,
            payment,
        };
    }
    assertInputShape(dto) {
        if (!(dto.quantity > 0)) {
            throw new common_1.BadRequestException('Quantity must be greater than zero');
        }
        if (!(dto.unitPrice >= 0)) {
            throw new common_1.BadRequestException('Unit price cannot be negative');
        }
        if (dto.discountAmount !== undefined && dto.discountAmount < 0) {
            throw new common_1.BadRequestException('Discount amount cannot be negative');
        }
        const amountReceived = dto.amountReceived ?? 0;
        if (amountReceived < 0) {
            throw new common_1.BadRequestException('Amount received cannot be negative');
        }
        if (amountReceived > 0) {
            if (!dto.paymentMethod) {
                throw new common_1.BadRequestException('paymentMethod is required when amountReceived is greater than zero');
            }
        }
    }
    async getItemOrThrow(client, farmId, itemType, itemId) {
        switch (itemType) {
            case 'MEDICINE': {
                const medicine = await client.medicine.findFirst({
                    where: { id: itemId, farmId },
                    select: { id: true, name: true, unitId: true, currentStock: true },
                });
                if (!medicine)
                    throw new common_1.NotFoundException('Medicine not found');
                return medicine;
            }
            case 'FEED_ITEM': {
                const feedItem = await client.feedItem.findFirst({
                    where: { id: itemId, farmId },
                    select: {
                        id: true,
                        name: true,
                        unitId: true,
                        batches: {
                            where: { deletedAt: null },
                            select: { currentStock: true },
                        },
                    },
                });
                if (!feedItem)
                    throw new common_1.NotFoundException('Feed item not found');
                return {
                    id: feedItem.id,
                    name: feedItem.name,
                    unitId: feedItem.unitId,
                    currentStock: feedItem.batches.reduce((sum, b) => sum + b.currentStock, 0),
                };
            }
            case 'EQUIPMENT': {
                const equipment = await client.equipment.findFirst({
                    where: { id: itemId, farmId },
                    select: { id: true, name: true, unitId: true, currentStock: true },
                });
                if (!equipment)
                    throw new common_1.NotFoundException('Equipment not found');
                return equipment;
            }
        }
    }
    async adjustStockForSale(client, farmId, userId, dto, saleLineId) {
        const adjustment = -dto.quantity;
        const notes = dto.notes ?? 'Sold via SellInventoryItem';
        switch (dto.itemType) {
            case 'MEDICINE':
                await this.medicineService.decrementForSale(farmId, userId, { medicineId: dto.itemId, quantity: -adjustment, saleLineId, notes }, client);
                return;
            case 'FEED_ITEM':
                await this.feedItemService.adjustStock(farmId, userId, dto.itemId, { adjustment, reason: 'SALE', notes, saleLineId }, client);
                return;
            case 'EQUIPMENT':
                await this.equipmentService.adjustStock(farmId, userId, dto.itemId, { adjustment, reason: 'SALE', notes, saleLineId }, client);
                return;
        }
    }
};
exports.SellInventoryUseCase = SellInventoryUseCase;
exports.SellInventoryUseCase = SellInventoryUseCase = SellInventoryUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_service_1.SaleService,
        medicine_service_1.MedicineService,
        feed_item_service_1.FeedItemService,
        equipment_service_1.EquipmentService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        receivable_service_1.ReceivableService,
        payment_service_1.PaymentService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], SellInventoryUseCase);
//# sourceMappingURL=sell-inventory.use-case.js.map