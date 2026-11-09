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
var MedicineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicineService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const unit_conversion_1 = require("../../domain/unit-conversion");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const media_service_1 = require("src/modules/media/application/services/media.service");
const pagination_1 = require("src/common/pagination");
const medicine_status_1 = require("../../domain/medicine-status");
const inventory_activity_service_1 = require("./inventory-activity.service");
const EXPIRY_SOON_MS = 30 * 24 * 60 * 60 * 1000;
function selectRepresentativeBatch(batches) {
    if (batches.length === 0)
        return null;
    const inStock = batches
        .filter((b) => b.currentStock > 0)
        .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime() ||
        a.id.localeCompare(b.id));
    if (inStock.length > 0)
        return inStock[0];
    return [...batches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
let MedicineService = MedicineService_1 = class MedicineService {
    prisma;
    notificationService;
    media;
    activity;
    log;
    constructor(prisma, notificationService, media, logger, activity) {
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.media = media;
        this.activity = activity;
        this.log = logger.setContext(MedicineService_1.name);
    }
    async create(farmId, userId, dto) {
        const purchaseDate = new Date(dto.purchaseDate);
        const expiryDate = new Date(dto.expiryDate);
        this.assertExpiryAfterPurchase(purchaseDate, expiryDate);
        try {
            const medicine = await this.prisma.$transaction(async (tx) => {
                const created = await tx.medicine.create({
                    data: {
                        farmId,
                        name: dto.name,
                        imageUrl: dto.imageUrl,
                        type: dto.type,
                        category: dto.category,
                        manufacturer: dto.manufacturer,
                        batchId: dto.batchId,
                        unitId: dto.unitId,
                        currentStock: dto.currentStock,
                        costPerUnit: dto.costPerUnit,
                        lowStockThreshold: dto.lowStockThreshold ?? 0,
                        purchaseDate,
                        expiryDate,
                        milkWithdrawalDays: dto.milkWithdrawalDays ?? 0,
                        meatWithdrawalDays: dto.meatWithdrawalDays ?? 0,
                        notes: dto.notes,
                        createdBy: userId,
                    },
                    include: { unit: true },
                });
                const batch = await tx.medicineBatch.create({
                    data: {
                        medicineId: created.id,
                        farmId,
                        batchCode: dto.batchId,
                        currentStock: dto.currentStock,
                        costPerUnit: dto.costPerUnit,
                        purchaseDate,
                        expiryDate,
                        createdBy: userId,
                    },
                });
                if (dto.currentStock > 0) {
                    await tx.medicineStockMovement.create({
                        data: {
                            medicineId: created.id,
                            medicineBatchId: batch.id,
                            farmId,
                            reason: client_1.MedicineStockMovementReason.PURCHASE,
                            delta: dto.currentStock,
                            balanceAfter: dto.currentStock,
                            createdBy: userId,
                            notes: 'Opening stock',
                        },
                    });
                }
                return created;
            });
            this.log.info('Medicine created', { medicineId: medicine.id, farmId });
            await this.activity.record(farmId, userId, 'Medicine Added', `Medicine "${medicine.name}" added — stock ${medicine.currentStock} ${medicine.unit.symbol}.`);
            return this.presentOne(medicine);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Medicine batch already exists');
            }
            throw error;
        }
    }
    async createCatalogRowInTx(farmId, userId, input, tx) {
        this.assertExpiryAfterPurchase(input.purchaseDate, input.expiryDate);
        const created = await tx.medicine.create({
            data: {
                farmId,
                name: input.name,
                type: input.type,
                category: input.category,
                manufacturer: input.manufacturer,
                unitId: input.unitId,
                currentStock: 0,
                costPerUnit: input.costPerUnit,
                lowStockThreshold: input.lowStockThreshold ?? 0,
                purchaseDate: input.purchaseDate,
                expiryDate: input.expiryDate,
                milkWithdrawalDays: input.milkWithdrawalDays ?? 0,
                meatWithdrawalDays: input.meatWithdrawalDays ?? 0,
                notes: input.notes,
                createdBy: userId,
            },
            select: { id: true },
        });
        return created;
    }
    async createBatch(farmId, userId, medicineId, dto, tx) {
        await this.getOrThrow(farmId, medicineId, tx ?? this.prisma);
        const purchaseDate = new Date(dto.purchaseDate);
        const expiryDate = new Date(dto.expiryDate);
        this.assertExpiryAfterPurchase(purchaseDate, expiryDate);
        const write = async (client) => {
            const batch = await client.medicineBatch.create({
                data: {
                    medicineId,
                    farmId,
                    batchCode: dto.batchCode,
                    currentStock: dto.currentStock,
                    costPerUnit: dto.costPerUnit,
                    purchaseDate,
                    expiryDate,
                    notes: dto.notes,
                    createdBy: userId,
                },
            });
            if (dto.currentStock > 0) {
                await client.medicineStockMovement.create({
                    data: {
                        medicineId,
                        medicineBatchId: batch.id,
                        farmId,
                        reason: client_1.MedicineStockMovementReason.PURCHASE,
                        delta: dto.currentStock,
                        balanceAfter: dto.currentStock,
                        createdBy: userId,
                        notes: 'Opening stock (new batch)',
                    },
                });
            }
            await this.syncMedicineAggregate(client, medicineId);
            const medicine = await client.medicine.findUniqueOrThrow({
                where: { id: medicineId },
                include: { unit: true },
            });
            return { medicine, batchId: batch.id };
        };
        const { medicine, batchId } = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        this.log.info('Medicine batch created', { medicineId, batchId, farmId });
        if (!tx) {
            await this.activity.record(farmId, userId, 'Medicine Batch Added', `New batch${dto.batchCode ? ` "${dto.batchCode}"` : ''} of "${medicine.name}" added — ${dto.currentStock} ${medicine.unit.symbol}.`);
        }
        const presented = await this.presentOne(medicine);
        return { ...presented, batchId };
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.category ? { category: query.category } : {}),
            ...this.statusFilter(query.status),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { manufacturer: { contains: query.search, mode: 'insensitive' } },
                        { batchId: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.medicine.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            include: { unit: true },
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: await this.presentList(farmId, page.items),
            meta: page.meta,
        };
    }
    async findOne(farmId, id) {
        return this.presentOne(await this.getOrThrow(farmId, id));
    }
    async findByBatchCode(farmId, code) {
        const batches = await this.prisma.medicineBatch.findMany({
            where: {
                farmId,
                deletedAt: null,
                batchCode: { contains: code, mode: 'insensitive' },
            },
            include: { medicine: { include: { unit: true } } },
            orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        });
        return batches.map((b) => ({
            batchId: b.id,
            batchCode: b.batchCode,
            medicineId: b.medicineId,
            medicineName: b.medicine.name,
            currentStock: b.currentStock,
            costPerUnit: b.costPerUnit,
            purchaseDate: b.purchaseDate,
            expiryDate: b.expiryDate,
            unit: b.medicine.unit.symbol,
        }));
    }
    async update(farmId, id, dto, userId) {
        const existing = await this.getOrThrow(farmId, id);
        const purchaseDate = dto.purchaseDate
            ? new Date(dto.purchaseDate)
            : existing.purchaseDate;
        const expiryDate = dto.expiryDate
            ? new Date(dto.expiryDate)
            : existing.expiryDate;
        this.assertExpiryAfterPurchase(purchaseDate, expiryDate);
        const touchesBatchFields = dto.costPerUnit !== undefined ||
            dto.purchaseDate !== undefined ||
            dto.expiryDate !== undefined ||
            dto.batchId !== undefined;
        try {
            const medicine = await this.prisma.$transaction(async (tx) => {
                await tx.medicine.update({
                    where: { id },
                    data: {
                        name: dto.name,
                        imageUrl: dto.imageUrl,
                        type: dto.type,
                        category: dto.category,
                        manufacturer: dto.manufacturer,
                        batchId: dto.batchId,
                        unitId: dto.unitId,
                        costPerUnit: dto.costPerUnit,
                        lowStockThreshold: dto.lowStockThreshold,
                        ...(dto.purchaseDate ? { purchaseDate } : {}),
                        ...(dto.expiryDate ? { expiryDate } : {}),
                        milkWithdrawalDays: dto.milkWithdrawalDays,
                        meatWithdrawalDays: dto.meatWithdrawalDays,
                        notes: dto.notes,
                    },
                });
                if (touchesBatchFields) {
                    const batch = await this.loadRepresentativeBatch(tx, existing);
                    await tx.medicineBatch.update({
                        where: { id: batch.id },
                        data: {
                            ...(dto.batchId !== undefined ? { batchCode: dto.batchId } : {}),
                            ...(dto.costPerUnit !== undefined
                                ? { costPerUnit: dto.costPerUnit }
                                : {}),
                            ...(dto.purchaseDate ? { purchaseDate } : {}),
                            ...(dto.expiryDate ? { expiryDate } : {}),
                        },
                    });
                    await this.syncMedicineAggregate(tx, id);
                }
                return tx.medicine.findUniqueOrThrow({
                    where: { id },
                    include: { unit: true },
                });
            });
            this.log.info('Medicine updated', { medicineId: id, farmId });
            await this.activity.record(farmId, userId, 'Medicine Updated', `Medicine "${medicine.name}" updated.`);
            return this.presentOne(medicine);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Medicine batch already exists');
            }
            throw error;
        }
    }
    async adjustStock(farmId, userId, id, dto, tx) {
        const existing = await this.getOrThrow(farmId, id);
        if (dto.adjustment === 0) {
            throw new common_1.BadRequestException('Adjustment must be non-zero');
        }
        const write = async (client) => {
            const batch = await this.loadRepresentativeBatch(client, existing);
            const balanceAfter = batch.currentStock + dto.adjustment;
            if (balanceAfter < 0) {
                throw new common_1.BadRequestException('Stock cannot go below zero');
            }
            await client.medicineBatch.update({
                where: { id: batch.id },
                data: { currentStock: balanceAfter },
            });
            await client.medicineStockMovement.create({
                data: {
                    medicineId: id,
                    medicineBatchId: batch.id,
                    farmId,
                    reason: dto.reason,
                    delta: dto.adjustment,
                    balanceAfter,
                    notes: dto.notes,
                    saleLineId: dto.saleLineId ?? null,
                    createdBy: userId,
                },
            });
            await this.syncMedicineAggregate(client, id);
            return client.medicine.findUniqueOrThrow({
                where: { id },
                include: { unit: true },
            });
        };
        const medicine = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        this.log.info('Medicine stock adjusted', {
            medicineId: id,
            farmId,
            delta: dto.adjustment,
            balanceAfter: medicine.currentStock,
        });
        await this.maybeAlertLowStock(farmId, medicine.name, medicine.lowStockThreshold, existing.currentStock, medicine.currentStock);
        return this.presentOne(medicine);
    }
    async adjustStockManual(farmId, userId, id, dto) {
        const medicine = await this.adjustStock(farmId, userId, id, dto);
        const sign = dto.adjustment > 0 ? '+' : '';
        await this.activity.record(farmId, userId, 'Medicine Stock Adjusted', `Medicine "${medicine.name}" stock adjusted ${sign}${dto.adjustment} ${medicine.unit.symbol} (${dto.reason})${dto.notes ? ` — ${dto.notes}` : ''}.`);
        return medicine;
    }
    async decrementForTreatment(farmId, userId, opts) {
        if (!opts.quantity || opts.quantity <= 0) {
            throw new common_1.BadRequestException('Treatment quantity must be greater than 0');
        }
        let medicines;
        if (opts.medicineId) {
            medicines = [await this.getOrThrow(farmId, opts.medicineId)];
        }
        else {
            if (!opts.medicineName) {
                throw new common_1.BadRequestException('A medicineId or medicineName is required to deduct treatment stock');
            }
            medicines = await this.prisma.medicine.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    name: { equals: opts.medicineName, mode: 'insensitive' },
                },
            });
            if (medicines.length === 0) {
                throw new common_1.BadRequestException(`No in-stock, non-expired batch found for medicine "${opts.medicineName}"`);
            }
        }
        let quantity = opts.quantity;
        if (opts.doseUnitId) {
            const [doseUnit, medUnit] = await Promise.all([
                this.prisma.unit.findUnique({ where: { id: opts.doseUnitId } }),
                this.prisma.unit.findUnique({ where: { id: medicines[0].unitId } }),
            ]);
            if (doseUnit && medUnit) {
                try {
                    quantity = (0, unit_conversion_1.convertQuantity)(quantity, doseUnit, medUnit);
                }
                catch {
                    throw new common_1.BadRequestException(`Dose unit ${doseUnit.symbol} cannot be converted to the stock unit ${medUnit.symbol}`);
                }
            }
        }
        return this.decrementFromCatalogBatches(farmId, userId, medicines, quantity, {
            reason: client_1.MedicineStockMovementReason.TREATMENT,
            notes: opts.notes,
            defaultNoteLabel: 'Treatment administered',
            excludeExpired: true,
            insufficientStockMessage: 'Not enough medicine stock for this treatment',
            noBatchMessage: 'No in-stock, non-expired batch found for this medicine',
        });
    }
    async decrementForSale(farmId, userId, opts, tx) {
        if (!opts.quantity || opts.quantity <= 0) {
            throw new common_1.BadRequestException('Sale quantity must be greater than 0');
        }
        const medicine = await this.getOrThrow(farmId, opts.medicineId);
        return this.decrementFromCatalogBatches(farmId, userId, [medicine], opts.quantity, {
            reason: client_1.MedicineStockMovementReason.SALE,
            saleLineId: opts.saleLineId,
            notes: opts.notes,
            defaultNoteLabel: 'Sold via SellInventoryItem',
            excludeExpired: false,
            insufficientStockMessage: 'Insufficient stock for this sale',
            noBatchMessage: 'No in-stock batch found for this medicine',
        }, tx);
    }
    async adjustBatchStock(farmId, userId, medicineBatchId, delta, reason, notes, tx) {
        const write = async (client) => {
            const batch = await client.medicineBatch.findFirst({
                where: { id: medicineBatchId, farmId, deletedAt: null },
            });
            if (!batch) {
                throw new common_1.NotFoundException('Medicine batch not found');
            }
            const balanceAfter = batch.currentStock + delta;
            if (balanceAfter < 0) {
                throw new common_1.BadRequestException('Stock cannot go below zero');
            }
            await client.medicineBatch.update({
                where: { id: batch.id },
                data: { currentStock: balanceAfter },
            });
            await client.medicineStockMovement.create({
                data: {
                    medicineId: batch.medicineId,
                    medicineBatchId: batch.id,
                    farmId,
                    reason,
                    delta,
                    balanceAfter,
                    notes,
                    createdBy: userId,
                },
            });
            await this.syncMedicineAggregate(client, batch.medicineId);
        };
        if (tx) {
            await write(tx);
        }
        else {
            await this.prisma.$transaction((t) => write(t));
        }
    }
    async restoreForSaleVoid(farmId, userId, opts, tx) {
        const write = async (client) => {
            const movements = await client.medicineStockMovement.findMany({
                where: {
                    farmId,
                    saleLineId: opts.saleLineId,
                    reason: client_1.MedicineStockMovementReason.SALE,
                    medicineBatchId: { not: null },
                },
            });
            if (movements.length === 0) {
                return false;
            }
            const affectedMedicineIds = new Set();
            for (const movement of movements) {
                const batch = await client.medicineBatch.findFirst({
                    where: { id: movement.medicineBatchId, farmId },
                });
                if (!batch)
                    continue;
                const restored = Math.abs(movement.delta);
                const balanceAfter = batch.currentStock + restored;
                await client.medicineBatch.update({
                    where: { id: batch.id },
                    data: { currentStock: balanceAfter },
                });
                await client.medicineStockMovement.create({
                    data: {
                        medicineId: batch.medicineId,
                        medicineBatchId: batch.id,
                        farmId,
                        reason: client_1.MedicineStockMovementReason.ADJUSTMENT,
                        delta: restored,
                        balanceAfter,
                        notes: opts.notes,
                        saleLineId: opts.saleLineId,
                        createdBy: userId,
                    },
                });
                affectedMedicineIds.add(batch.medicineId);
            }
            for (const medicineId of affectedMedicineIds) {
                await this.syncMedicineAggregate(client, medicineId);
            }
            return movements.length > 0;
        };
        const restoredPrecisely = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        if (!restoredPrecisely) {
            await this.adjustStock(farmId, userId, opts.fallbackMedicineId, {
                adjustment: opts.fallbackQuantity,
                reason: client_1.MedicineStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
                saleLineId: opts.saleLineId,
            }, tx);
        }
    }
    async restoreForTreatmentVoid(farmId, userId, opts, tx) {
        const write = async (client) => {
            const movements = await client.medicineStockMovement.findMany({
                where: {
                    farmId,
                    treatmentLogId: opts.treatmentLogId,
                    medicineBatchId: { not: null },
                },
            });
            const consumed = movements.filter((m) => m.delta < 0);
            const alreadyRestored = movements.some((m) => m.delta > 0);
            if (consumed.length === 0)
                return 'none';
            if (alreadyRestored)
                return 'done';
            const affectedMedicineIds = new Set();
            for (const movement of consumed) {
                const batch = await client.medicineBatch.findFirst({
                    where: { id: movement.medicineBatchId, farmId },
                });
                if (!batch)
                    continue;
                const restored = Math.abs(movement.delta);
                const balanceAfter = batch.currentStock + restored;
                await client.medicineBatch.update({
                    where: { id: batch.id },
                    data: { currentStock: balanceAfter },
                });
                await client.medicineStockMovement.create({
                    data: {
                        medicineId: batch.medicineId,
                        medicineBatchId: batch.id,
                        farmId,
                        reason: client_1.MedicineStockMovementReason.ADJUSTMENT,
                        delta: restored,
                        balanceAfter,
                        notes: opts.notes,
                        treatmentLogId: opts.treatmentLogId,
                        createdBy: userId,
                    },
                });
                affectedMedicineIds.add(batch.medicineId);
            }
            for (const medicineId of affectedMedicineIds) {
                await this.syncMedicineAggregate(client, medicineId);
            }
            return 'restored';
        };
        const outcome = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        if (outcome === 'restored')
            return { restored: true };
        if (outcome === 'done')
            return { restored: false };
        if (opts.fallbackMedicineId &&
            opts.fallbackQuantity &&
            opts.fallbackQuantity > 0) {
            await this.adjustStock(farmId, userId, opts.fallbackMedicineId, {
                adjustment: opts.fallbackQuantity,
                reason: client_1.MedicineStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
            }, tx);
            return { restored: true };
        }
        return { restored: false };
    }
    async decrementFromCatalogBatches(farmId, userId, medicines, quantity, opts, tx) {
        const medicineById = new Map(medicines.map((m) => [m.id, m]));
        await this.prisma.$transaction(async (heal) => {
            for (const medicine of medicines) {
                await this.ensureBatchExists(heal, medicine);
            }
        });
        const readClient = tx ?? this.prisma;
        const batches = await readClient.medicineBatch.findMany({
            where: {
                medicineId: { in: [...medicineById.keys()] },
                farmId,
                deletedAt: null,
                currentStock: { gt: 0 },
                ...(opts.excludeExpired ? { expiryDate: { gte: new Date() } } : {}),
            },
            orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        });
        if (batches.length === 0) {
            throw new common_1.BadRequestException(opts.noBatchMessage);
        }
        const totalAvailable = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
        if (totalAvailable < quantity) {
            throw new common_1.BadRequestException(opts.insufficientStockMessage);
        }
        let remaining = quantity;
        const plan = [];
        for (const batch of batches) {
            if (remaining <= 0)
                break;
            const draw = Math.min(batch.currentStock, remaining);
            plan.push({ batch, draw, balanceAfter: batch.currentStock - draw });
            remaining -= draw;
        }
        const isSplit = plan.length > 1;
        const affectedMedicineIds = [
            ...new Set(plan.map((p) => p.batch.medicineId)),
        ];
        const movementIds = [];
        const write = async (client) => {
            for (const { batch, draw, balanceAfter } of plan) {
                await client.medicineBatch.update({
                    where: { id: batch.id },
                    data: { currentStock: balanceAfter },
                });
                const movement = await client.medicineStockMovement.create({
                    data: {
                        medicineId: batch.medicineId,
                        medicineBatchId: batch.id,
                        farmId,
                        reason: opts.reason,
                        delta: -draw,
                        balanceAfter,
                        notes: isSplit
                            ? `${opts.notes ?? opts.defaultNoteLabel} (cross-batch split: ${draw} of ${quantity})`
                            : (opts.notes ?? opts.defaultNoteLabel),
                        saleLineId: opts.saleLineId ?? null,
                        createdBy: userId,
                    },
                });
                movementIds.push(movement.id);
            }
            for (const medicineId of affectedMedicineIds) {
                await this.syncMedicineAggregate(client, medicineId);
            }
        };
        if (tx) {
            await write(tx);
        }
        else {
            await this.prisma.$transaction((t) => write(t));
        }
        this.log.info('Medicine decremented', {
            farmId,
            quantity,
            reason: opts.reason,
            batchesUsed: plan.map((p) => p.batch.id),
            split: isSplit,
        });
        const freshMedicines = await readClient.medicine.findMany({
            where: { id: { in: affectedMedicineIds } },
        });
        for (const fresh of freshMedicines) {
            const before = medicineById.get(fresh.id);
            await this.maybeAlertLowStock(farmId, fresh.name, fresh.lowStockThreshold, before.currentStock, fresh.currentStock);
        }
        const primary = plan[0];
        const totalCost = plan.reduce((sum, { batch, draw }) => sum + batch.costPerUnit * draw, 0);
        return {
            medicineId: primary.batch.medicineId,
            batchId: primary.batch.batchCode,
            balanceAfter: primary.balanceAfter,
            costPerUnit: primary.batch.costPerUnit,
            totalCost,
            movementIds,
            batchesUsed: plan.map(({ batch, draw, balanceAfter }) => ({
                medicineId: batch.medicineId,
                batchId: batch.batchCode,
                quantity: draw,
                balanceAfter,
                costPerUnit: batch.costPerUnit,
            })),
        };
    }
    async maybeAlertLowStock(farmId, medicineName, threshold, totalBefore, totalAfter) {
        if (threshold > 0 && totalBefore > threshold && totalAfter <= threshold) {
            await this.notificationService.notifyOwnersAndManagers({
                farmId,
                eventKey: 'low_medicine_stock',
                title: 'Low Medicine Stock',
                message: `${medicineName} is low: ${totalAfter} left (alert threshold ${threshold}).`,
                params: {
                    name: medicineName,
                    balance: totalAfter,
                    threshold,
                },
                link: '/inventory/medicine',
            });
        }
    }
    async archive(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const medicine = await this.prisma.medicine.update({
            where: { id },
            data: { deletedAt: new Date() },
            include: { unit: true },
        });
        this.log.info('Medicine archived', { medicineId: id, farmId });
        await this.activity.record(farmId, userId, 'Medicine Archived', `Medicine "${medicine.name}" archived.`);
        return this.presentOne(medicine);
    }
    async restore(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const medicine = await this.prisma.medicine.update({
            where: { id },
            data: { deletedAt: null },
            include: { unit: true },
        });
        this.log.info('Medicine restored', { medicineId: id, farmId });
        await this.activity.record(farmId, userId, 'Medicine Restored', `Medicine "${medicine.name}" restored.`);
        return this.presentOne(medicine);
    }
    async remove(farmId, id, userId) {
        return this.archive(farmId, id, userId);
    }
    async removeMany(farmId, ids, userId) {
        const result = await this.prisma.medicine.updateMany({
            where: { farmId, id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        this.log.info('Medicines bulk-archived', {
            farmId,
            requested: ids.length,
            archived: result.count,
        });
        if (result.count > 0) {
            await this.activity.record(farmId, userId, 'Medicines Bulk Archived', `${result.count} medicine(s) archived.`);
        }
        return { deleted: result.count };
    }
    async setPhoto(farmId, userId, id, file) {
        const medicine = await this.getOrThrow(farmId, id);
        const asset = await this.media.uploadImage({
            farmId,
            uploadedByUserId: userId,
            category: client_1.MediaCategory.MEDICINE,
            usage: client_1.MediaUsage.PRODUCT_PHOTO,
            file,
        });
        const previousId = medicine.photoAssetId;
        await this.prisma.medicine.update({
            where: { id },
            data: { photoAssetId: asset.id },
        });
        if (previousId && previousId !== asset.id) {
            await this.media
                .softDeleteById(farmId, previousId, userId)
                .catch(() => undefined);
        }
        this.log.info('Medicine photo uploaded', { medicineId: id, farmId });
        await this.activity.record(farmId, userId, 'Medicine Photo Updated', `Photo ${previousId ? 'replaced' : 'added'} for medicine "${medicine.name}".`);
        return this.media.signUrls(asset, true);
    }
    async getPhoto(farmId, id) {
        const medicine = await this.getOrThrow(farmId, id);
        if (!medicine.photoAssetId)
            return null;
        return this.media.presentUrls(farmId, medicine.photoAssetId, true);
    }
    async removePhoto(farmId, userId, id) {
        const medicine = await this.getOrThrow(farmId, id);
        if (!medicine.photoAssetId)
            return { removed: false };
        await this.prisma.medicine.update({
            where: { id },
            data: { photoAssetId: null },
        });
        await this.media
            .softDeleteById(farmId, medicine.photoAssetId, userId)
            .catch(() => undefined);
        this.log.info('Medicine photo removed', { medicineId: id, farmId });
        await this.activity.record(farmId, userId, 'Medicine Photo Removed', `Photo removed from medicine "${medicine.name}".`);
        return { removed: true };
    }
    async getOrThrow(farmId, id, client = this.prisma) {
        const medicine = await client.medicine.findFirst({
            where: { id, farmId },
            include: { unit: true },
        });
        if (!medicine) {
            this.log.warn('Medicine not found', { medicineId: id, farmId });
            throw new common_1.NotFoundException('Medicine not found');
        }
        return medicine;
    }
    async syncMedicineAggregate(client, medicineId) {
        const batches = await client.medicineBatch.findMany({
            where: { medicineId, deletedAt: null },
        });
        const totalStock = batches.reduce((sum, b) => sum + b.currentStock, 0);
        const representative = selectRepresentativeBatch(batches);
        await client.medicine.update({
            where: { id: medicineId },
            data: {
                currentStock: totalStock,
                ...(representative
                    ? {
                        costPerUnit: representative.costPerUnit,
                        purchaseDate: representative.purchaseDate,
                        expiryDate: representative.expiryDate,
                        batchId: representative.batchCode,
                    }
                    : {}),
            },
        });
    }
    async loadRepresentativeBatch(client, medicine) {
        await this.ensureBatchExists(client, medicine);
        const batches = await client.medicineBatch.findMany({
            where: { medicineId: medicine.id, deletedAt: null },
        });
        return selectRepresentativeBatch(batches);
    }
    async ensureBatchExists(client, medicine) {
        const count = await client.medicineBatch.count({
            where: { medicineId: medicine.id, deletedAt: null },
        });
        if (count > 0)
            return;
        await client.medicineBatch.create({
            data: {
                medicineId: medicine.id,
                farmId: medicine.farmId,
                batchCode: medicine.batchId,
                currentStock: medicine.currentStock,
                costPerUnit: medicine.costPerUnit,
                purchaseDate: medicine.purchaseDate,
                expiryDate: medicine.expiryDate,
                createdBy: medicine.createdBy,
            },
        });
    }
    statusFilter(status) {
        if (!status)
            return {};
        const now = new Date();
        if (status === 'expired') {
            return { expiryDate: { lt: now } };
        }
        if (status === 'expiring_soon') {
            return {
                expiryDate: { gte: now, lte: new Date(now.getTime() + EXPIRY_SOON_MS) },
            };
        }
        return { expiryDate: { gte: now } };
    }
    async presentOne(medicine) {
        const resolvedImageUrl = medicine.photoAssetId
            ? await this.media
                .presentUrls(medicine.farmId, medicine.photoAssetId, false)
                .then((urls) => urls.thumb_url)
                .catch(() => medicine.imageUrl)
            : medicine.imageUrl;
        return {
            ...medicine,
            imageUrl: resolvedImageUrl,
            stockStatus: (0, medicine_status_1.computeStockStatus)(medicine.currentStock, medicine.lowStockThreshold),
            expiryStatus: (0, medicine_status_1.computeExpiryStatus)(medicine.expiryDate),
        };
    }
    async presentList(farmId, medicines) {
        const ids = medicines
            .map((m) => m.photoAssetId)
            .filter((id) => Boolean(id));
        const signed = ids.length > 0
            ? await this.media.signThumbs(farmId, ids)
            : new Map();
        return medicines.map((medicine) => ({
            ...medicine,
            imageUrl: medicine.photoAssetId
                ? (signed.get(medicine.photoAssetId)?.thumb_url ?? medicine.imageUrl)
                : medicine.imageUrl,
            stockStatus: (0, medicine_status_1.computeStockStatus)(medicine.currentStock, medicine.lowStockThreshold),
            expiryStatus: (0, medicine_status_1.computeExpiryStatus)(medicine.expiryDate),
        }));
    }
    assertExpiryAfterPurchase(purchaseDate, expiryDate) {
        if (expiryDate.getTime() <= purchaseDate.getTime()) {
            throw new common_1.BadRequestException('Expiry date must be after the purchase date');
        }
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.MedicineService = MedicineService;
exports.MedicineService = MedicineService = MedicineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        media_service_1.MediaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService])
], MedicineService);
//# sourceMappingURL=medicine.service.js.map