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
var VoidSaleUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoidSaleUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const milk_tank_service_1 = require("src/modules/inventory/application/services/milk-tank.service");
const medicine_service_1 = require("src/modules/inventory/application/services/medicine.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const equipment_service_1 = require("src/modules/inventory/application/services/equipment.service");
const cattle_service_1 = require("src/modules/cattle/application/services/cattle.service");
const sale_service_1 = require("../../sale.service");
let VoidSaleUseCase = VoidSaleUseCase_1 = class VoidSaleUseCase {
    prisma;
    saleService;
    journalService;
    milkTankService;
    medicineService;
    feedItemService;
    equipmentService;
    cattleService;
    activityLog;
    log;
    constructor(prisma, saleService, journalService, milkTankService, medicineService, feedItemService, equipmentService, cattleService, activityLog, logger) {
        this.prisma = prisma;
        this.saleService = saleService;
        this.journalService = journalService;
        this.milkTankService = milkTankService;
        this.medicineService = medicineService;
        this.feedItemService = feedItemService;
        this.equipmentService = equipmentService;
        this.cattleService = cattleService;
        this.activityLog = activityLog;
        this.log = logger.setContext(VoidSaleUseCase_1.name);
    }
    async recordVoidActivity(farmId, userId, eventTitle, sale) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle,
                actionDetails: `Sale ${sale.saleNumber} ${eventTitle === 'Sale Cancelled' ? 'cancelled' : 'refunded'} — ৳${sale.totalAmount.toString()} reversed.`,
                actorId: userId,
                financialImpact: -Number(sale.totalAmount),
            });
        }
        catch (error) {
            this.log.error('Sale void activity log failed', {
                farmId,
                saleId: sale.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async cancelSale(farmId, userId, saleId, tx) {
        const run = (client) => this.cancelWithClient(client, farmId, userId, saleId);
        if (tx)
            return run(tx);
        const sale = await this.prisma.$transaction((t) => run(t));
        await this.recordVoidActivity(farmId, userId, 'Sale Cancelled', sale);
        return sale;
    }
    async cancelWithClient(client, farmId, userId, saleId) {
        const sale = await this.getVoidableSaleOrThrow(client, farmId, saleId);
        const receivable = await client.receivable.findFirst({
            where: { saleId },
            select: { id: true },
        });
        if (receivable) {
            const allocationCount = await client.paymentAllocation.count({
                where: { receivableId: receivable.id },
            });
            if (allocationCount > 0) {
                throw new common_1.BadRequestException('This sale has payments allocated against it — refund it instead of cancelling');
            }
        }
        await this.reverseSaleJournal(client, farmId, userId, sale);
        await this.reversePhysicalEffects(client, farmId, userId, sale);
        if (receivable) {
            await client.receivable.update({
                where: { id: receivable.id },
                data: { closedAt: new Date() },
            });
        }
        await client.sale.update({
            where: { id: saleId },
            data: { status: client_1.SaleStatus.CANCELLED },
        });
        this.log.info('Sale cancelled', { farmId, saleId });
        return { ...sale, status: client_1.SaleStatus.CANCELLED };
    }
    async refundSale(farmId, userId, saleId, tx) {
        const run = (client) => this.refundWithClient(client, farmId, userId, saleId);
        if (tx)
            return run(tx);
        const sale = await this.prisma.$transaction((t) => run(t));
        await this.recordVoidActivity(farmId, userId, 'Sale Refunded', sale);
        return sale;
    }
    async refundWithClient(client, farmId, userId, saleId) {
        const sale = await this.getVoidableSaleOrThrow(client, farmId, saleId);
        const receivable = await client.receivable.findFirst({
            where: { saleId },
            select: { id: true },
        });
        if (!receivable) {
            throw new common_1.BadRequestException('This sale has no receivable — nothing to refund');
        }
        const allocations = await client.paymentAllocation.findMany({
            where: { receivableId: receivable.id },
            select: { paymentId: true },
        });
        if (allocations.length === 0) {
            throw new common_1.BadRequestException('This sale has no payments allocated — cancel it instead of refunding');
        }
        const paymentIds = [...new Set(allocations.map((a) => a.paymentId))];
        for (const paymentId of paymentIds) {
            await this.reverseJournalFor(client, farmId, userId, 'FINANCE_PAYMENT', paymentId, `payment-reversal:${paymentId}`, `Reversal of payment ${paymentId} (refund of sale ${sale.saleNumber})`);
        }
        await this.reverseSaleJournal(client, farmId, userId, sale);
        await this.reversePhysicalEffects(client, farmId, userId, sale);
        await client.receivable.update({
            where: { id: receivable.id },
            data: { closedAt: new Date() },
        });
        await client.sale.update({
            where: { id: saleId },
            data: { status: client_1.SaleStatus.REFUNDED },
        });
        this.log.info('Sale refunded', {
            farmId,
            saleId,
            paymentCount: paymentIds.length,
        });
        return { ...sale, status: client_1.SaleStatus.REFUNDED };
    }
    async getVoidableSaleOrThrow(client, farmId, saleId) {
        const sale = await client.sale.findFirst({
            where: { id: saleId, farmId },
            include: {
                lines: {
                    include: {
                        unit: true,
                        milkDetail: true,
                        animalDetail: true,
                        inventoryDetail: true,
                        manureDetail: true,
                    },
                },
            },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Sale not found');
        }
        if (sale.status === client_1.SaleStatus.CANCELLED ||
            sale.status === client_1.SaleStatus.REFUNDED) {
            throw new common_1.BadRequestException(`Sale is already ${sale.status}`);
        }
        if (sale.status === client_1.SaleStatus.DRAFT) {
            throw new common_1.BadRequestException('A DRAFT sale was never confirmed — nothing to void');
        }
        return sale;
    }
    async reverseSaleJournal(client, farmId, userId, sale) {
        await this.reverseJournalFor(client, farmId, userId, 'SALE', sale.id, `sale-reversal:${sale.id}`, `Reversal of sale ${sale.saleNumber}`);
    }
    async reverseJournalFor(client, farmId, userId, sourceType, sourceId, idempotencyKey, description) {
        const journalTxn = await client.journalTransaction.findFirst({
            where: { farmId, sourceType, sourceId },
            select: { id: true },
        });
        if (!journalTxn) {
            return;
        }
        await this.journalService.reverseJournal({
            farmId,
            journalTransactionId: journalTxn.id,
            createdById: userId,
            idempotencyKey,
            description,
        }, client);
    }
    async reversePhysicalEffects(client, farmId, userId, sale) {
        for (const line of sale.lines) {
            if (line.milkDetail) {
                await this.reverseMilkTankDecrement(client, farmId, userId, line.id, sale.saleNumber);
            }
            else if (line.animalDetail) {
                await this.cattleService.undoDisposition(farmId, line.animalDetail.cattleId, client);
            }
            else if (line.inventoryDetail) {
                await this.restockInventoryLine(client, farmId, userId, line.id, Number(line.quantity), line.inventoryDetail, sale.saleNumber);
            }
        }
    }
    async reverseMilkTankDecrement(client, farmId, userId, saleLineId, saleNumber) {
        const auditLogs = await client.milkTankAuditLog.findMany({
            where: { farmId, saleLineId },
            orderBy: { createdAt: 'asc' },
        });
        for (const auditLog of auditLogs) {
            await this.milkTankService.adjustVolume(farmId, userId, auditLog.milkTankId, {
                delta: -auditLog.quantityL,
                activityType: 'ADJUSTMENT',
                source: 'sale_void',
                notes: `Void of sale ${saleNumber} — credited back`,
            }, client, { allowOverCapacity: true });
        }
    }
    async restockInventoryLine(client, farmId, userId, saleLineId, quantity, inventoryDetail, saleNumber) {
        const notes = `Void of sale ${saleNumber} — restocked`;
        if (inventoryDetail.medicineId) {
            await this.medicineService.restoreForSaleVoid(farmId, userId, {
                saleLineId,
                fallbackMedicineId: inventoryDetail.medicineId,
                fallbackQuantity: quantity,
                notes,
            }, client);
        }
        else if (inventoryDetail.feedItemId) {
            await this.feedItemService.restoreForSaleVoid(farmId, userId, {
                saleLineId,
                fallbackFeedItemId: inventoryDetail.feedItemId,
                fallbackQuantity: quantity,
                notes,
            }, client);
        }
        else if (inventoryDetail.equipmentId) {
            await this.equipmentService.adjustStock(farmId, userId, inventoryDetail.equipmentId, { adjustment: quantity, reason: 'ADJUSTMENT', notes, saleLineId }, client);
        }
    }
};
exports.VoidSaleUseCase = VoidSaleUseCase;
exports.VoidSaleUseCase = VoidSaleUseCase = VoidSaleUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_service_1.SaleService,
        journal_service_1.JournalService,
        milk_tank_service_1.MilkTankService,
        medicine_service_1.MedicineService,
        feed_item_service_1.FeedItemService,
        equipment_service_1.EquipmentService,
        cattle_service_1.CattleService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], VoidSaleUseCase);
//# sourceMappingURL=void-sale.use-case.js.map