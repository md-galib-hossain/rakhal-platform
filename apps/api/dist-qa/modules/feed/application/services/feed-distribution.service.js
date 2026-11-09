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
var FeedDistributionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedDistributionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const pagination_1 = require("src/common/pagination");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const unit_service_1 = require("src/modules/inventory/application/services/unit.service");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const nutrition_profile_1 = require("../../domain/nutrition-profile");
const feed_stock_service_1 = require("./feed-stock.service");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
const feed_requirements_service_1 = require("./feed-requirements.service");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
const round2 = (n) => Math.round(n * 100) / 100;
let FeedDistributionService = FeedDistributionService_1 = class FeedDistributionService {
    prisma;
    feedStock;
    planResolver;
    feedRequirements;
    lotResolver;
    feedItems;
    clock;
    log;
    constructor(prisma, logger, feedStock, planResolver, feedRequirements, lotResolver, feedItems, clock) {
        this.prisma = prisma;
        this.feedStock = feedStock;
        this.planResolver = planResolver;
        this.feedRequirements = feedRequirements;
        this.lotResolver = lotResolver;
        this.feedItems = feedItems;
        this.clock = clock;
        this.log = logger.setContext(FeedDistributionService_1.name);
    }
    async create(farmId, userId, dto) {
        const concentration = await this.prisma.feedConcentration.findFirst({
            where: { id: dto.concentrationId, farmId, deletedAt: null },
            include: { items: true },
        });
        if (!concentration) {
            throw new common_1.NotFoundException('Concentration template not found');
        }
        if (concentration.items.length === 0) {
            throw new common_1.BadRequestException('Concentration has no ingredient lines to distribute');
        }
        const keyOf = (i) => i.ingredientId ?? i.feedItemId;
        const linkByKey = new Map(concentration.items
            .filter((i) => i.feedItemId)
            .map((i) => [
            keyOf(i),
            { feedItemId: i.feedItemId, feedItemBatchId: i.feedItemBatchId },
        ]));
        const productOnlyKeys = new Set(concentration.items.filter((i) => !i.ingredientId).map(keyOf));
        const recipeIds = concentration.items.map(keyOf);
        const validIds = new Set(recipeIds);
        const overrides = new Map((dto.items ?? []).map((i) => [i.ingredientId, i]));
        const extraIds = [...overrides.keys()].filter((id) => !validIds.has(id));
        const ingredientIds = [...new Set([...recipeIds, ...extraIds])];
        const catalogueIds = ingredientIds.filter((id) => !productOnlyKeys.has(id));
        const [effById, nameById, productNames] = await Promise.all([
            this.effectiveMap(farmId, catalogueIds),
            this.ingredientNames(catalogueIds),
            productOnlyKeys.size
                ? this.prisma.feedItem.findMany({
                    where: { farmId, id: { in: [...productOnlyKeys] } },
                    select: { id: true, name: true },
                })
                : [],
        ]);
        for (const p of productNames)
            nameById.set(p.id, p.name);
        for (const id of extraIds) {
            if (!nameById.has(id)) {
                throw new common_1.NotFoundException(`Ingredient ${id} not found`);
            }
        }
        const buildLine = (ingredientId, plannedKg, actualKg, refusalKg, stockId) => {
            const eff = effById.get(ingredientId);
            const price = eff?.pricePerKg ?? 0;
            return {
                ingredientId,
                linkedFeedItemId: linkByKey.get(ingredientId)?.feedItemId ?? null,
                pinnedBatchId: linkByKey.get(ingredientId)?.feedItemBatchId ?? null,
                ingredientName: nameById.get(ingredientId) ?? ingredientId,
                plannedKg: round2(plannedKg),
                actualKg: round2(actualKg),
                refusalKg: round2(refusalKg),
                pricePerKg: round2(price),
                lineCost: round2(actualKg * price),
                stockId,
                ...(eff
                    ? {
                        dmPct: eff.dmPct,
                        cpPct: eff.cpPct,
                        meMjPerKgDm: eff.meMjPerKgDm,
                        fatPct: eff.fatPct,
                        ndfPct: eff.ndfPct,
                        rdpPct: eff.rdpPct,
                        rupPct: eff.rupPct,
                        starchPct: eff.starchPct,
                        adfPct: eff.adfPct,
                        calciumPct: eff.calciumPct,
                        phosphorusPct: eff.phosphorusPct,
                        tdnPct: eff.tdnPct,
                    }
                    : {}),
            };
        };
        const recipeLines = concentration.items.map((item) => {
            const override = overrides.get(keyOf(item));
            return buildLine(keyOf(item), item.amountKg, override?.actualKg ?? item.amountKg, override?.refusalKg ?? 0, override?.stockId);
        });
        const extraLines = extraIds.map((id) => {
            const override = overrides.get(id);
            return buildLine(id, 0, override.actualKg ?? 0, override.refusalKg ?? 0, override.stockId);
        });
        const drawPlans = await this.planFeedItemDraws(farmId, userId, [
            ...recipeLines,
            ...extraLines,
        ]);
        const lines = [...recipeLines, ...extraLines].map((line) => {
            const plan = drawPlans.get(line.ingredientId);
            if (!plan)
                return { ...line, feedItemBatchId: null, nutritionProfileId: null };
            const single = plan.pieces.length === 1 ? plan.pieces[0] : null;
            const blend = (0, nutrition_profile_1.blendNutrition)(plan.pieces.map((p) => ({
                kg: p.quantityKg,
                values: this.lotResolver.toValues(p.profile),
            })));
            return {
                ...line,
                pricePerKg: round2(plan.pricePerKg),
                lineCost: round2(plan.pieces.reduce((s, p) => s + p.costTk, 0)),
                dmPct: blend.dmPct,
                cpPct: blend.cpPct,
                meMjPerKgDm: blend.meMjPerKgDm,
                fatPct: blend.fatPct,
                ndfPct: blend.ndfPct,
                rdpPct: blend.rdpPct,
                rupPct: blend.rupPct,
                starchPct: blend.starchPct,
                adfPct: blend.adfPct,
                calciumPct: blend.calciumPct,
                phosphorusPct: blend.phosphorusPct,
                tdnPct: blend.tdnPct,
                feedItemBatchId: single?.batchId ?? null,
                nutritionProfileId: single?.nutritionProfileId ?? null,
            };
        });
        const stockRequests = lines
            .filter((l) => l.stockId != null)
            .map((l) => ({ stockId: l.stockId, quantity: l.actualKg }));
        if (stockRequests.length > 0) {
            await this.feedStock.assertSufficientStock(farmId, stockRequests);
        }
        const totals = lines.reduce((acc, l) => {
            acc.plannedKg += l.plannedKg;
            acc.actualKg += l.actualKg;
            acc.refusalKg += l.refusalKg;
            acc.plannedCost += l.plannedKg * l.pricePerKg;
            acc.actualCost += l.lineCost;
            return acc;
        }, {
            plannedKg: 0,
            actualKg: 0,
            refusalKg: 0,
            plannedCost: 0,
            actualCost: 0,
        });
        const ownStock = stockRequests.length === 0
            ? await this.prisma.feedStock.findFirst({
                where: {
                    farmId,
                    sourceConcentrationId: concentration.id,
                    currentStockKg: { gt: 0 },
                    deletedAt: null,
                },
                orderBy: { producedAt: 'asc' },
            })
            : null;
        if (ownStock && totals.actualKg > 0) {
            await this.feedStock.assertSufficientStock(farmId, [
                { stockId: ownStock.id, quantity: totals.actualKg },
            ]);
        }
        const distributedAt = await this.clock.dayStart(farmId, dto.distributedAt);
        const currentVersion = concentration.versionNumber > 1
            ? await this.prisma.feedConcentrationVersion.findUnique({
                where: {
                    concentrationId_versionNumber: {
                        concentrationId: concentration.id,
                        versionNumber: concentration.versionNumber - 1,
                    },
                },
                select: { id: true },
            })
            : null;
        const decrements = [...drawPlans.values()].map((plan) => ({
            forageId: plan.feedItem.id,
        }));
        const itemsForCreate = lines.map((line) => ({
            feedItemBatchId: line.feedItemBatchId,
            nutritionProfileId: line.nutritionProfileId,
            ingredientId: line.ingredientId,
            ingredientName: line.ingredientName,
            plannedKg: line.plannedKg,
            actualKg: line.actualKg,
            refusalKg: line.refusalKg,
            pricePerKg: line.pricePerKg,
            lineCost: line.lineCost,
            dmPct: line.dmPct ?? null,
            cpPct: line.cpPct ?? null,
            meMjPerKgDm: line.meMjPerKgDm ?? null,
            fatPct: line.fatPct ?? null,
            ndfPct: line.ndfPct ?? null,
            rdpPct: line.rdpPct ?? null,
            rupPct: line.rupPct ?? null,
            starchPct: line.starchPct ?? null,
            adfPct: line.adfPct ?? null,
            calciumPct: line.calciumPct ?? null,
            phosphorusPct: line.phosphorusPct ?? null,
            tdnPct: line.tdnPct ?? null,
        }));
        const targetFields = {
            cattleId: concentration.targetType === 'INDIVIDUAL'
                ? concentration.cattleId
                : null,
        };
        const created = await this.prisma.$transaction(async (tx) => {
            const dist = await tx.feedDistribution.create({
                data: {
                    farmId,
                    concentrationId: concentration.id,
                    concentrationVersionId: currentVersion?.id,
                    ...targetFields,
                    distributedAt,
                    totalPlannedKg: round2(totals.plannedKg),
                    totalActualKg: round2(totals.actualKg),
                    totalRefusalKg: round2(totals.refusalKg),
                    totalPlannedCost: round2(totals.plannedCost),
                    totalActualCost: round2(totals.actualCost),
                    notes: dto.notes,
                    createdBy: userId,
                    items: { create: itemsForCreate },
                },
                include: { items: true },
            });
            for (const plan of drawPlans.values()) {
                for (const piece of plan.pieces) {
                    await this.feedItems.applyFeedDraw(farmId, userId, plan.feedItem.id, {
                        batchId: piece.batchId,
                        quantityUnits: piece.quantityUnits,
                        distributionId: dist.id,
                    }, tx);
                }
            }
            for (const req of stockRequests) {
                await this.feedStock.decrementForDistribution(farmId, userId, {
                    stockId: req.stockId,
                    quantity: req.quantity,
                    distributionId: dist.id,
                }, tx);
            }
            if (ownStock && totals.actualKg > 0) {
                await this.feedStock.decrementForDistribution(farmId, userId, {
                    stockId: ownStock.id,
                    quantity: totals.actualKg,
                    distributionId: dist.id,
                }, tx);
            }
            return dist;
        });
        this.log.info('Feed distribution logged', {
            farmId,
            id: created.id,
            forageDecrements: decrements.length,
            stockDecrements: stockRequests.length + (ownStock ? 1 : 0),
        });
        return this.mapDistribution(created, decrements);
    }
    async computeFeedItemUsage(farmId, feedItemId, quantityKg, tx, pinBatchId) {
        const plan = await this.feedItems.previewDraw(farmId, feedItemId, quantityKg, tx, pinBatchId);
        return {
            plan,
            feedItem: plan.feedItem,
            ingredientId: plan.feedItem.ingredientId ?? plan.feedItem.id,
            ingredientName: plan.feedItem.name,
            pricePerKg: round2(plan.pricePerKg),
        };
    }
    async list(farmId, query) {
        const dateFilter = this.dateRange(query.fromDate, query.toDate);
        const rows = await this.prisma.feedDistribution.findMany({
            where: {
                farmId,
                ...(query.cattleId ? { cattleId: query.cattleId } : {}),
                ...(query.concentrationId
                    ? { concentrationId: query.concentrationId }
                    : {}),
                ...(dateFilter ? { distributedAt: dateFilter } : {}),
            },
            orderBy: [{ distributedAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((r) => this.mapSummary(r)),
            meta: page.meta,
        };
    }
    async get(farmId, id) {
        const row = await this.prisma.feedDistribution.findFirst({
            where: { id, farmId },
            include: { items: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Feed distribution not found');
        return this.mapDistribution(row);
    }
    async patchRefusal(farmId, id, dto) {
        const row = await this.prisma.feedDistribution.findFirst({
            where: { id, farmId },
            include: { items: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Feed distribution not found');
        const byIngredient = new Map(dto.items.map((i) => [i.ingredientId, i]));
        for (const id of byIngredient.keys()) {
            if (!row.items.some((it) => it.ingredientId === id)) {
                throw new common_1.BadRequestException(`Ingredient ${id} is not part of this distribution`);
            }
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            for (const item of row.items) {
                const patch = byIngredient.get(item.ingredientId);
                if (!patch)
                    continue;
                await tx.feedDistributionItem.update({
                    where: { id: item.id },
                    data: { refusalKg: round2(patch.refusalKg) },
                });
            }
            const items = await tx.feedDistributionItem.findMany({
                where: { distributionId: id },
            });
            const totalRefusalKg = round2(items.reduce((sum, i) => sum + i.refusalKg, 0));
            return tx.feedDistribution.update({
                where: { id },
                data: { totalRefusalKg },
                include: { items: true },
            });
        });
        this.log.info('Feed distribution refusal recorded', {
            farmId,
            id,
            totalRefusalKg: updated.totalRefusalKg,
        });
        return this.mapDistribution(updated);
    }
    async efficiency(farmId, query) {
        const { start, end, label } = this.monthRange(query.month);
        const cattle = await this.prisma.cattle.findFirst({
            where: {
                id: query.cattleId,
                ...(0, herd_scope_1.activeHerd)(farmId),
            },
            select: { id: true, tagNumber: true, name: true },
        });
        if (!cattle)
            throw new common_1.NotFoundException('Cattle not found');
        const [distributions, litresAgg] = await Promise.all([
            this.prisma.feedDistribution.findMany({
                where: {
                    farmId,
                    cattleId: cattle.id,
                    distributedAt: { gte: start, lt: end },
                },
                select: this.EFFICIENCY_DISTRIBUTION_SELECT,
            }),
            this.prisma.milkLogEntry.aggregate({
                where: {
                    farmId,
                    cattleId: cattle.id,
                    logDate: { gte: start, lt: end },
                },
                _sum: { yieldL: true },
            }),
        ]);
        return {
            cattle_id: cattle.id,
            cattle_name: cattle.name ?? cattle.tagNumber,
            period: label,
            ...this.summarizeEfficiency(distributions, litresAgg._sum.yieldL ?? 0),
        };
    }
    async getDmiComparison(farmId, cattleId, date) {
        const [program, reqResult] = await Promise.all([
            this.planResolver
                .resolveForCattle(farmId, [cattleId])
                .then((m) => m.get(cattleId) ?? null),
            this.feedRequirements.calc(farmId, { cattleId }),
        ]);
        const only = program?.lines.length === 1 && program.lines[0].lineType === 'PREPARED'
            ? program.lines[0].concentrationId
            : null;
        const resolved = program
            ? { matchLevel: program.via, concentrationId: only }
            : null;
        const programInfo = program
            ? {
                plan_id: program.planId,
                plan_name: program.planName,
                via: program.via,
                conflict: program.conflict,
            }
            : null;
        const expectedDmiKg = 'requirements' in reqResult ? reqResult.requirements.dm_kg : 0;
        const day = await this.clock.dayStart(farmId, date);
        const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
        const dateFilter = { gte: day, lt: nextDay };
        const gridItems = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId,
                voidedAt: null,
                distribution: { farmId, distributedAt: dateFilter, voidedAt: null },
            },
            select: { offeredKg: true, refusalKg: true, dmPct: true },
        });
        const gridDmKg = gridItems.reduce((sum, i) => {
            if (i.dmPct == null)
                return sum;
            return (sum + Math.max(0, i.offeredKg - (i.refusalKg ?? 0)) * (i.dmPct / 100));
        }, 0);
        if (!resolved) {
            return {
                expected_dmi_kg: expectedDmiKg,
                actual_dmi_kg: gridItems.length > 0 ? round2(gridDmKg) : null,
                delta_pct: gridItems.length > 0 && expectedDmiKg > 0
                    ? round2(((round2(gridDmKg) - expectedDmiKg) / expectedDmiKg) * 100)
                    : null,
                match_level: gridItems.length > 0 ? 'INDIVIDUAL' : null,
                program: programInfo,
            };
        }
        let distributions;
        let headcount = 1;
        if (resolved.matchLevel === 'INDIVIDUAL') {
            distributions = await this.prisma.feedDistribution.findMany({
                where: { farmId, cattleId, distributedAt: dateFilter },
                include: { items: true },
            });
        }
        else if (resolved.concentrationId) {
            [distributions, headcount] = await Promise.all([
                this.prisma.feedDistribution.findMany({
                    where: {
                        farmId,
                        cattleId: null,
                        distributedAt: dateFilter,
                        concentrationId: resolved.concentrationId,
                    },
                    include: { items: true },
                }),
                this.prisma.cattle.count({
                    where: (0, herd_scope_1.activeHerd)(farmId),
                }),
            ]);
            headcount = Math.max(1, headcount);
        }
        else {
            distributions = [];
        }
        const allItems = distributions.flatMap((d) => d.items);
        if (allItems.length === 0 && gridItems.length === 0) {
            return {
                expected_dmi_kg: expectedDmiKg,
                actual_dmi_kg: null,
                delta_pct: null,
                match_level: resolved.matchLevel,
                program: programInfo,
            };
        }
        const dmKgTotal = allItems.reduce((sum, i) => {
            if (i.dmPct == null)
                return sum;
            return sum + i.actualKg * (i.dmPct / 100);
        }, 0);
        const actualDmiKg = round2(dmKgTotal / headcount + gridDmKg);
        const deltaPct = expectedDmiKg > 0
            ? round2(((actualDmiKg - expectedDmiKg) / expectedDmiKg) * 100)
            : null;
        return {
            expected_dmi_kg: expectedDmiKg,
            actual_dmi_kg: actualDmiKg,
            delta_pct: deltaPct,
            match_level: resolved.matchLevel,
            program: programInfo,
        };
    }
    async getFarmFeedCostSummary(farmId, days = 7) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [distributions, milkAgg, headcount] = await Promise.all([
            this.prisma.feedDistribution.findMany({
                where: { farmId, distributedAt: { gte: since } },
                select: { distributedAt: true, totalActualCost: true },
            }),
            this.prisma.milkLogEntry.aggregate({
                where: { farmId, logDate: { gte: since } },
                _sum: { yieldL: true },
            }),
            this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(farmId),
            }),
        ]);
        const totalCost = round2(distributions.reduce((sum, d) => sum + d.totalActualCost, 0));
        const totalLitres = milkAgg._sum.yieldL ?? 0;
        const byDay = new Map();
        for (const d of distributions) {
            const key = d.distributedAt.toISOString().slice(0, 10);
            byDay.set(key, round2((byDay.get(key) ?? 0) + d.totalActualCost));
        }
        const trend = [...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, cost]) => ({ date, total_cost: cost }));
        return {
            days,
            total_cost: totalCost,
            cost_per_cow_per_day: headcount > 0 ? round2(totalCost / days / headcount) : null,
            cost_per_litre: totalLitres > 0 ? round2(totalCost / totalLitres) : null,
            headcount,
            total_litres: round2(totalLitres),
            trend,
        };
    }
    EFFICIENCY_DISTRIBUTION_SELECT = {
        totalPlannedKg: true,
        totalActualKg: true,
        totalRefusalKg: true,
        totalPlannedCost: true,
        totalActualCost: true,
    };
    summarizeEfficiency(distributions, litres) {
        const t = distributions.reduce((acc, d) => {
            acc.plannedKg += d.totalPlannedKg;
            acc.actualKg += d.totalActualKg;
            acc.refusalKg += d.totalRefusalKg;
            acc.plannedCost += d.totalPlannedCost;
            acc.actualCost += d.totalActualCost;
            return acc;
        }, {
            plannedKg: 0,
            actualKg: 0,
            refusalKg: 0,
            plannedCost: 0,
            actualCost: 0,
        });
        const consumedKg = t.actualKg - t.refusalKg;
        return {
            distributions: distributions.length,
            planned_kg: round2(t.plannedKg),
            actual_kg: round2(t.actualKg),
            refusal_kg: round2(t.refusalKg),
            consumed_kg: round2(consumedKg),
            planned_cost: round2(t.plannedCost),
            actual_cost: round2(t.actualCost),
            adherence_pct: t.plannedKg > 0 ? round2((t.actualKg / t.plannedKg) * 100) : null,
            refusal_pct: t.actualKg > 0 ? round2((t.refusalKg / t.actualKg) * 100) : null,
            litres_produced: round2(litres),
            feed_cost_per_litre: litres > 0 ? round2(t.actualCost / litres) : null,
        };
    }
    async planFeedItemDraws(farmId, userId, lines) {
        const plans = new Map();
        for (const line of lines) {
            if (!line.linkedFeedItemId || line.actualKg <= 0)
                continue;
            plans.set(line.ingredientId, await this.feedItems.previewDraw(farmId, line.linkedFeedItemId, line.actualKg, undefined, line.pinnedBatchId ?? undefined));
        }
        const ingredientIds = [...new Set(lines.map((l) => l.ingredientId))];
        const feedItems = await this.prisma.feedItem.findMany({
            where: { farmId, deletedAt: null, ingredientId: { in: ingredientIds } },
            select: {
                id: true,
                ingredientId: true,
                unit: {
                    select: { symbol: true, dimension: true, conversionToBase: true },
                },
                kgPerUnit: true,
            },
        });
        const byIngredient = new Map(feedItems
            .filter((f) => f.ingredientId != null)
            .map((f) => [f.ingredientId, f]));
        for (const line of lines) {
            const f = byIngredient.get(line.ingredientId);
            if (!f || line.actualKg <= 0 || plans.has(line.ingredientId))
                continue;
            const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(f.unit, f.kgPerUnit);
            if (!kgPerUnit || kgPerUnit <= 0) {
                this.log.warn('Skipping forage decrement — no resolvable kg-per-unit', {
                    farmId,
                    feedItemId: f.id,
                    ingredientId: line.ingredientId,
                });
                continue;
            }
            plans.set(line.ingredientId, await this.feedItems.previewDraw(farmId, f.id, line.actualKg));
        }
        return plans;
    }
    async getEffectiveNutrition(farmId, ingredientId) {
        const map = await this.effectiveMap(farmId, [ingredientId]);
        return map.get(ingredientId) ?? null;
    }
    effectiveMap(farmId, ingredientIds) {
        return this.lotResolver.effectiveIngredients(farmId, ingredientIds);
    }
    async ingredientNames(ids) {
        const rows = await this.prisma.feedIngredient.findMany({
            where: { id: { in: [...new Set(ids)] } },
            select: { id: true, nameEn: true },
        });
        return new Map(rows.map((r) => [r.id, r.nameEn]));
    }
    mapDistribution(row, decrements) {
        return {
            id: row.id,
            concentration_id: row.concentrationId,
            cattle_id: row.cattleId,
            distributed_at: row.distributedAt,
            total_planned_kg: row.totalPlannedKg,
            total_actual_kg: row.totalActualKg,
            total_refusal_kg: row.totalRefusalKg,
            total_planned_cost: row.totalPlannedCost,
            total_actual_cost: row.totalActualCost,
            notes: row.notes,
            forage_decrements: decrements?.length ?? null,
            items: row.items.map((i) => ({
                ingredient_id: i.ingredientId,
                name: i.ingredientName,
                planned_kg: i.plannedKg,
                actual_kg: i.actualKg,
                refusal_kg: i.refusalKg,
                price_per_kg: i.pricePerKg,
                line_cost: i.lineCost,
            })),
            created_at: row.createdAt,
        };
    }
    mapSummary(row) {
        return {
            id: row.id,
            concentration_id: row.concentrationId,
            cattle_id: row.cattleId,
            distributed_at: row.distributedAt,
            total_actual_kg: row.totalActualKg,
            total_actual_cost: row.totalActualCost,
            created_at: row.createdAt,
        };
    }
    dayStart(dateStr) {
        const d = dateStr ? new Date(dateStr) : new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    dateRange(fromDate, toDate) {
        if (!fromDate && !toDate)
            return null;
        const range = {};
        if (fromDate)
            range.gte = this.dayStart(fromDate);
        if (toDate) {
            const d = this.dayStart(toDate);
            range.lt = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        }
        return range;
    }
    monthRange(month) {
        const now = new Date();
        let year = now.getUTCFullYear();
        let m = now.getUTCMonth();
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [y, mm] = month.split('-').map(Number);
            year = y;
            m = mm - 1;
        }
        return {
            start: new Date(Date.UTC(year, m, 1)),
            end: new Date(Date.UTC(year, m + 1, 1)),
            label: `${year}-${String(m + 1).padStart(2, '0')}`,
        };
    }
};
exports.FeedDistributionService = FeedDistributionService;
exports.FeedDistributionService = FeedDistributionService = FeedDistributionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_stock_service_1.FeedStockService,
        feed_plan_resolver_service_1.FeedPlanResolverService,
        feed_requirements_service_1.FeedRequirementsService,
        feed_lot_resolver_service_1.FeedLotResolver,
        feed_item_service_1.FeedItemService,
        farm_clock_service_1.FarmClockService])
], FeedDistributionService);
//# sourceMappingURL=feed-distribution.service.js.map