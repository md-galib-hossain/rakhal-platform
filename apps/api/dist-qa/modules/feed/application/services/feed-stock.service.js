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
var FeedStockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedStockService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const nutrition_profile_1 = require("../../domain/nutrition-profile");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
const nutrition_profile_service_1 = require("./nutrition-profile.service");
const round2 = (v) => Math.round(v * 100) / 100;
let FeedStockService = FeedStockService_1 = class FeedStockService {
    prisma;
    profiles;
    resolver;
    log;
    constructor(prisma, logger, profiles, resolver) {
        this.prisma = prisma;
        this.profiles = profiles;
        this.resolver = resolver;
        this.log = logger.setContext(FeedStockService_1.name);
    }
    async produceFromConcentration(farmId, userId, params, tx) {
        const run = async (client) => {
            const profile = await this.profiles.create(farmId, userId, {
                values: (0, nutrition_profile_1.toNutritionValues)(params.nutrition),
                nutritionSource: 'REFERENCE',
                note: 'Computed from the recipe at production time.',
                trusted: true,
            }, client);
            const created = await client.feedStock.create({
                include: { nutritionProfile: true },
                data: {
                    farmId,
                    kind: params.kind,
                    sourceConcentrationId: params.concentrationId,
                    sourceConcentrationVersion: params.version,
                    producedAt: new Date(),
                    producedQtyKg: round2(params.qtyKg),
                    currentStockKg: round2(params.qtyKg),
                    producedCostTk: round2(params.costTk),
                    nutritionProfileId: profile.id,
                    createdBy: userId,
                },
            });
            await client.feedStockMovement.create({
                data: {
                    stockId: created.id,
                    changeKg: round2(params.qtyKg),
                    reason: 'PRODUCED',
                    createdBy: userId,
                },
            });
            return created;
        };
        const stock = tx
            ? await run(tx)
            : await this.prisma.$transaction((client) => run(client));
        this.log.info('Feed stock produced', {
            farmId,
            stockId: stock.id,
            concentrationId: params.concentrationId,
            qtyKg: params.qtyKg,
        });
        return this.mapStock(stock);
    }
    async assertSufficientStock(farmId, requests) {
        for (const { stockId, quantity } of requests) {
            const stock = await this.prisma.feedStock.findFirst({
                where: { id: stockId, farmId, deletedAt: null },
            });
            if (!stock)
                throw new common_1.NotFoundException(`Feed stock lot ${stockId} not found`);
            if (quantity <= 0)
                throw new common_1.BadRequestException('Quantity must be positive');
            if (stock.currentStockKg < quantity) {
                throw new common_1.BadRequestException(`Insufficient feed stock: ${stock.currentStockKg}kg available, ${quantity}kg requested`);
            }
        }
    }
    async decrementForDistribution(farmId, userId, opts, tx) {
        if (opts.quantity <= 0) {
            throw new common_1.BadRequestException('Quantity must be positive');
        }
        const run = async (client) => {
            const applied = await client.feedStock.updateMany({
                where: {
                    id: opts.stockId,
                    farmId,
                    deletedAt: null,
                    currentStockKg: { gte: opts.quantity },
                },
                data: { currentStockKg: { decrement: opts.quantity } },
            });
            if (applied.count === 0) {
                const stock = await client.feedStock.findFirst({
                    where: { id: opts.stockId, farmId, deletedAt: null },
                });
                if (!stock)
                    throw new common_1.NotFoundException('Feed stock lot not found');
                throw new common_1.BadRequestException(`Insufficient feed stock: ${stock.currentStockKg}kg available, ${opts.quantity}kg requested`);
            }
            const after = await client.feedStock.findUniqueOrThrow({
                where: { id: opts.stockId },
                include: { nutritionProfile: true },
            });
            const rounded = round2(after.currentStockKg);
            const settled = rounded === after.currentStockKg
                ? after
                : await client.feedStock.update({
                    where: { id: opts.stockId },
                    data: { currentStockKg: rounded },
                    include: { nutritionProfile: true },
                });
            await client.feedStockMovement.create({
                data: {
                    stockId: opts.stockId,
                    changeKg: round2(-opts.quantity),
                    reason: 'FED',
                    distributionId: opts.distributionId ?? null,
                    createdBy: userId,
                },
            });
            return settled;
        };
        const updated = tx
            ? await run(tx)
            : await this.prisma.$transaction((client) => run(client));
        this.log.info('Feed stock decremented', {
            farmId,
            stockId: opts.stockId,
            quantity: opts.quantity,
            distributionId: opts.distributionId,
        });
        return this.mapStock(updated);
    }
    async updateNutrition(farmId, userId, id, patch) {
        const row = await this.prisma.feedStock.findFirst({
            where: { id, farmId },
            include: { nutritionProfile: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Feed stock lot not found');
        if (row.deletedAt) {
            throw new common_1.BadRequestException('Nutrition cannot be edited on an archived stock lot');
        }
        const { nutritionSource, sourceRef, ...nutrients } = patch;
        const values = {
            ...this.resolver.toValues(row.nutritionProfile),
        };
        for (const [key, value] of Object.entries(nutrients)) {
            if (value !== undefined)
                values[key] = value;
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const profile = await this.profiles.create(farmId, userId, {
                values: values,
                nutritionSource: nutritionSource ?? 'LAB',
                sourceRef: sourceRef ?? row.nutritionProfile.sourceRef,
                copiedFromIngredientId: row.nutritionProfile.copiedFromIngredientId,
                supersedesId: row.nutritionProfileId,
            }, tx);
            const moved = await tx.feedStock.updateMany({
                where: { id, farmId, nutritionProfileId: row.nutritionProfileId },
                data: { nutritionProfileId: profile.id },
            });
            if (moved.count !== 1) {
                throw new common_1.ConflictException('This stock lot was changed by someone else — reload and try again');
            }
            return tx.feedStock.findUniqueOrThrow({
                where: { id },
                include: { nutritionProfile: true },
            });
        });
        this.log.info('Feed stock nutrition profile replaced', {
            farmId,
            stockId: id,
            from: row.nutritionProfileId,
            to: updated.nutritionProfileId,
            nutritionSource: updated.nutritionProfile.nutritionSource,
        });
        return this.mapStock(updated);
    }
    async list(farmId, includeArchived = false) {
        const rows = await this.prisma.feedStock.findMany({
            where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
            orderBy: { producedAt: 'desc' },
            include: { nutritionProfile: true },
        });
        return rows.map((r) => this.mapStock(r));
    }
    async archive(farmId, id) {
        const row = await this.prisma.feedStock.findFirst({
            where: { id, farmId },
        });
        if (!row)
            throw new common_1.NotFoundException('Feed stock lot not found');
        const updated = await this.prisma.feedStock.update({
            where: { id },
            data: { deletedAt: new Date() },
            include: { nutritionProfile: true },
        });
        this.log.info('Feed stock archived', { farmId, stockId: id });
        return this.mapStock(updated);
    }
    async removeMany(farmId, ids) {
        const result = await this.prisma.feedStock.updateMany({
            where: { farmId, id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        this.log.info('Feed stock bulk-archived', {
            farmId,
            requested: ids.length,
            archived: result.count,
        });
        return { deleted: result.count };
    }
    async get(farmId, id) {
        const row = await this.prisma.feedStock.findFirst({
            where: { id, farmId },
            include: {
                nutritionProfile: true,
                movements: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Feed stock lot not found');
        return {
            ...this.mapStock(row),
            movements: row.movements.map((m) => ({
                id: m.id,
                change_kg: m.changeKg,
                reason: m.reason,
                distribution_id: m.distributionId,
                created_at: m.createdAt,
            })),
        };
    }
    mapStock(row) {
        const p = row.nutritionProfile;
        return {
            id: row.id,
            kind: row.kind,
            source_concentration_id: row.sourceConcentrationId,
            source_concentration_version: row.sourceConcentrationVersion,
            produced_at: row.producedAt,
            produced_qty_kg: row.producedQtyKg,
            current_stock_kg: row.currentStockKg,
            produced_cost_tk: row.producedCostTk,
            created_at: row.createdAt,
            nutrition: {
                dm_pct: p.dmPct,
                cp_pct: p.cpPct,
                me_mj_per_kg_dm: p.meMjPerKgDm,
                fat_pct: p.fatPct,
                ndf_pct: p.ndfPct,
                rdp_pct: p.rdpPct,
                rup_pct: p.rupPct,
                starch_pct: p.starchPct,
                adf_pct: p.adfPct,
                calcium_pct: p.calciumPct,
                phosphorus_pct: p.phosphorusPct,
                tdn_pct: p.tdnPct,
            },
            nutrition_source: p.nutritionSource,
            source_ref: p.sourceRef,
            nutrition_profile_id: p.id,
        };
    }
};
exports.FeedStockService = FeedStockService;
exports.FeedStockService = FeedStockService = FeedStockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        nutrition_profile_service_1.NutritionProfileService,
        feed_lot_resolver_service_1.FeedLotResolver])
], FeedStockService);
//# sourceMappingURL=feed-stock.service.js.map