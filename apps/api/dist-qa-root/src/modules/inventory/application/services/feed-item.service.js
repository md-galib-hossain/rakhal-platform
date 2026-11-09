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
var FeedItemService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedItemService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const nutrition_profile_service_1 = require("src/modules/feed/application/services/nutrition-profile.service");
const nutrition_profile_1 = require("src/modules/feed/domain/nutrition-profile");
const medicine_status_1 = require("../../domain/medicine-status");
const unit_service_1 = require("./unit.service");
const inventory_activity_service_1 = require("./inventory-activity.service");
const FIFO_ORDER = [
    { purchaseDate: 'asc' },
    { createdAt: 'asc' },
];
const ITEM_INCLUDE = {
    unit: true,
    batches: {
        where: { deletedAt: null },
        orderBy: FIFO_ORDER,
        include: { nutritionProfile: true },
    },
};
const r6 = (v) => Math.round(v * 1e6) / 1e6;
let FeedItemService = FeedItemService_1 = class FeedItemService {
    prisma;
    activity;
    profiles;
    log;
    constructor(prisma, logger, activity, profiles) {
        this.prisma = prisma;
        this.activity = activity;
        this.profiles = profiles;
        this.log = logger.setContext(FeedItemService_1.name);
    }
    async create(farmId, userId, dto) {
        if (!dto.nutrition && !dto.ingredientId) {
            throw new common_1.BadRequestException('Provide a nutrition profile or link a catalogue ingredient to copy it from');
        }
        if (dto.ingredientId)
            await this.assertIngredientExists(dto.ingredientId);
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const profile = dto.nutrition
                    ? await this.profiles.create(farmId, userId, this.profileInput(dto.nutrition), tx)
                    : await this.profiles.createFromIngredient(farmId, userId, dto.ingredientId, tx);
                const item = await tx.feedItem.create({
                    data: {
                        farmId,
                        name: dto.name,
                        feedClass: dto.feedClass,
                        feedSubType: dto.feedSubType,
                        ingredientId: dto.ingredientId,
                        defaultNutritionProfileId: profile.id,
                        unitId: dto.unitId,
                        kgPerUnit: dto.kgPerUnit,
                        lowStockThreshold: dto.lowStockThreshold ?? 0,
                        supplier: dto.supplier,
                        notes: dto.notes,
                        createdBy: userId,
                    },
                });
                await tx.feedItemBatch.create({
                    data: {
                        feedItemId: item.id,
                        farmId,
                        batchCode: dto.batchCode,
                        currentStock: dto.currentStock,
                        costPerUnit: dto.costPerUnit,
                        purchaseDate: new Date(dto.purchaseDate),
                        nutritionProfileId: profile.id,
                        createdBy: userId,
                    },
                });
                return tx.feedItem.findUniqueOrThrow({
                    where: { id: item.id },
                    include: ITEM_INCLUDE,
                });
            });
            await this.syncIngredientPrice(farmId, userId, created);
            this.log.info('Feed item created', { feedItemId: created.id, farmId });
            await this.activity.record(farmId, userId, 'Feed Item Added', `Feed item "${created.name}" (${created.feedClass}) added — stock ${dto.currentStock} ${created.unit.symbol}.`);
            return this.present(created);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Feed item already exists');
            }
            throw error;
        }
    }
    async createCatalogRowInTx(farmId, userId, input, tx) {
        if (!input.nutrition && !input.ingredientId) {
            throw new common_1.BadRequestException('A new feed item needs a nutrition profile or a catalogue ingredient to copy it from');
        }
        if (input.ingredientId) {
            const found = await tx.feedIngredient.findUnique({
                where: { id: input.ingredientId },
                select: { id: true },
            });
            if (!found)
                throw new common_1.BadRequestException('Linked ingredient not found');
        }
        const profile = input.nutrition
            ? await this.profiles.create(farmId, userId, this.profileInput(input.nutrition), tx)
            : await this.profiles.createFromIngredient(farmId, userId, input.ingredientId, tx);
        return tx.feedItem.create({
            data: {
                farmId,
                name: input.name,
                feedClass: input.feedClass,
                feedSubType: input.feedSubType,
                ingredientId: input.ingredientId,
                defaultNutritionProfileId: profile.id,
                unitId: input.unitId,
                kgPerUnit: input.kgPerUnit,
                lowStockThreshold: input.lowStockThreshold ?? 0,
                supplier: input.supplier,
                notes: input.notes,
                createdBy: userId,
            },
            select: { id: true },
        });
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.feedClass ? { feedClass: query.feedClass } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { supplier: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.feedItem.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            include: ITEM_INCLUDE,
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((feedItem) => this.present(feedItem)),
            meta: page.meta,
        };
    }
    async findOne(farmId, id) {
        const item = await this.getOrThrow(farmId, id);
        const head = this.headBatch(item.batches);
        const differs = head
            ? await this.profiles.differsFromCatalogue(farmId, head.nutritionProfile)
            : null;
        return { ...this.present(item), nutritionDiffersFromCatalogue: differs };
    }
    async update(farmId, userId, id, dto) {
        await this.getOrThrow(farmId, id);
        if (dto.ingredientId)
            await this.assertIngredientExists(dto.ingredientId);
        try {
            const updated = await this.prisma.$transaction(async (tx) => {
                await tx.feedItem.update({
                    where: { id },
                    data: {
                        name: dto.name,
                        feedClass: dto.feedClass,
                        feedSubType: dto.feedSubType,
                        ingredientId: dto.ingredientId,
                        unitId: dto.unitId,
                        kgPerUnit: dto.kgPerUnit,
                        lowStockThreshold: dto.lowStockThreshold,
                        supplier: dto.supplier,
                        notes: dto.notes,
                    },
                });
                if (dto.costPerUnit != null || dto.purchaseDate) {
                    const newest = await tx.feedItemBatch.findFirst({
                        where: { feedItemId: id, deletedAt: null },
                        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
                    });
                    if (newest) {
                        await tx.feedItemBatch.update({
                            where: { id: newest.id },
                            data: {
                                ...(dto.costPerUnit != null
                                    ? { costPerUnit: dto.costPerUnit }
                                    : {}),
                                ...(dto.purchaseDate
                                    ? { purchaseDate: new Date(dto.purchaseDate) }
                                    : {}),
                            },
                        });
                    }
                }
                if (dto.currentStock != null) {
                    const total = await this.batchTotal(tx, id);
                    const delta = r6(dto.currentStock - total);
                    if (delta !== 0) {
                        await this.applyDelta(tx, farmId, userId, id, {
                            delta,
                            reason: client_1.FeedItemStockMovementReason.ADJUSTMENT,
                            notes: 'Stock edited on the feed item',
                        });
                    }
                }
                return tx.feedItem.findUniqueOrThrow({
                    where: { id },
                    include: ITEM_INCLUDE,
                });
            });
            if (dto.costPerUnit != null || dto.kgPerUnit != null) {
                await this.syncIngredientPrice(farmId, userId, updated);
            }
            this.log.info('Feed item updated', { feedItemId: id, farmId });
            await this.activity.record(farmId, userId, 'Feed Item Updated', `Feed item "${updated.name}" updated.`);
            return this.present(updated);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Feed item already exists');
            }
            throw error;
        }
    }
    async archive(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const feedItem = await this.prisma.feedItem.update({
            where: { id },
            data: { deletedAt: new Date() },
            include: ITEM_INCLUDE,
        });
        this.log.info('Feed item archived', { feedItemId: id, farmId });
        await this.activity.record(farmId, userId, 'Feed Item Archived', `Feed item "${feedItem.name}" archived.`);
        return this.present(feedItem);
    }
    async restore(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const feedItem = await this.prisma.feedItem.update({
            where: { id },
            data: { deletedAt: null },
            include: ITEM_INCLUDE,
        });
        this.log.info('Feed item restored', { feedItemId: id, farmId });
        await this.activity.record(farmId, userId, 'Feed Item Restored', `Feed item "${feedItem.name}" restored.`);
        return this.present(feedItem);
    }
    async remove(farmId, id, userId) {
        return this.archive(farmId, id, userId);
    }
    async createBatch(farmId, userId, itemId, dto) {
        const { item: updated } = await this.prisma.$transaction((tx) => this.createLotIn(tx, farmId, userId, itemId, dto));
        await this.syncIngredientPrice(farmId, userId, updated);
        this.log.info('Feed item batch added', {
            feedItemId: itemId,
            farmId,
            stock: dto.currentStock,
        });
        await this.activity.record(farmId, userId, 'Feed Item Restocked', `Feed item "${updated.name}" restocked with ${dto.currentStock} ${updated.unit.symbol}${dto.batchCode ? ` (lot ${dto.batchCode})` : ''}.`);
        return this.present(updated);
    }
    async createBatchInTx(farmId, userId, itemId, dto, tx) {
        const { batchId, item } = await this.createLotIn(tx, farmId, userId, itemId, dto);
        await this.syncIngredientPrice(farmId, userId, item, tx);
        return { batchId };
    }
    async createLotIn(tx, farmId, userId, itemId, dto) {
        const item = await tx.feedItem.findFirst({
            where: { id: itemId, farmId },
            include: ITEM_INCLUDE,
        });
        if (!item)
            throw new common_1.NotFoundException('Feed item not found');
        if (item.deletedAt) {
            throw new common_1.BadRequestException('Cannot restock an archived feed item');
        }
        if (dto.copyFromIngredientId) {
            const found = await tx.feedIngredient.findUnique({
                where: { id: dto.copyFromIngredientId },
                select: { id: true },
            });
            if (!found)
                throw new common_1.BadRequestException('Linked ingredient not found');
        }
        {
            let profileId = null;
            let makeDefault = false;
            if (dto.nutrition) {
                const p = await this.profiles.create(farmId, userId, this.profileInput(dto.nutrition), tx);
                profileId = p.id;
                makeDefault = true;
            }
            else if (dto.copyFromIngredientId) {
                const p = await this.profiles.createFromIngredient(farmId, userId, dto.copyFromIngredientId, tx);
                profileId = p.id;
                makeDefault = true;
            }
            else {
                const newest = await tx.feedItemBatch.findFirst({
                    where: { feedItemId: itemId, deletedAt: null },
                    orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
                    select: { nutritionProfileId: true },
                });
                profileId =
                    item.defaultNutritionProfileId ?? newest?.nutritionProfileId ?? null;
            }
            if (!profileId) {
                throw new common_1.BadRequestException('This item has no nutrition profile yet — provide one for the new batch');
            }
            const batch = await tx.feedItemBatch.create({
                data: {
                    feedItemId: itemId,
                    farmId,
                    batchCode: dto.batchCode,
                    currentStock: dto.currentStock,
                    costPerUnit: dto.costPerUnit,
                    purchaseDate: new Date(dto.purchaseDate),
                    nutritionProfileId: profileId,
                    notes: dto.notes,
                    createdBy: userId,
                },
            });
            const total = await this.batchTotal(tx, itemId);
            if (dto.currentStock > 0) {
                await tx.feedItemStockMovement.create({
                    data: {
                        feedItemId: itemId,
                        feedItemBatchId: batch.id,
                        farmId,
                        reason: client_1.FeedItemStockMovementReason.PURCHASE,
                        delta: dto.currentStock,
                        balanceAfter: total,
                        notes: dto.batchCode ? `Restock, lot ${dto.batchCode}` : 'Restock',
                        createdBy: userId,
                    },
                });
            }
            if (makeDefault) {
                await tx.feedItem.update({
                    where: { id: itemId },
                    data: { defaultNutritionProfileId: profileId },
                });
            }
            return {
                batchId: batch.id,
                item: await tx.feedItem.findUniqueOrThrow({
                    where: { id: itemId },
                    include: ITEM_INCLUDE,
                }),
            };
        }
    }
    async restoreForSaleVoid(farmId, userId, opts, tx) {
        const drawn = await tx.feedItemStockMovement.findMany({
            where: {
                farmId,
                saleLineId: opts.saleLineId,
                reason: client_1.FeedItemStockMovementReason.SALE,
                feedItemBatchId: { not: null },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (drawn.length === 0) {
            await this.adjustStock(farmId, userId, opts.fallbackFeedItemId, {
                adjustment: opts.fallbackQuantity,
                reason: client_1.FeedItemStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
                saleLineId: opts.saleLineId,
            }, tx);
            return;
        }
        for (const movement of drawn) {
            await this.adjustStock(farmId, userId, movement.feedItemId, {
                adjustment: -movement.delta,
                reason: client_1.FeedItemStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
                saleLineId: opts.saleLineId,
                batchId: movement.feedItemBatchId,
            }, tx);
        }
    }
    async previewDraw(farmId, itemId, quantityKg, tx, pinBatchId) {
        const run = async (client) => {
            const found = await client.feedItem.findFirst({
                where: { id: itemId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!found)
                throw new common_1.NotFoundException('Feed item not found');
            const item = await client.feedItem.findUniqueOrThrow({
                where: { id: itemId },
                include: ITEM_INCLUDE,
            });
            const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(item.unit, item.kgPerUnit);
            if (!kgPerUnit || kgPerUnit <= 0) {
                throw new common_1.BadRequestException(`${item.name} has no kg-per-unit conversion set for its ${item.unit.symbol} unit — set "Kg Per Unit" on the feed item before feeding it`);
            }
            const unitsNeeded = r6(quantityKg / kgPerUnit);
            const drawable = pinBatchId
                ? item.batches.filter((b) => b.id === pinBatchId)
                : item.batches;
            if (pinBatchId && drawable.length === 0) {
                throw new common_1.BadRequestException(`The pinned batch of ${item.name} no longer exists`);
            }
            const available = r6(drawable.reduce((s, b) => s + b.currentStock, 0));
            if (unitsNeeded > available) {
                throw new common_1.BadRequestException(`Not enough ${item.name} in stock (${available} ${item.unit.symbol} available, ${Math.round(unitsNeeded * 100) / 100} needed)`);
            }
            const pieces = [];
            let need = unitsNeeded;
            for (const batch of drawable) {
                if (need <= 0)
                    break;
                const take = Math.min(batch.currentStock, need);
                if (take <= 0)
                    continue;
                pieces.push({
                    batchId: batch.id,
                    batchCode: batch.batchCode,
                    nutritionProfileId: batch.nutritionProfileId,
                    profile: batch.nutritionProfile,
                    quantityUnits: r6(take),
                    quantityKg: r6(take * kgPerUnit),
                    costPerUnit: batch.costPerUnit,
                    costTk: r6(take * batch.costPerUnit),
                });
                need = r6(need - take);
            }
            const totalKg = r6(pieces.reduce((s, p) => s + p.quantityKg, 0));
            const totalCost = r6(pieces.reduce((s, p) => s + p.costTk, 0));
            return {
                feedItem: item,
                kgPerUnit,
                pieces,
                pricePerKg: totalKg > 0 ? r6(totalCost / totalKg) : 0,
            };
        };
        return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
    }
    async applyFeedDraw(farmId, userId, itemId, opts, tx) {
        if (opts.quantityUnits <= 0)
            return;
        await this.applyDelta(tx, farmId, userId, itemId, {
            delta: -opts.quantityUnits,
            reason: client_1.FeedItemStockMovementReason.DISTRIBUTION,
            notes: opts.notes,
            batchId: opts.batchId,
            feedDistributionId: opts.distributionId,
            feedDistributionCattleItemId: opts.cattleItemId,
        });
    }
    async restoreFeedDraw(farmId, userId, opts, tx) {
        const drawn = await tx.feedItemStockMovement.findMany({
            where: {
                farmId,
                feedDistributionCattleItemId: opts.cattleItemId,
                reason: client_1.FeedItemStockMovementReason.DISTRIBUTION,
                feedItemBatchId: { not: null },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (drawn.length === 0) {
            const item = await tx.feedItem.findFirst({
                where: { id: opts.fallbackFeedItemId, farmId },
                include: { unit: true },
            });
            if (!item)
                throw new common_1.NotFoundException('Feed item not found');
            const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(item.unit, item.kgPerUnit);
            if (!kgPerUnit || kgPerUnit <= 0) {
                throw new common_1.BadRequestException(`${item.name} has no kg-per-unit conversion — cannot restore its stock`);
            }
            await this.adjustStock(farmId, userId, item.id, {
                adjustment: r6(opts.fallbackQuantityKg / kgPerUnit),
                reason: client_1.FeedItemStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
            }, tx);
            return;
        }
        for (const movement of drawn) {
            await this.adjustStock(farmId, userId, movement.feedItemId, {
                adjustment: -movement.delta,
                reason: client_1.FeedItemStockMovementReason.ADJUSTMENT,
                notes: opts.notes,
                batchId: movement.feedItemBatchId,
            }, tx);
        }
    }
    async findByBatchCode(farmId, code) {
        const rows = await this.prisma.feedItemBatch.findMany({
            where: {
                farmId,
                deletedAt: null,
                batchCode: { equals: code.trim(), mode: 'insensitive' },
            },
            orderBy: FIFO_ORDER,
            include: {
                nutritionProfile: true,
                feedItem: { include: { unit: true } },
            },
        });
        return rows.map((b) => ({
            ...this.presentBatch(b),
            feedItem: {
                id: b.feedItem.id,
                name: b.feedItem.name,
                feedClass: b.feedItem.feedClass,
                unit: b.feedItem.unit,
                deletedAt: b.feedItem.deletedAt,
            },
        }));
    }
    async reviseBatchNutrition(farmId, userId, itemId, batchId, dto) {
        await this.assertBatchBelongs(farmId, itemId, batchId);
        const input = this.profileInput(dto.nutrition);
        await this.profiles.reviseBatch(farmId, userId, batchId, {
            values: input.values,
            nutritionSource: input.nutritionSource,
            sourceRef: input.sourceRef,
            note: input.note,
            expectedUpdatedAt: dto.expectedUpdatedAt,
            makeDefault: dto.makeDefault,
        });
        return this.findOne(farmId, itemId);
    }
    async revertBatchNutrition(farmId, userId, itemId, batchId) {
        await this.assertBatchBelongs(farmId, itemId, batchId);
        await this.profiles.revertBatch(farmId, userId, batchId);
        return this.findOne(farmId, itemId);
    }
    async resyncBatchNutrition(farmId, userId, itemId, batchId) {
        await this.assertBatchBelongs(farmId, itemId, batchId);
        await this.profiles.resyncBatch(farmId, userId, batchId);
        return this.findOne(farmId, itemId);
    }
    async adjustStock(farmId, userId, id, dto, tx) {
        if (dto.adjustment === 0) {
            throw new common_1.BadRequestException('Adjustment must be non-zero');
        }
        const run = async (client) => {
            const exists = await client.feedItem.findFirst({
                where: { id, farmId },
                select: { id: true },
            });
            if (!exists)
                throw new common_1.NotFoundException('Feed item not found');
            await this.applyDelta(client, farmId, userId, id, {
                delta: dto.adjustment,
                reason: dto.reason,
                notes: dto.notes,
                saleLineId: dto.saleLineId,
                batchId: dto.batchId,
            });
            return client.feedItem.findUniqueOrThrow({
                where: { id },
                include: ITEM_INCLUDE,
            });
        };
        const feedItem = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        const presented = this.present(feedItem);
        this.log.info('Feed item stock adjusted', {
            feedItemId: id,
            farmId,
            delta: dto.adjustment,
            balanceAfter: presented.currentStock,
        });
        return presented;
    }
    async removeMany(farmId, ids, userId) {
        const result = await this.prisma.feedItem.updateMany({
            where: { farmId, id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        this.log.info('Feed items bulk-archived', {
            farmId,
            requested: ids.length,
            archived: result.count,
        });
        if (result.count > 0) {
            await this.activity.record(farmId, userId, 'Feed Items Bulk Archived', `${result.count} feed item(s) archived.`);
        }
        return { deleted: result.count };
    }
    async applyDelta(tx, farmId, userId, itemId, opts) {
        const batches = await tx.feedItemBatch.findMany({
            where: { feedItemId: itemId, deletedAt: null },
            orderBy: FIFO_ORDER,
        });
        let running = r6(batches.reduce((s, b) => s + b.currentStock, 0));
        const allocations = [];
        if (opts.batchId) {
            const pinned = batches.find((b) => b.id === opts.batchId);
            if (!pinned)
                throw new common_1.NotFoundException('Feed batch not found');
            if (r6(pinned.currentStock + opts.delta) < 0) {
                throw new common_1.BadRequestException('Stock cannot go below zero');
            }
            allocations.push({ batch: pinned, delta: opts.delta });
        }
        else if (opts.delta > 0) {
            const newest = batches[batches.length - 1];
            if (!newest) {
                throw new common_1.BadRequestException('This item has no batch to credit — restock it with a batch first');
            }
            allocations.push({ batch: newest, delta: opts.delta });
        }
        else {
            let need = -opts.delta;
            if (r6(need - running) > 0) {
                throw new common_1.BadRequestException('Stock cannot go below zero');
            }
            for (const batch of batches) {
                if (need <= 0)
                    break;
                const take = Math.min(batch.currentStock, need);
                if (take <= 0)
                    continue;
                allocations.push({ batch, delta: -take });
                need = r6(need - take);
            }
        }
        for (const { batch, delta } of allocations) {
            const moved = await tx.feedItemBatch.updateMany({
                where: delta < 0
                    ? { id: batch.id, currentStock: { gte: -delta } }
                    : { id: batch.id },
                data: { currentStock: { increment: delta } },
            });
            if (moved.count !== 1) {
                throw new common_1.ConflictException('Stock changed while this was being applied — try again');
            }
            running = r6(running + delta);
            await tx.feedItemStockMovement.create({
                data: {
                    feedItemId: itemId,
                    feedItemBatchId: batch.id,
                    farmId,
                    reason: opts.reason,
                    delta: r6(delta),
                    balanceAfter: running,
                    notes: opts.notes,
                    saleLineId: opts.saleLineId ?? null,
                    feedDistributionId: opts.feedDistributionId ?? null,
                    feedDistributionCattleItemId: opts.feedDistributionCattleItemId ?? null,
                    createdBy: userId,
                },
            });
        }
    }
    async batchTotal(tx, itemId) {
        const agg = await tx.feedItemBatch.aggregate({
            where: { feedItemId: itemId, deletedAt: null },
            _sum: { currentStock: true },
        });
        return r6(agg._sum.currentStock ?? 0);
    }
    async getOrThrow(farmId, id) {
        const feedItem = await this.prisma.feedItem.findFirst({
            where: { id, farmId },
            include: ITEM_INCLUDE,
        });
        if (!feedItem) {
            throw new common_1.NotFoundException('Feed item not found');
        }
        return feedItem;
    }
    async assertBatchBelongs(farmId, itemId, batchId) {
        const batch = await this.prisma.feedItemBatch.findFirst({
            where: { id: batchId, farmId, feedItemId: itemId },
            select: { id: true },
        });
        if (!batch)
            throw new common_1.NotFoundException('Feed batch not found');
    }
    async assertIngredientExists(ingredientId) {
        const found = await this.prisma.feedIngredient.findUnique({
            where: { id: ingredientId },
            select: { id: true },
        });
        if (!found)
            throw new common_1.BadRequestException('Linked ingredient not found');
    }
    headBatch(batches) {
        return (batches.find((b) => b.currentStock > 0) ?? batches[batches.length - 1]);
    }
    profileInput(input) {
        const values = (0, nutrition_profile_1.toNutritionValues)(input);
        return {
            values,
            nutritionSource: input.nutritionSource,
            sourceRef: input.sourceRef ?? null,
            note: input.note ?? null,
        };
    }
    async syncIngredientPrice(farmId, userId, feedItem, client = this.prisma) {
        if (!feedItem.ingredientId)
            return;
        const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(feedItem.unit, feedItem.kgPerUnit);
        if (!kgPerUnit || kgPerUnit <= 0)
            return;
        const newest = feedItem.batches[feedItem.batches.length - 1];
        if (!newest)
            return;
        const pricePerKg = newest.costPerUnit / kgPerUnit;
        const ingredientId = feedItem.ingredientId;
        await client.feedIngredientOverride.upsert({
            where: { farmId_ingredientId: { farmId, ingredientId } },
            update: { customPricePerKg: pricePerKg },
            create: {
                farmId,
                ingredientId,
                createdBy: userId,
                customPricePerKg: pricePerKg,
            },
        });
        this.log.info('Feed ingredient price synced from feed item', {
            farmId,
            ingredientId,
        });
    }
    presentProfile(profile) {
        return {
            id: profile.id,
            dmPct: profile.dmPct,
            cpPct: profile.cpPct,
            meMjPerKgDm: profile.meMjPerKgDm,
            fatPct: profile.fatPct,
            ndfPct: profile.ndfPct,
            adfPct: profile.adfPct,
            rdpPct: profile.rdpPct,
            rupPct: profile.rupPct,
            starchPct: profile.starchPct,
            sugarsPct: profile.sugarsPct,
            calciumPct: profile.calciumPct,
            phosphorusPct: profile.phosphorusPct,
            tdnPct: profile.tdnPct,
            moisturePct: (0, nutrition_profile_1.moisturePctFromDm)(profile.dmPct),
            nutritionSource: profile.nutritionSource,
            sourceRef: profile.sourceRef,
            note: profile.note,
            supersedesId: profile.supersedesId,
            copiedFromIngredientId: profile.copiedFromIngredientId,
            createdAt: profile.createdAt,
        };
    }
    presentBatch(batch) {
        return {
            id: batch.id,
            batchCode: batch.batchCode,
            currentStock: batch.currentStock,
            costPerUnit: batch.costPerUnit,
            purchaseDate: batch.purchaseDate,
            notes: batch.notes,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
            nutritionProfileId: batch.nutritionProfileId,
            nutrition: this.presentProfile(batch.nutritionProfile),
        };
    }
    present(feedItem) {
        const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(feedItem.unit, feedItem.kgPerUnit);
        const head = this.headBatch(feedItem.batches);
        const { batches, ...rest } = feedItem;
        const currentStock = r6(batches.reduce((s, b) => s + b.currentStock, 0));
        const newest = batches[batches.length - 1];
        return {
            ...rest,
            currentStock,
            costPerUnit: newest?.costPerUnit ?? 0,
            purchaseDate: newest?.purchaseDate ?? feedItem.createdAt,
            moisturePct: head ? (0, nutrition_profile_1.moisturePctFromDm)(head.nutritionProfile.dmPct) : null,
            stockStatus: (0, medicine_status_1.computeStockStatus)(currentStock, feedItem.lowStockThreshold),
            kgEquivalent: kgPerUnit != null ? currentStock * kgPerUnit : null,
            nutrition: head ? this.presentProfile(head.nutritionProfile) : null,
            batches: batches.map((b) => this.presentBatch(b)),
        };
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.FeedItemService = FeedItemService;
exports.FeedItemService = FeedItemService = FeedItemService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService,
        nutrition_profile_service_1.NutritionProfileService])
], FeedItemService);
//# sourceMappingURL=feed-item.service.js.map