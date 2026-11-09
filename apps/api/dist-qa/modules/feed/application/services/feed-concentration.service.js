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
var FeedConcentrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedConcentrationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const formula_math_1 = require("../../domain/formula-math");
const requirements_1 = require("../../domain/requirements");
const requirement_settings_service_1 = require("./requirement-settings.service");
const feed_stock_service_1 = require("./feed-stock.service");
const feed_requirements_service_1 = require("./feed-requirements.service");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
const feed_distribution_service_1 = require("./feed-distribution.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const unit_service_1 = require("src/modules/inventory/application/services/unit.service");
const recipe_line_1 = require("../../domain/recipe-line");
const round2 = (v) => Math.round(v * 100) / 100;
const lineRef = (i) => ({
    ingredientId: i.ingredientId ?? null,
    feedItemId: i.feedItemId ?? null,
    feedItemBatchId: i.feedItemBatchId ?? null,
});
let FeedConcentrationService = FeedConcentrationService_1 = class FeedConcentrationService {
    prisma;
    logger;
    feedStock;
    feedRequirements;
    requirementSettings;
    feedDistribution;
    lotResolver;
    feedItems;
    log;
    constructor(prisma, logger, feedStock, feedRequirements, requirementSettings, feedDistribution, lotResolver, feedItems) {
        this.prisma = prisma;
        this.logger = logger;
        this.feedStock = feedStock;
        this.feedRequirements = feedRequirements;
        this.requirementSettings = requirementSettings;
        this.feedDistribution = feedDistribution;
        this.lotResolver = lotResolver;
        this.feedItems = feedItems;
        this.log = this.logger.setContext(FeedConcentrationService_1.name);
    }
    async list(farmId, kind, includeArchived = false) {
        const rows = await this.prisma.feedConcentration.findMany({
            where: {
                farmId,
                ...(includeArchived ? {} : { deletedAt: null }),
                ...(kind ? { kind } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        const finalizedIds = await this.finalizedIds(farmId, rows.map((r) => ({ id: r.id, kind: r.kind })));
        const [requirements, effById] = await Promise.all([
            this.feedRequirements.resolveForConcentrations(farmId, rows),
            this.effectiveLineMap(farmId, rows.flatMap((r) => r.items)),
        ]);
        return Promise.all(rows.map((r) => this.enrich(farmId, r, false, finalizedIds, requirements.get(r.id) ?? null, effById)));
    }
    async get(farmId, id) {
        const row = await this.getOrThrow(farmId, id);
        const finalizedIds = await this.finalizedIds(farmId, [
            { id: row.id, kind: row.kind },
        ]);
        return this.enrich(farmId, row, true, finalizedIds);
    }
    async finalizedIds(farmId, rows) {
        const templateIds = rows
            .filter((r) => r.kind === 'CONCENTRATE_TEMPLATE')
            .map((r) => r.id);
        const mixtureIds = rows
            .filter((r) => r.kind === 'FEED_MIXTURE')
            .map((r) => r.id);
        const [ingredientRows, stockRows] = await Promise.all([
            this.prisma.feedIngredient.findMany({
                where: { farmId, sourceConcentrationId: { in: templateIds } },
                select: { sourceConcentrationId: true },
            }),
            this.prisma.feedStock.findMany({
                where: { farmId, sourceConcentrationId: { in: mixtureIds } },
                select: { sourceConcentrationId: true },
                distinct: ['sourceConcentrationId'],
            }),
        ]);
        return new Set([
            ...ingredientRows.map((r) => r.sourceConcentrationId),
            ...stockRows.map((r) => r.sourceConcentrationId),
        ]);
    }
    async create(farmId, userId, dto) {
        const isTemplate = dto.kind === 'CONCENTRATE_TEMPLATE';
        const targetType = isTemplate ? undefined : dto.targetType;
        const cattleId = isTemplate ? undefined : dto.cattleId;
        let targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
        let targetMilkL = isTemplate ? undefined : dto.targetMilkL;
        if (!isTemplate && (targetWeightKg == null || targetMilkL == null)) {
            if (cattleId) {
                const resolved = await this.feedRequirements.calc(farmId, {
                    cattleId,
                    weightKg: targetWeightKg,
                    milkTargetL: targetMilkL,
                });
                targetWeightKg ??= resolved.inputs.weight_kg;
                targetMilkL ??= resolved.inputs.milk_target_l;
            }
            if (targetWeightKg == null || targetMilkL == null) {
                throw new common_1.BadRequestException('A Total Mixed Ration requires targetWeightKg and targetMilkL — supply them manually or target a cow with a real weight record');
            }
        }
        await this.validateTargets(farmId, cattleId);
        this.assertLineIdentity(dto.items);
        await this.assertIngredients(dto.items.map((i) => i.ingredientId));
        await this.assertBatchLinks(farmId, dto.items);
        if (!isTemplate) {
            await this.assertHasConcentrateDerivedLine(dto.items);
        }
        const created = await this.prisma.feedConcentration.create({
            data: {
                farmId,
                kind: dto.kind,
                name: dto.name,
                durationDays: dto.durationDays,
                targetType,
                cattleId,
                targetWeightKg,
                targetMilkL,
                createdBy: userId,
                items: {
                    create: dto.items.map((i) => ({
                        ingredientId: i.ingredientId,
                        amountKg: i.amountKg,
                        feedItemId: i.feedItemId,
                        feedItemBatchId: i.feedItemBatchId,
                        feedStockId: i.feedStockId,
                    })),
                },
            },
            include: { items: true },
        });
        this.log.info('Feed concentration created', {
            farmId,
            id: created.id,
            kind: created.kind,
        });
        return this.enrich(farmId, created, true);
    }
    async update(farmId, id, dto) {
        const existing = await this.getOrThrow(farmId, id);
        const isTemplate = existing.kind === 'CONCENTRATE_TEMPLATE';
        const targetType = isTemplate ? undefined : dto.targetType;
        const cattleId = isTemplate ? undefined : dto.cattleId;
        const targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
        const targetMilkL = isTemplate ? undefined : dto.targetMilkL;
        await this.validateTargets(farmId, cattleId);
        if (dto.items) {
            this.assertLineIdentity(dto.items);
            await this.assertIngredients(dto.items.map((i) => i.ingredientId));
            await this.assertBatchLinks(farmId, dto.items);
            if (!isTemplate) {
                await this.assertHasConcentrateDerivedLine(dto.items);
            }
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            if (dto.items) {
                await tx.feedConcentrationItem.deleteMany({
                    where: { concentrationId: id },
                });
                await tx.feedConcentrationItem.createMany({
                    data: dto.items.map((i) => ({
                        concentrationId: id,
                        ingredientId: i.ingredientId,
                        amountKg: i.amountKg,
                        feedItemId: i.feedItemId,
                        feedItemBatchId: i.feedItemBatchId,
                        feedStockId: i.feedStockId,
                    })),
                });
            }
            return tx.feedConcentration.update({
                where: { id },
                data: {
                    name: dto.name,
                    durationDays: dto.durationDays,
                    targetType,
                    cattleId,
                    targetWeightKg,
                    targetMilkL,
                },
                include: { items: true },
            });
        });
        if (isTemplate) {
            await this.refreshPromotedIngredientIfExists(farmId, updated);
        }
        this.log.info('Feed concentration updated', { farmId, id });
        return this.enrich(farmId, updated, true);
    }
    async remove(farmId, id) {
        await this.getOrThrow(farmId, id);
        await this.prisma.$transaction([
            this.prisma.feedConcentration.update({
                where: { id },
                data: { deletedAt: new Date() },
            }),
            this.prisma.feedIngredient.updateMany({
                where: { sourceConcentrationId: id, deletedAt: null },
                data: { deletedAt: new Date() },
            }),
        ]);
        this.log.info('Feed concentration archived', { farmId, id });
        return { id, archived: true };
    }
    async removeMany(farmId, ids) {
        const [result] = await this.prisma.$transaction([
            this.prisma.feedConcentration.updateMany({
                where: { farmId, id: { in: ids }, deletedAt: null },
                data: { deletedAt: new Date() },
            }),
            this.prisma.feedIngredient.updateMany({
                where: { sourceConcentrationId: { in: ids }, deletedAt: null },
                data: { deletedAt: new Date() },
            }),
        ]);
        this.log.info('Feed concentrations bulk-archived', {
            farmId,
            requested: ids.length,
            archived: result.count,
        });
        return { deleted: result.count };
    }
    async finalize(farmId, userId, id, batchQuantityKg) {
        const row = await this.getOrThrow(farmId, id);
        if (row.items.length === 0) {
            throw new common_1.BadRequestException('Cannot finalize an empty concentration — add ingredients first');
        }
        const effById = await this.effectiveLineMap(farmId, row.items);
        const lines = this.formulaLines(row.items);
        const { totals } = (0, formula_math_1.computeTotals)(lines, effById);
        const totalAsFedKg = row.items.reduce((sum, i) => sum + i.amountKg, 0);
        if (totalAsFedKg <= 0 || totals.dm_kg <= 0) {
            throw new common_1.BadRequestException('Concentration has no measurable dry matter to promote');
        }
        const inventory = await this.resolveInventoryLines(farmId, row.items);
        const missing = inventory.filter((l) => l.status === 'MISSING');
        if (missing.length > 0) {
            throw new common_1.BadRequestException(`Not in inventory yet: ${missing.map((m) => m.name).join(', ')}. Add ${missing.length === 1 ? 'it' : 'them'} to Inventory before finalizing.`);
        }
        const resolvedItems = row.items.map((it) => {
            const hit = inventory.find((l) => l.item.id === it.id);
            return hit?.source === 'MATCHED'
                ? { ...it, feedItemId: hit.feedItemId, feedStockId: hit.feedStockId }
                : it;
        });
        const deductions = await this.resolveBatchDeductions(farmId, userId, row.id, resolvedItems, effById);
        const correctedTotalCostTk = round2(deductions.linkedCostTk);
        let ingredientResult = null;
        let stock = null;
        if (row.kind === 'CONCENTRATE_TEMPLATE') {
            const nutrition = this.buildIngredientNutrition(row.name, totals, totalAsFedKg);
            const ingredient = await this.prisma.$transaction(async (tx) => {
                const existing = await tx.feedIngredient.findFirst({
                    where: { sourceConcentrationId: row.id },
                });
                if (existing) {
                    return tx.feedIngredient.update({
                        where: { id: existing.id },
                        data: { ...nutrition, deletedAt: null },
                    });
                }
                return tx.feedIngredient.create({
                    data: {
                        farmId,
                        ...nutrition,
                        isSystemDefault: false,
                        isAvailableBd: true,
                        sourceConcentrationId: row.id,
                        sourceConcentrationVersion: 1,
                        isLatestVersion: true,
                    },
                });
            });
            this.log.info('Feed concentration promoted/refreshed into a reusable ingredient', {
                farmId,
                concentrationId: row.id,
                ingredientId: ingredient.id,
                userId,
            });
            ingredientResult = this.mapIngredient(ingredient);
            const qtyKg = batchQuantityKg ?? totalAsFedKg;
            if (qtyKg <= 0) {
                throw new common_1.BadRequestException('batchQuantityKg must be greater than zero');
            }
            stock = await this.prisma.$transaction(async (tx) => {
                await this.applyBatchDeductions(farmId, userId, tx, deductions);
                return this.feedStock.produceFromConcentration(farmId, userId, {
                    concentrationId: row.id,
                    version: 1,
                    qtyKg,
                    costTk: correctedTotalCostTk,
                    nutrition: this.buildStockNutritionSnapshot(totals, totalAsFedKg),
                    kind: 'CONCENTRATE_TEMPLATE',
                }, tx);
            });
            this.log.info('Concentrate Mixer finalize produced a FeedStock batch', {
                farmId,
                concentrationId: row.id,
                stockId: stock.id,
                qtyKg,
                userId,
            });
        }
        if (row.kind === 'FEED_MIXTURE') {
            stock = await this.prisma.$transaction(async (tx) => {
                await this.applyBatchDeductions(farmId, userId, tx, deductions);
                return this.feedStock.produceFromConcentration(farmId, userId, {
                    concentrationId: row.id,
                    version: 1,
                    qtyKg: totalAsFedKg,
                    costTk: correctedTotalCostTk,
                    nutrition: this.buildStockNutritionSnapshot(totals, totalAsFedKg),
                    kind: 'FEED_MIXTURE',
                }, tx);
            });
        }
        if (row.kind === 'FEED_MIXTURE') {
            const hasVersion = await this.prisma.feedConcentrationVersion.findFirst({
                where: { concentrationId: row.id },
                select: { id: true },
            });
            if (!hasVersion) {
                await this.saveAsVersion(farmId, userId, row.id);
            }
        }
        return {
            concentration_id: row.id,
            stock,
            ingredient: ingredientResult,
            finance: null,
        };
    }
    async inventoryCheck(farmId, id) {
        const row = await this.getOrThrow(farmId, id);
        const lines = await this.resolveInventoryLines(farmId, row.items);
        const neededBySource = new Map();
        for (const l of lines) {
            const sourceKey = l.feedItemId ?? l.feedStockId;
            if (!sourceKey)
                continue;
            const prev = neededBySource.get(sourceKey);
            neededBySource.set(sourceKey, {
                name: l.name,
                neededKg: (prev?.neededKg ?? 0) + l.item.amountKg,
                availableKg: l.availableKg,
            });
        }
        const shortfalls = [...neededBySource.values()]
            .filter((n) => n.availableKg != null && n.neededKg > n.availableKg)
            .map((n) => ({
            name: n.name,
            needed_kg: round2(n.neededKg),
            available_kg: round2(n.availableKg),
        }));
        const missing = lines
            .filter((l) => l.status === 'MISSING')
            .map((l) => ({
            ingredient_id: l.item.ingredientId,
            name: l.name,
            amount_kg: l.item.amountKg,
            feed_class: l.feedClass,
            feed_sub_type: l.feedSubType,
            is_prepared_feed: l.isPreparedFeed,
        }));
        return {
            can_finalize: missing.length === 0 && shortfalls.length === 0,
            lines: lines.map((l) => ({
                ingredient_id: l.item.ingredientId,
                name: l.name,
                amount_kg: l.item.amountKg,
                status: l.status,
                feed_item_id: l.feedItemId,
                feed_stock_id: l.feedStockId,
                available_kg: l.availableKg,
            })),
            missing,
            shortfalls,
        };
    }
    async resolveInventoryLines(farmId, items) {
        const linkedItemIds = items
            .filter((i) => i.feedItemId)
            .map((i) => i.feedItemId);
        const linkedStockIds = items
            .filter((i) => !i.feedItemId && i.feedStockId)
            .map((i) => i.feedStockId);
        const ingredientIds = items
            .filter((i) => !i.feedItemId && !i.feedStockId && i.ingredientId)
            .map((i) => i.ingredientId);
        const lotsInclude = {
            unit: true,
            batches: { where: { deletedAt: null }, select: { currentStock: true } },
        };
        const stockOf = (fi) => fi.batches.reduce((sum, b) => sum + b.currentStock, 0);
        const feedItems = linkedItemIds.length || ingredientIds.length
            ? await this.prisma.feedItem.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    OR: [
                        { id: { in: linkedItemIds } },
                        { ingredientId: { in: ingredientIds } },
                    ],
                },
                include: lotsInclude,
            })
            : [];
        const stocks = linkedStockIds.length
            ? await this.prisma.feedStock.findMany({
                where: { farmId, id: { in: linkedStockIds }, deletedAt: null },
                select: { id: true, currentStockKg: true },
            })
            : [];
        const ingredients = ingredientIds.length
            ? await this.prisma.feedIngredient.findMany({
                where: { id: { in: [...new Set(ingredientIds)] } },
                select: {
                    id: true,
                    nameEn: true,
                    feedClass: true,
                    feedSubType: true,
                    sourceConcentrationId: true,
                },
            })
            : [];
        const sourceConcentrationIds = ingredients
            .map((i) => i.sourceConcentrationId)
            .filter((v) => v != null);
        const preparedStocks = sourceConcentrationIds.length
            ? await this.prisma.feedStock.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    currentStockKg: { gt: 0 },
                    sourceConcentrationId: { in: sourceConcentrationIds },
                },
                select: {
                    id: true,
                    sourceConcentrationId: true,
                    currentStockKg: true,
                },
            })
            : [];
        const bestPreparedByConcentration = new Map();
        for (const s of preparedStocks) {
            if (!s.sourceConcentrationId)
                continue;
            const cur = bestPreparedByConcentration.get(s.sourceConcentrationId);
            if (!cur || s.currentStockKg > cur.currentStockKg) {
                bestPreparedByConcentration.set(s.sourceConcentrationId, s);
            }
        }
        const names = await this.lotResolver.lineNames(farmId, items.map(lineRef));
        const kgOf = (fi) => {
            const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(fi.unit, fi.kgPerUnit);
            return kgPerUnit && kgPerUnit > 0 ? stockOf(fi) * kgPerUnit : null;
        };
        const itemById = new Map(feedItems.map((f) => [f.id, f]));
        const stockById = new Map(stocks.map((s) => [s.id, s]));
        const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
        const bestByIngredient = new Map();
        for (const f of feedItems) {
            if (!f.ingredientId)
                continue;
            const cur = bestByIngredient.get(f.ingredientId);
            if (!cur || stockOf(f) > stockOf(cur)) {
                bestByIngredient.set(f.ingredientId, f);
            }
        }
        return items.map((item) => {
            const ing = item.ingredientId
                ? ingredientById.get(item.ingredientId)
                : undefined;
            const name = names.get((0, recipe_line_1.lineKey)(lineRef(item))) ??
                ing?.nameEn ??
                'Unknown ingredient';
            const base = {
                item,
                name,
                feedClass: ing?.feedClass ?? null,
                feedSubType: ing?.feedSubType ?? null,
                isPreparedFeed: Boolean(ing?.sourceConcentrationId),
            };
            if (item.amountKg <= 0) {
                return {
                    ...base,
                    status: 'IN_INVENTORY',
                    source: null,
                    feedItemId: null,
                    feedStockId: null,
                    availableKg: null,
                };
            }
            if (item.feedItemId) {
                const fi = itemById.get(item.feedItemId);
                if (fi) {
                    return {
                        ...base,
                        status: 'IN_INVENTORY',
                        source: 'LINKED',
                        feedItemId: fi.id,
                        feedStockId: null,
                        availableKg: kgOf(fi),
                    };
                }
            }
            else if (item.feedStockId) {
                const st = stockById.get(item.feedStockId);
                if (st) {
                    return {
                        ...base,
                        status: 'IN_INVENTORY',
                        source: 'LINKED',
                        feedItemId: null,
                        feedStockId: st.id,
                        availableKg: st.currentStockKg,
                    };
                }
            }
            else if (item.ingredientId) {
                if (ing?.sourceConcentrationId) {
                    const st = bestPreparedByConcentration.get(ing.sourceConcentrationId);
                    if (st) {
                        return {
                            ...base,
                            status: 'IN_INVENTORY',
                            source: 'MATCHED',
                            feedItemId: null,
                            feedStockId: st.id,
                            availableKg: st.currentStockKg,
                        };
                    }
                }
                const fi = bestByIngredient.get(item.ingredientId);
                if (fi) {
                    return {
                        ...base,
                        status: 'IN_INVENTORY',
                        source: 'MATCHED',
                        feedItemId: fi.id,
                        feedStockId: null,
                        availableKg: kgOf(fi),
                    };
                }
            }
            return {
                ...base,
                status: 'MISSING',
                source: null,
                feedItemId: null,
                feedStockId: null,
                availableKg: null,
            };
        });
    }
    async saveAsVersion(farmId, userId, id, name) {
        const row = await this.getOrThrow(farmId, id);
        if (row.kind !== 'FEED_MIXTURE') {
            throw new common_1.BadRequestException('Only a Total Mixed Ration can be versioned — a Concentrate Mixer stays live-sync');
        }
        if (row.items.length === 0) {
            throw new common_1.BadRequestException('Cannot version an empty concentration — add ingredients first');
        }
        const [effById, nameByKey] = await Promise.all([
            this.effectiveLineMap(farmId, row.items),
            this.lotResolver.lineNames(farmId, row.items.map(lineRef)),
        ]);
        const lines = this.formulaLines(row.items);
        const { totals } = (0, formula_math_1.computeTotals)(lines, effById);
        const nextVersionNumber = row.versionNumber;
        const snapshotItems = row.items.map((i) => {
            const key = (0, recipe_line_1.lineKey)(lineRef(i));
            return {
                ingredientId: i.ingredientId,
                feedItemId: i.feedItemId,
                ingredientName: nameByKey.get(key) ?? key,
                amountKg: i.amountKg,
                pricePerKg: effById.get(key)?.pricePerKg ?? 0,
            };
        });
        const [version] = await this.prisma.$transaction([
            this.prisma.feedConcentrationVersion.create({
                data: {
                    farmId,
                    concentrationId: id,
                    versionNumber: nextVersionNumber,
                    name,
                    snapshotItems,
                    totalCostPerDay: totals.total_cost_tk,
                    createdBy: userId,
                },
            }),
            this.prisma.feedConcentration.update({
                where: { id },
                data: { versionNumber: nextVersionNumber + 1 },
            }),
        ]);
        this.log.info('Feed concentration version saved', {
            farmId,
            concentrationId: id,
            versionNumber: version.versionNumber,
        });
        return {
            id: version.id,
            version_number: version.versionNumber,
            name: version.name,
            total_cost_per_day: version.totalCostPerDay,
            created_at: version.createdAt,
        };
    }
    async listVersions(farmId, id) {
        await this.getOrThrow(farmId, id);
        const rows = await this.prisma.feedConcentrationVersion.findMany({
            where: { farmId, concentrationId: id },
            orderBy: { versionNumber: 'desc' },
        });
        return rows.map((v) => ({
            id: v.id,
            version_number: v.versionNumber,
            name: v.name,
            items: v.snapshotItems,
            total_cost_per_day: v.totalCostPerDay,
            created_at: v.createdAt,
        }));
    }
    async normalize(farmId, dto) {
        this.assertLineIdentity(dto.items);
        await this.assertIngredients(dto.items.map((i) => i.ingredientId));
        const effById = await this.effectiveLineMap(farmId, dto.items);
        const settings = await this.requirementSettings.resolve(farmId);
        const req = (0, requirements_1.computeRequirements)({
            weightKg: dto.weightKg,
            milkTargetL: dto.milkTargetL,
            milkFatPct: dto.milkFatPct,
        }, settings);
        const lines = this.formulaLines(dto.items);
        const normalized = (0, formula_math_1.normalize)(lines, req, effById);
        const comp = (0, formula_math_1.computeTotals)(normalized, effById);
        const dtoByKey = new Map(dto.items.map((i) => [(0, recipe_line_1.lineKey)(lineRef(i)), i]));
        return {
            requirements: this.reqShape(req),
            items: normalized.map((l) => ({
                ingredient_id: dtoByKey.get(l.ingredientId)?.ingredientId ?? null,
                feed_item_id: dtoByKey.get(l.ingredientId)?.feedItemId ?? null,
                amount_kg: l.amountKg,
            })),
            totals: comp.totals,
            balance_score: (0, formula_math_1.balanceScore)(comp.totals, req),
        };
    }
    async enrich(farmId, row, detailed = false, finalizedIds, requirement, effByIdForBatch) {
        const effById = effByIdForBatch ?? (await this.effectiveLineMap(farmId, row.items));
        const lines = this.formulaLines(row.items);
        const comp = (0, formula_math_1.computeTotals)(lines, effById);
        const req = requirement !== undefined
            ? requirement
            : ((await this.feedRequirements.resolveForConcentrations(farmId, [row])).get(row.id) ?? null);
        const balance = req ? (0, formula_math_1.balanceScore)(comp.totals, req) : null;
        const base = {
            id: row.id,
            kind: row.kind,
            name: row.name,
            target_type: row.targetType,
            cattle_id: row.cattleId,
            duration_days: row.durationDays,
            target_weight_kg: row.targetWeightKg,
            target_milk_l: row.targetMilkL,
            totals: comp.totals,
            balance_score: balance,
            requirements: req ? this.reqShape(req) : null,
            is_finalized: finalizedIds?.has(row.id) ?? false,
            created_at: row.createdAt,
        };
        if (!detailed)
            return base;
        const lineNames = await this.lotResolver.lineNames(farmId, row.items.map(lineRef));
        const rowByKey = new Map(row.items.map((i) => [(0, recipe_line_1.lineKey)(lineRef(i)), i]));
        return {
            ...base,
            ingredients: comp.items.map((it) => ({
                ingredient_id: rowByKey.get(it.ingredientId)?.ingredientId ?? null,
                name: lineNames.get(it.ingredientId) ?? null,
                amount_kg: it.amount_kg,
                dm_kg: it.dm_kg,
                cp_kg: it.cp_kg,
                me_mj: it.me_mj,
                ndf_kg: it.ndf_kg,
                fat_kg: it.fat_kg,
                rdp_kg: it.rdp_kg,
                rup_kg: it.rup_kg,
                starch_kg: it.starch_kg,
                adf_kg: it.adf_kg,
                calcium_kg: it.calcium_kg,
                phosphorus_kg: it.phosphorus_kg,
                tdn_kg: it.tdn_kg,
                cost_tk: it.cost_tk,
                feed_item_id: rowByKey.get(it.ingredientId)?.feedItemId ?? null,
                feed_item_batch_id: rowByKey.get(it.ingredientId)?.feedItemBatchId ?? null,
                feed_stock_id: rowByKey.get(it.ingredientId)?.feedStockId ?? null,
            })),
        };
    }
    effectiveLineMap(farmId, items) {
        return this.lotResolver.effectiveLines(farmId, items.map(lineRef));
    }
    formulaLines(items) {
        return items.map((i) => ({
            ingredientId: (0, recipe_line_1.lineKey)(lineRef(i)),
            amountKg: i.amountKg,
        }));
    }
    effectiveMap(farmId, ingredientIds) {
        return this.lotResolver.effectiveIngredients(farmId, ingredientIds);
    }
    buildIngredientNutrition(name, totals, totalAsFedKg) {
        const pctOfDm = (kg) => totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
        const pctOfCp = (kg) => totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;
        return {
            nameEn: name,
            feedClass: 'CONCENTRATE',
            feedSubType: 'COMPOUND_PELLET',
            dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
            cpPct: pctOfDm(totals.cp_kg),
            meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
            fatPct: pctOfDm(totals.fat_kg),
            ndfPct: pctOfDm(totals.ndf_kg),
            rdpPct: pctOfCp(totals.rdp_kg),
            rupPct: pctOfCp(totals.rup_kg),
            starchPct: pctOfDm(totals.starch_kg),
            adfPct: pctOfDm(totals.adf_kg),
            calciumPct: pctOfDm(totals.calcium_kg),
            phosphorusPct: pctOfDm(totals.phosphorus_kg),
            tdnPct: pctOfDm(totals.tdn_kg),
            currentPricePerKg: totals.total_cost_tk / totalAsFedKg,
        };
    }
    buildStockNutritionSnapshot(totals, totalAsFedKg) {
        const pctOfDm = (kg) => totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
        const pctOfCp = (kg) => totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;
        return {
            dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
            cpPct: pctOfDm(totals.cp_kg),
            meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
            fatPct: pctOfDm(totals.fat_kg),
            ndfPct: pctOfDm(totals.ndf_kg),
            rdpPct: pctOfCp(totals.rdp_kg),
            rupPct: pctOfCp(totals.rup_kg),
            starchPct: pctOfDm(totals.starch_kg),
            adfPct: pctOfDm(totals.adf_kg),
            calciumPct: pctOfDm(totals.calcium_kg),
            phosphorusPct: pctOfDm(totals.phosphorus_kg),
            tdnPct: pctOfDm(totals.tdn_kg),
        };
    }
    mapIngredient(ing) {
        return {
            id: ing.id,
            name_en: ing.nameEn,
            is_custom: true,
            is_latest_version: ing.isLatestVersion,
            source_concentration_id: ing.sourceConcentrationId,
            source_concentration_version: ing.sourceConcentrationVersion,
            effective_price_per_kg: ing.currentPricePerKg,
            nutrition: {
                dm_pct: ing.dmPct,
                cp_pct: ing.cpPct,
                me_mj_per_kg_dm: ing.meMjPerKgDm,
                fat_pct: ing.fatPct,
                ndf_pct: ing.ndfPct,
                rdp_pct: ing.rdpPct,
                rup_pct: ing.rupPct,
                starch_pct: ing.starchPct,
                adf_pct: ing.adfPct,
                calcium_pct: ing.calciumPct,
                phosphorus_pct: ing.phosphorusPct,
                tdn_pct: ing.tdnPct,
            },
        };
    }
    async refreshPromotedIngredientIfExists(farmId, row) {
        const promoted = await this.prisma.feedIngredient.findFirst({
            where: { sourceConcentrationId: row.id },
        });
        if (!promoted)
            return;
        const effById = await this.effectiveLineMap(farmId, row.items);
        const lines = this.formulaLines(row.items);
        const { totals } = (0, formula_math_1.computeTotals)(lines, effById);
        const totalAsFedKg = row.items.reduce((sum, i) => sum + i.amountKg, 0);
        if (totalAsFedKg <= 0 || totals.dm_kg <= 0)
            return;
        const nutrition = this.buildIngredientNutrition(row.name, totals, totalAsFedKg);
        await this.prisma.feedIngredient.update({
            where: { id: promoted.id },
            data: nutrition,
        });
    }
    async ingredientNames(ids) {
        const rows = await this.prisma.feedIngredient.findMany({
            where: { id: { in: ids } },
            select: { id: true, nameEn: true },
        });
        return new Map(rows.map((r) => [r.id, r.nameEn]));
    }
    assertLineIdentity(items) {
        for (const item of items) {
            if (!item.ingredientId && !item.feedItemId) {
                throw new common_1.BadRequestException('Each line needs an ingredientId, or a feedItemId to take its nutrition from');
            }
        }
    }
    async assertIngredients(ingredientIds) {
        const ids = [
            ...new Set(ingredientIds.filter((id) => Boolean(id))),
        ];
        if (ids.length === 0)
            return;
        const count = await this.prisma.feedIngredient.count({
            where: { id: { in: ids }, deletedAt: null },
        });
        if (count !== ids.length) {
            throw new common_1.BadRequestException('One or more ingredients are invalid');
        }
    }
    async assertHasConcentrateDerivedLine(items) {
        const ids = [
            ...new Set(items.map((i) => i.ingredientId).filter((id) => !!id)),
        ];
        const count = await this.prisma.feedIngredient.count({
            where: { id: { in: ids }, sourceConcentrationId: { not: null } },
        });
        if (count === 0) {
            throw new common_1.BadRequestException('A Total Mixed Ration requires at least one line using a finalized Concentrate Mixer — build and finalize a Concentrate Mixer first, then reference its promoted ingredient here');
        }
    }
    async assertBatchLinks(farmId, items) {
        for (const item of items) {
            if (item.feedItemId && item.feedStockId) {
                throw new common_1.BadRequestException(`Line for ingredient ${item.ingredientId ?? item.feedItemId} cannot link both a purchased batch and a prepared batch — pick one`);
            }
            if (item.feedItemBatchId && !item.feedItemId) {
                throw new common_1.BadRequestException('feedItemBatchId needs the feedItemId it belongs to');
            }
        }
        const pins = items.filter((i) => i.feedItemBatchId);
        if (pins.length > 0) {
            const lots = await this.prisma.feedItemBatch.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    id: { in: pins.map((i) => i.feedItemBatchId) },
                },
                select: { id: true, feedItemId: true },
            });
            const lotById = new Map(lots.map((l) => [l.id, l]));
            for (const item of pins) {
                if (lotById.get(item.feedItemBatchId)?.feedItemId !== item.feedItemId) {
                    throw new common_1.BadRequestException(`Batch ${item.feedItemBatchId} is not a live batch of feed item ${item.feedItemId}`);
                }
            }
        }
        const feedItemIds = [
            ...new Set(items.filter((i) => i.feedItemId).map((i) => i.feedItemId)),
        ];
        const feedStockIds = [
            ...new Set(items.filter((i) => i.feedStockId).map((i) => i.feedStockId)),
        ];
        if (feedItemIds.length === 0 && feedStockIds.length === 0)
            return;
        const [feedItems, feedStocks] = await Promise.all([
            feedItemIds.length
                ? this.prisma.feedItem.findMany({
                    where: { id: { in: feedItemIds }, farmId, deletedAt: null },
                    select: { id: true, ingredientId: true },
                })
                : [],
            feedStockIds.length
                ? this.prisma.feedStock.findMany({
                    where: { id: { in: feedStockIds }, farmId, deletedAt: null },
                    select: { id: true, sourceConcentrationId: true },
                })
                : [],
        ]);
        const feedItemById = new Map(feedItems.map((f) => [f.id, f]));
        const stockById = new Map(feedStocks.map((s) => [s.id, s]));
        const sourceConcIds = [
            ...new Set(feedStocks.map((s) => s.sourceConcentrationId)),
        ];
        const promotedIngredients = sourceConcIds.length
            ? await this.prisma.feedIngredient.findMany({
                where: { sourceConcentrationId: { in: sourceConcIds } },
                select: { id: true, sourceConcentrationId: true },
            })
            : [];
        const ingredientIdBySourceConc = new Map(promotedIngredients.map((i) => [i.sourceConcentrationId, i.id]));
        for (const item of items) {
            if (item.feedItemId) {
                const linked = feedItemById.get(item.feedItemId);
                if (!linked) {
                    throw new common_1.BadRequestException(`Linked feed item ${item.feedItemId} not found`);
                }
                if (item.ingredientId && linked.ingredientId !== item.ingredientId) {
                    throw new common_1.BadRequestException(`Linked feed item ${item.feedItemId} does not match this line's ingredient`);
                }
            }
            if (item.feedStockId) {
                const linked = stockById.get(item.feedStockId);
                if (!linked) {
                    throw new common_1.BadRequestException(`Linked feed stock ${item.feedStockId} not found`);
                }
                const promotedIngredientId = ingredientIdBySourceConc.get(linked.sourceConcentrationId);
                if (promotedIngredientId !== item.ingredientId) {
                    throw new common_1.BadRequestException(`Linked feed stock ${item.feedStockId} does not match this line's ingredient`);
                }
            }
        }
    }
    async resolveBatchDeductions(farmId, userId, concentrationId, items, effById) {
        const groupKey = (feedItemId, pin) => `${feedItemId}|${pin ?? ''}`;
        const feedItemQty = new Map();
        const feedStockQty = new Map();
        for (const item of items) {
            if (item.feedItemId) {
                const key = groupKey(item.feedItemId, item.feedItemBatchId);
                const prev = feedItemQty.get(key);
                feedItemQty.set(key, {
                    feedItemId: item.feedItemId,
                    pin: item.feedItemBatchId,
                    qty: (prev?.qty ?? 0) + item.amountKg,
                });
            }
            else if (item.feedStockId) {
                feedStockQty.set(item.feedStockId, (feedStockQty.get(item.feedStockId) ?? 0) + item.amountKg);
            }
        }
        const feedItemPricePerKg = new Map();
        const feedItemDeductions = [];
        for (const [key, { feedItemId, pin, qty }] of feedItemQty) {
            const usage = await this.feedDistribution.computeFeedItemUsage(farmId, feedItemId, qty, undefined, pin ?? undefined);
            feedItemPricePerKg.set(key, usage.pricePerKg);
            feedItemDeductions.push({ feedItemId, plan: usage.plan });
        }
        const feedStockPricePerKg = new Map();
        const feedStockDeductions = [];
        if (feedStockQty.size > 0) {
            const stocks = await this.prisma.feedStock.findMany({
                where: { id: { in: [...feedStockQty.keys()] } },
                select: {
                    id: true,
                    sourceConcentrationId: true,
                    producedCostTk: true,
                    producedQtyKg: true,
                },
            });
            for (const s of stocks) {
                if (s.sourceConcentrationId === concentrationId) {
                    throw new common_1.BadRequestException(`Line links FeedStock ${s.id}, which this same concentration itself produced — a recipe cannot consume its own output`);
                }
                feedStockPricePerKg.set(s.id, s.producedQtyKg > 0 ? s.producedCostTk / s.producedQtyKg : 0);
            }
            await this.feedStock.assertSufficientStock(farmId, [...feedStockQty.entries()].map(([feedStockId, quantity]) => ({
                stockId: feedStockId,
                quantity,
            })));
            for (const [feedStockId, quantity] of feedStockQty) {
                feedStockDeductions.push({ feedStockId, quantity });
            }
        }
        let linkedCostTk = 0;
        let unlinkedCostTk = 0;
        for (const item of items) {
            if (item.feedItemId) {
                linkedCostTk +=
                    item.amountKg *
                        (feedItemPricePerKg.get(groupKey(item.feedItemId, item.feedItemBatchId)) ?? 0);
            }
            else if (item.feedStockId) {
                linkedCostTk +=
                    item.amountKg * (feedStockPricePerKg.get(item.feedStockId) ?? 0);
            }
            else {
                const eff = effById.get((0, recipe_line_1.lineKey)(lineRef(item)));
                unlinkedCostTk += item.amountKg * (eff?.pricePerKg ?? 0);
            }
        }
        return {
            linkedCostTk: round2(linkedCostTk),
            unlinkedCostTk: round2(unlinkedCostTk),
            feedItemDeductions,
            feedStockDeductions,
        };
    }
    async applyBatchDeductions(farmId, userId, tx, deductions) {
        for (const d of deductions.feedItemDeductions) {
            for (const piece of d.plan.pieces) {
                await this.feedItems.applyFeedDraw(farmId, userId, d.feedItemId, {
                    batchId: piece.batchId,
                    quantityUnits: piece.quantityUnits,
                    notes: 'Consumed by a concentrate/TMR batch',
                }, tx);
            }
        }
        for (const d of deductions.feedStockDeductions) {
            await this.feedStock.decrementForDistribution(farmId, userId, { stockId: d.feedStockId, quantity: d.quantity }, tx);
        }
    }
    async validateTargets(farmId, cattleId) {
        if (cattleId) {
            const cattle = await this.prisma.cattle.findFirst({
                where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
                select: { id: true },
            });
            if (!cattle)
                throw new common_1.BadRequestException('Cattle must belong to the farm');
        }
    }
    async getOrThrow(farmId, id) {
        const row = await this.prisma.feedConcentration.findFirst({
            where: { id, farmId, deletedAt: null },
            include: { items: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Concentration template not found');
        return row;
    }
    reqShape(req) {
        return {
            dm_kg: req.dmKg,
            cp_kg: req.cpKg,
            me_mj: req.meMj,
            ndf_kg: req.ndfKg,
            fat_kg: req.fatKg,
        };
    }
};
exports.FeedConcentrationService = FeedConcentrationService;
exports.FeedConcentrationService = FeedConcentrationService = FeedConcentrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_stock_service_1.FeedStockService,
        feed_requirements_service_1.FeedRequirementsService,
        requirement_settings_service_1.RequirementSettingsService,
        feed_distribution_service_1.FeedDistributionService,
        feed_lot_resolver_service_1.FeedLotResolver,
        feed_item_service_1.FeedItemService])
], FeedConcentrationService);
//# sourceMappingURL=feed-concentration.service.js.map