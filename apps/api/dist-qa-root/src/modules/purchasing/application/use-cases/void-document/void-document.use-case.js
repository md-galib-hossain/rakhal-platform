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
var VoidDocumentUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoidDocumentUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const medicine_service_1 = require("src/modules/inventory/application/services/medicine.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const equipment_service_1 = require("src/modules/inventory/application/services/equipment.service");
const purchase_service_1 = require("../../purchase.service");
let VoidDocumentUseCase = VoidDocumentUseCase_1 = class VoidDocumentUseCase {
    prisma;
    purchaseService;
    journalService;
    medicineService;
    feedItemService;
    equipmentService;
    activityLog;
    log;
    constructor(prisma, purchaseService, journalService, medicineService, feedItemService, equipmentService, activityLog, logger) {
        this.prisma = prisma;
        this.purchaseService = purchaseService;
        this.journalService = journalService;
        this.medicineService = medicineService;
        this.feedItemService = feedItemService;
        this.equipmentService = equipmentService;
        this.activityLog = activityLog;
        this.log = logger.setContext(VoidDocumentUseCase_1.name);
    }
    async recordVoidActivity(farmId, userId, eventTitle, actionDetails, amount) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle,
                actionDetails,
                actorId: userId,
                financialImpact: amount,
            });
        }
        catch (error) {
            this.log.error('Void activity log failed', {
                farmId,
                eventTitle,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async voidPurchase(farmId, userId, purchaseId) {
        await this.prisma.$transaction(async (client) => {
            const purchase = await client.purchase.findFirst({
                where: { id: purchaseId, farmId },
                include: { lines: true, payable: { select: { id: true } } },
            });
            if (!purchase) {
                throw new common_1.NotFoundException('Purchase not found');
            }
            if (purchase.status === client_1.PurchaseStatus.VOIDED) {
                throw new common_1.BadRequestException('Purchase is already VOIDED');
            }
            if (purchase.payable) {
                const allocationCount = await client.paymentAllocation.count({
                    where: { payableId: purchase.payable.id },
                });
                if (allocationCount > 0) {
                    throw new common_1.BadRequestException('This purchase has payments allocated against it — refund the payment before voiding');
                }
            }
            await this.reverseJournalFor(client, farmId, userId, 'PURCHASE', purchase.id, `purchase-reversal:${purchase.id}`, `Reversal of purchase ${purchase.purchaseNumber}`);
            const notes = `Void of purchase ${purchase.purchaseNumber} — destocked`;
            for (const line of purchase.lines) {
                const quantity = -Number(line.quantity);
                if (line.medicineId) {
                    if (line.medicineBatchId) {
                        await this.medicineService.adjustBatchStock(farmId, userId, line.medicineBatchId, quantity, 'ADJUSTMENT', notes, client);
                    }
                    else {
                        await this.medicineService.adjustStock(farmId, userId, line.medicineId, { adjustment: quantity, reason: 'ADJUSTMENT', notes }, client);
                    }
                }
                else if (line.feedItemId) {
                    await this.feedItemService.adjustStock(farmId, userId, line.feedItemId, {
                        adjustment: quantity,
                        reason: 'ADJUSTMENT',
                        notes,
                        ...(line.feedItemBatchId
                            ? { batchId: line.feedItemBatchId }
                            : {}),
                    }, client);
                }
                else if (line.equipmentId) {
                    await this.equipmentService.adjustStock(farmId, userId, line.equipmentId, { adjustment: quantity, reason: 'ADJUSTMENT', notes }, client);
                }
            }
            if (purchase.payable) {
                await client.payable.update({
                    where: { id: purchase.payable.id },
                    data: { closedAt: new Date() },
                });
            }
            await client.purchase.update({
                where: { id: purchase.id },
                data: { status: client_1.PurchaseStatus.VOIDED },
            });
        });
        this.log.info('Purchase voided', { farmId, purchaseId });
        const voided = await this.purchaseService.findOne(farmId, purchaseId);
        await this.recordVoidActivity(farmId, userId, 'Purchase Voided', `Purchase ${voided.purchaseNumber} voided — ৳${voided.totalAmount.toString()} reversed, ${voided.lines.length} line(s) destocked.`, Number(voided.totalAmount));
        return voided;
    }
    async voidExpense(farmId, userId, expenseId) {
        await this.prisma.$transaction(async (client) => {
            const expense = await client.expense.findFirst({
                where: { id: expenseId, farmId },
                include: { payable: { select: { id: true } } },
            });
            if (!expense) {
                throw new common_1.NotFoundException('Expense not found');
            }
            if (expense.voidedAt) {
                throw new common_1.BadRequestException('Expense is already voided');
            }
            if (expense.payable) {
                const allocationCount = await client.paymentAllocation.count({
                    where: { payableId: expense.payable.id },
                });
                if (allocationCount > 0) {
                    throw new common_1.BadRequestException('This expense has payments allocated against it — refund the payment before voiding');
                }
            }
            await this.reverseJournalFor(client, farmId, userId, 'EXPENSE', expense.id, `expense-void-reversal:${expense.id}`, `Reversal of expense ${expense.id}`);
            if (expense.payable) {
                await client.payable.update({
                    where: { id: expense.payable.id },
                    data: { closedAt: new Date() },
                });
            }
            await client.expense.update({
                where: { id: expense.id },
                data: { voidedAt: new Date() },
            });
        });
        this.log.info('Expense voided', { farmId, expenseId });
        const voided = await this.prisma.expense.findFirstOrThrow({
            where: { id: expenseId, farmId },
        });
        await this.recordVoidActivity(farmId, userId, 'Expense Voided', `${voided.category} expense: ${voided.description} voided — ৳${voided.amount.toString()} reversed.`, Number(voided.amount));
        return voided;
    }
    async reverseJournalFor(client, farmId, userId, sourceType, sourceId, idempotencyKey, description) {
        const journalTxn = await client.journalTransaction.findFirst({
            where: { farmId, sourceType, sourceId },
            select: { id: true },
        });
        if (!journalTxn)
            return;
        await this.journalService.reverseJournal({
            farmId,
            journalTransactionId: journalTxn.id,
            createdById: userId,
            idempotencyKey,
            description,
        }, client);
    }
};
exports.VoidDocumentUseCase = VoidDocumentUseCase;
exports.VoidDocumentUseCase = VoidDocumentUseCase = VoidDocumentUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        purchase_service_1.PurchaseService,
        journal_service_1.JournalService,
        medicine_service_1.MedicineService,
        feed_item_service_1.FeedItemService,
        equipment_service_1.EquipmentService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], VoidDocumentUseCase);
//# sourceMappingURL=void-document.use-case.js.map