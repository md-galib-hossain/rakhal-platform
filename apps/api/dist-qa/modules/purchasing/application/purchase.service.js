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
var PurchaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const financial_account_service_1 = require("src/modules/finance-v2/accounts/application/financial-account.service");
const medicine_service_1 = require("src/modules/inventory/application/services/medicine.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const equipment_service_1 = require("src/modules/inventory/application/services/equipment.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const payable_status_1 = require("../domain/payable-status");
const purchase_line_shape_1 = require("../domain/purchase-line-shape");
const purchase_payment_1 = require("../domain/purchase-payment");
const assert_supplier_in_farm_1 = require("../domain/assert-supplier-in-farm");
const due_date_1 = require("../domain/due-date");
const purchase_number_allocator_1 = require("../infrastructure/purchase-number.allocator");
const payable_service_1 = require("./payable.service");
function buildPurchasePaymentStatusWhere(status) {
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
const INVENTORY_CODE = '1200';
const ACCOUNTS_PAYABLE_CODE = '2000';
const PURCHASE_INCLUDE = {
    lines: true,
    payable: true,
};
let PurchaseService = PurchaseService_1 = class PurchaseService {
    prisma;
    purchaseNumberAllocator;
    journalService;
    ledgerAccountService;
    financialAccountService;
    medicineService;
    feedItemService;
    equipmentService;
    payableService;
    activityLog;
    log;
    constructor(prisma, purchaseNumberAllocator, journalService, ledgerAccountService, financialAccountService, medicineService, feedItemService, equipmentService, payableService, activityLog, logger) {
        this.prisma = prisma;
        this.purchaseNumberAllocator = purchaseNumberAllocator;
        this.journalService = journalService;
        this.ledgerAccountService = ledgerAccountService;
        this.financialAccountService = financialAccountService;
        this.medicineService = medicineService;
        this.feedItemService = feedItemService;
        this.equipmentService = equipmentService;
        this.payableService = payableService;
        this.activityLog = activityLog;
        this.log = logger.setContext(PurchaseService_1.name);
    }
    async createPurchase(farmId, userId, dto) {
        const { purchase, newItemNames } = await this.prisma.$transaction((tx) => this.createWithClient(tx, farmId, userId, dto));
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle: 'Purchase Recorded',
                actionDetails: `Purchase ${purchase.purchaseNumber}: ৳${purchase.totalAmount.toString()} across ${purchase.lines.length} line(s).${newItemNames.length ? ` New inventory item(s) created: ${newItemNames.join(', ')}.` : ''}`,
                actorId: userId,
                financialImpact: -Number(purchase.totalAmount),
            });
        }
        catch (error) {
            this.log.error('Purchase activity log failed', {
                farmId,
                purchaseId: purchase.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return purchase;
    }
    async createWithClient(client, farmId, userId, dto) {
        for (const line of dto.lines) {
            const error = (0, purchase_line_shape_1.validatePurchaseLineDetailShape)(line);
            if (error) {
                throw new common_1.BadRequestException(error);
            }
        }
        const lineComputations = dto.lines.map((line) => ({
            line,
            totalAmount: (0, money_1.toStorage)((0, money_1.multiply)(line.quantity, line.unitCost)),
        }));
        const totalAmount = (0, money_1.toStorage)((0, money_1.sum)(lineComputations.map((c) => c.totalAmount)));
        const paidAmount = (0, money_1.toStorage)(dto.paidAmount ?? 0);
        if ((0, money_1.gt)(paidAmount, totalAmount)) {
            throw new common_1.BadRequestException('paidAmount cannot exceed the purchase total');
        }
        const outstanding = (0, money_1.toStorage)((0, money_1.subtract)(totalAmount, paidAmount));
        if (dto.supplierId) {
            await (0, assert_supplier_in_farm_1.assertSupplierBelongsToFarm)(client, farmId, dto.supplierId);
        }
        const purchaseNumber = await this.purchaseNumberAllocator.allocate(client, farmId);
        const purchase = await client.purchase.create({
            data: {
                farmId,
                purchaseNumber,
                supplierId: dto.supplierId ?? null,
                purchaseDate: new Date(dto.purchaseDate),
                totalAmount,
                notes: dto.notes ?? null,
                createdById: userId,
            },
        });
        const newItemNames = [];
        for (const { line, totalAmount: lineTotal } of lineComputations) {
            const createdName = await this.createLineAndIncrementStock(client, farmId, userId, purchase, line, lineTotal);
            if (createdName)
                newItemNames.push(createdName);
        }
        let financialAccountLedgerAccountId = null;
        if ((0, money_1.gt)(paidAmount, 0)) {
            const paidFromAccountId = await this.financialAccountService.resolveFarmAccountId(farmId, userId, dto.financialAccountId, client);
            await this.financialAccountService.assertAccountActive(farmId, paidFromAccountId);
            const account = await client.financialAccount.findFirst({
                where: { id: paidFromAccountId, farmId },
                select: { id: true, ledgerAccountId: true },
            });
            if (!account) {
                throw new common_1.NotFoundException('Financial account not found');
            }
            financialAccountLedgerAccountId = account.ledgerAccountId;
        }
        const inventoryAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, INVENTORY_CODE, client);
        if (!inventoryAccount) {
            throw new common_1.BadRequestException('Inventory ledger account is not seeded for this farm');
        }
        const entries = [
            { ledgerAccountId: inventoryAccount.id, debit: totalAmount },
        ];
        if ((0, money_1.gt)(paidAmount, 0) && financialAccountLedgerAccountId) {
            entries.push({
                ledgerAccountId: financialAccountLedgerAccountId,
                credit: paidAmount,
            });
        }
        if ((0, money_1.gt)(outstanding, 0)) {
            const payableAccount = await this.ledgerAccountService.findByCodeOrSeed(farmId, ACCOUNTS_PAYABLE_CODE, client);
            if (!payableAccount) {
                throw new common_1.BadRequestException('Accounts Payable ledger account is not seeded for this farm');
            }
            entries.push({ ledgerAccountId: payableAccount.id, credit: outstanding });
        }
        await this.journalService.postJournal({
            farmId,
            sourceType: 'PURCHASE',
            sourceId: purchase.id,
            transactionDate: purchase.purchaseDate,
            description: `Purchase ${purchaseNumber}`,
            idempotencyKey: `purchase:${purchase.id}`,
            createdById: userId,
            entries,
        }, client);
        if ((0, money_1.gt)(outstanding, 0)) {
            const dueDate = dto.dueDate
                ? new Date(dto.dueDate)
                : await this.deriveDueDate(client, dto.supplierId, purchase.purchaseDate);
            await this.payableService.createPayable(farmId, {
                purchaseId: purchase.id,
                supplierId: dto.supplierId ?? null,
                totalAmount: outstanding,
                dueDate,
            }, client);
        }
        this.log.info('Purchase created', {
            farmId,
            purchaseId: purchase.id,
            purchaseNumber,
            lineCount: dto.lines.length,
            totalAmount: totalAmount.toString(),
            paidAmount: paidAmount.toString(),
            outstanding: outstanding.toString(),
        });
        return {
            purchase: await this.getOrThrow(client, farmId, purchase.id),
            newItemNames,
        };
    }
    async createLineAndIncrementStock(client, farmId, userId, purchase, line, lineTotal) {
        const quantity = (0, money_1.toStorage)(line.quantity).toNumber();
        const unitCost = (0, money_1.toStorage)(line.unitCost);
        const target = line.newItem
            ? await this.createNewItem(client, farmId, userId, purchase, line, unitCost.toNumber())
            : {
                medicineId: line.medicineId,
                feedItemId: line.feedItemId,
                equipmentId: line.equipmentId,
            };
        const createdName = line.newItem?.name ?? null;
        if (target.medicineId) {
            const medicine = await client.medicine.findFirst({
                where: { id: target.medicineId, farmId },
                select: { id: true },
            });
            if (!medicine) {
                throw new common_1.NotFoundException('Medicine not found for purchase line');
            }
            const { batchId } = await this.medicineService.createBatch(farmId, userId, medicine.id, {
                batchCode: line.batchCode,
                currentStock: quantity,
                costPerUnit: unitCost.toNumber(),
                purchaseDate: purchase.purchaseDate.toISOString(),
                expiryDate: line.expiryDate,
                notes: `Purchase ${purchase.purchaseNumber}`,
            }, client);
            await client.purchaseLine.create({
                data: {
                    purchaseId: purchase.id,
                    medicineId: medicine.id,
                    medicineBatchId: batchId,
                    quantity: (0, money_1.toStorage)(line.quantity),
                    unitCost,
                    totalAmount: lineTotal,
                },
            });
            return createdName;
        }
        if (target.feedItemId) {
            const feedItem = await client.feedItem.findFirst({
                where: { id: target.feedItemId, farmId },
                select: { id: true },
            });
            if (!feedItem) {
                throw new common_1.NotFoundException('Feed item not found for purchase line');
            }
            const { batchId } = await this.feedItemService.createBatchInTx(farmId, userId, feedItem.id, {
                batchCode: line.batchCode,
                currentStock: quantity,
                costPerUnit: unitCost.toNumber(),
                purchaseDate: purchase.purchaseDate.toISOString(),
                notes: `Purchase ${purchase.purchaseNumber}`,
            }, client);
            await client.purchaseLine.create({
                data: {
                    purchaseId: purchase.id,
                    feedItemId: feedItem.id,
                    feedItemBatchId: batchId,
                    quantity: (0, money_1.toStorage)(line.quantity),
                    unitCost,
                    totalAmount: lineTotal,
                },
            });
            return createdName;
        }
        const equipment = await client.equipment.findFirst({
            where: { id: target.equipmentId ?? undefined, farmId },
            select: { id: true },
        });
        if (!equipment) {
            throw new common_1.NotFoundException('Equipment not found for purchase line');
        }
        await client.purchaseLine.create({
            data: {
                purchaseId: purchase.id,
                equipmentId: equipment.id,
                quantity: (0, money_1.toStorage)(line.quantity),
                unitCost,
                totalAmount: lineTotal,
            },
        });
        await this.equipmentService.adjustStock(farmId, userId, equipment.id, {
            adjustment: quantity,
            reason: client_1.EquipmentStockMovementReason.PURCHASE,
            notes: `Purchase ${purchase.purchaseNumber}`,
        }, client);
        return createdName;
    }
    async createNewItem(client, farmId, userId, purchase, line, unitCost) {
        const item = line.newItem;
        if (item.unitId) {
            const unit = await client.unit.findFirst({
                where: {
                    id: item.unitId,
                    deletedAt: null,
                    OR: [{ farmId: null }, { farmId }],
                },
                select: { id: true },
            });
            if (!unit) {
                throw new common_1.BadRequestException('newItem.unitId not found for this farm');
            }
        }
        switch (item.kind) {
            case 'MEDICINE': {
                const row = await this.medicineService.createCatalogRowInTx(farmId, userId, {
                    name: item.name,
                    type: item.medicineType,
                    category: item.medicineCategory,
                    unitId: item.unitId,
                    manufacturer: item.manufacturer,
                    lowStockThreshold: item.lowStockThreshold,
                    milkWithdrawalDays: item.milkWithdrawalDays,
                    meatWithdrawalDays: item.meatWithdrawalDays,
                    notes: item.notes,
                    purchaseDate: purchase.purchaseDate,
                    expiryDate: new Date(line.expiryDate),
                    costPerUnit: unitCost,
                }, client);
                return { medicineId: row.id };
            }
            case 'FEED': {
                const row = await this.feedItemService.createCatalogRowInTx(farmId, userId, {
                    name: item.name,
                    feedClass: item.feedClass,
                    feedSubType: item.feedSubType,
                    ingredientId: item.ingredientId,
                    nutrition: item.nutrition,
                    unitId: item.unitId,
                    kgPerUnit: item.kgPerUnit,
                    lowStockThreshold: item.lowStockThreshold,
                    notes: item.notes,
                }, client);
                return { feedItemId: row.id };
            }
            case 'EQUIPMENT': {
                const row = await this.equipmentService.createCatalogRowInTx(farmId, userId, {
                    name: item.name,
                    assetId: item.assetId,
                    type: item.equipmentType,
                    unitId: item.unitId,
                    lowStockThreshold: item.lowStockThreshold,
                    notes: item.notes,
                    purchaseDate: purchase.purchaseDate,
                    costPerUnit: unitCost,
                }, client);
                return { equipmentId: row.id };
            }
        }
    }
    async findOne(farmId, id) {
        return this.getOrThrow(this.prisma, farmId, id);
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.supplierId ? { supplierId: query.supplierId } : {}),
            ...(query.from || query.to
                ? {
                    purchaseDate: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
            ...(query.paymentStatus
                ? {
                    ...buildPurchasePaymentStatusWhere(query.paymentStatus),
                    status: { not: client_1.PurchaseStatus.VOIDED },
                }
                : {}),
        };
        const rows = await this.prisma.purchase.findMany({
            where,
            orderBy: [{ purchaseDate: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                _count: { select: { lines: true } },
                payable: { select: { id: true, totalAmount: true, dueDate: true } },
            },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const payableIds = page.items.flatMap((r) => r.payable ? [r.payable.id] : []);
        const sums = payableIds.length
            ? await this.prisma.paymentAllocation.groupBy({
                by: ['payableId'],
                where: { payableId: { in: payableIds } },
                _sum: { amount: true },
            })
            : [];
        const allocatedById = new Map(sums.map((s) => [s.payableId, s._sum.amount ?? 0]));
        const items = page.items.map(({ payable, ...row }) => ({
            ...row,
            ...(0, purchase_payment_1.derivePurchasePayment)(row.totalAmount.toString(), row.status === client_1.PurchaseStatus.VOIDED, payable
                ? {
                    totalAmount: payable.totalAmount.toString(),
                    dueDate: payable.dueDate,
                }
                : null, (allocatedById.get(payable?.id ?? '') ?? 0).toString()),
        }));
        return { items, meta: page.meta };
    }
    async deriveDueDate(client, supplierId, purchaseDate) {
        if (!supplierId) {
            return null;
        }
        const supplier = await client.supplier.findUnique({
            where: { id: supplierId },
            select: { paymentTermsDays: true },
        });
        return (0, due_date_1.derivePayableDueDate)(purchaseDate, supplier?.paymentTermsDays);
    }
    async getOrThrow(client, farmId, id) {
        const purchase = await client.purchase.findFirst({
            where: { id, farmId },
            include: PURCHASE_INCLUDE,
        });
        if (!purchase) {
            throw new common_1.NotFoundException('Purchase not found');
        }
        return purchase;
    }
};
exports.PurchaseService = PurchaseService;
exports.PurchaseService = PurchaseService = PurchaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        purchase_number_allocator_1.PurchaseNumberAllocator,
        journal_service_1.JournalService,
        ledger_account_service_1.LedgerAccountService,
        financial_account_service_1.FinancialAccountService,
        medicine_service_1.MedicineService,
        feed_item_service_1.FeedItemService,
        equipment_service_1.EquipmentService,
        payable_service_1.PayableService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], PurchaseService);
//# sourceMappingURL=purchase.service.js.map