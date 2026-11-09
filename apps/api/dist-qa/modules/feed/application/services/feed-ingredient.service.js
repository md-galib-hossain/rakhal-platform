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
var FeedIngredientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedIngredientService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const ingredient_resolver_1 = require("../../domain/ingredient-resolver");
let FeedIngredientService = FeedIngredientService_1 = class FeedIngredientService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(FeedIngredientService_1.name);
    }
    async listMerged(farmId, includeArchived = false) {
        const [ingredients, overrides] = await Promise.all([
            this.prisma.feedIngredient.findMany({
                where: {
                    ...(includeArchived ? {} : { deletedAt: null }),
                    isLatestVersion: true,
                    OR: [{ farmId: null }, { farmId }],
                },
                orderBy: [{ feedClass: 'asc' }, { nameEn: 'asc' }],
            }),
            this.prisma.feedIngredientOverride.findMany({ where: { farmId } }),
        ]);
        const overrideByIngredient = new Map(overrides.map((o) => [o.ingredientId, o]));
        return ingredients.map((ing) => this.toMerged(ing, overrideByIngredient.get(ing.id) ?? null));
    }
    async listPaged(farmId, query) {
        const where = {
            ...(query.includeArchived ? {} : { deletedAt: null }),
            isLatestVersion: true,
            OR: [{ farmId: null }, { farmId }],
            ...(query.feedClass?.length
                ? { feedClass: { in: query.feedClass } }
                : {}),
            ...(query.priceMin != null || query.priceMax != null
                ? {
                    currentPricePerKg: {
                        ...(query.priceMin != null ? { gte: query.priceMin } : {}),
                        ...(query.priceMax != null ? { lte: query.priceMax } : {}),
                    },
                }
                : {}),
            ...(query.search
                ? {
                    AND: [
                        {
                            OR: [
                                { nameEn: { contains: query.search, mode: 'insensitive' } },
                                { nameBn: { contains: query.search, mode: 'insensitive' } },
                            ],
                        },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.feedIngredient.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const overrides = page.items.length
            ? await this.prisma.feedIngredientOverride.findMany({
                where: {
                    farmId,
                    ingredientId: { in: page.items.map((ing) => ing.id) },
                },
            })
            : [];
        const overrideByIngredient = new Map(overrides.map((o) => [o.ingredientId, o]));
        return {
            items: page.items.map((ing) => this.toMerged(ing, overrideByIngredient.get(ing.id) ?? null)),
            meta: page.meta,
        };
    }
    async createCustom(farmId, _userId, dto) {
        const created = await this.prisma.feedIngredient.create({
            data: {
                farmId,
                nameEn: dto.name,
                feedClass: 'ADDITIVE',
                feedSubType: 'SUPPLEMENT',
                nutrientGroup: dto.nutrientGroup,
                dmPct: dto.dmPct ?? 100,
                cpPct: dto.cpPct ?? 0,
                meMjPerKgDm: dto.meMjPerKgDm ?? 0,
                fatPct: dto.fatPct ?? 0,
                ndfPct: dto.ndfPct ?? 0,
                rdpPct: dto.rdpPct ?? 0,
                rupPct: dto.rupPct ?? 0,
                starchPct: dto.starchPct ?? 0,
                adfPct: dto.adfPct ?? 0,
                calciumPct: dto.calciumPct ?? 0,
                phosphorusPct: dto.phosphorusPct ?? 0,
                tdnPct: dto.tdnPct ?? 0,
                currentPricePerKg: dto.pricePerKg,
                isSystemDefault: false,
                isAvailableBd: true,
            },
        });
        this.log.info('Custom feed ingredient created', {
            farmId,
            id: created.id,
        });
        return this.toMerged(created, null);
    }
    async updateCustomIngredient(farmId, id, dto) {
        const existing = await this.assertOwnedCustomIngredient(farmId, id);
        const priceChanged = dto.pricePerKg != null && dto.pricePerKg !== existing.currentPricePerKg;
        const updated = await this.prisma.feedIngredient.update({
            where: { id },
            data: {
                nameEn: dto.name,
                nutrientGroup: dto.nutrientGroup,
                currentPricePerKg: dto.pricePerKg,
                dmPct: dto.dmPct,
                cpPct: dto.cpPct,
                meMjPerKgDm: dto.meMjPerKgDm,
                fatPct: dto.fatPct,
                ndfPct: dto.ndfPct,
                rdpPct: dto.rdpPct,
                rupPct: dto.rupPct,
                starchPct: dto.starchPct,
                adfPct: dto.adfPct,
                calciumPct: dto.calciumPct,
                phosphorusPct: dto.phosphorusPct,
                tdnPct: dto.tdnPct,
                ...(priceChanged ? { priceUpdatedAt: new Date() } : {}),
            },
        });
        this.log.info('Custom feed ingredient updated', { farmId, id });
        return this.toMerged(updated, null);
    }
    async deactivateCustomIngredient(farmId, id) {
        await this.assertOwnedCustomIngredient(farmId, id);
        const referencedBy = await this.prisma.feedConcentrationItem.findFirst({
            where: { ingredientId: id, concentration: { deletedAt: null } },
            select: { id: true },
        });
        if (referencedBy) {
            throw new common_1.ConflictException('Ingredient is used by an active concentration — remove it from that formula first');
        }
        const updated = await this.prisma.feedIngredient.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Custom feed ingredient archived', { farmId, id });
        return this.toMerged(updated, null);
    }
    async assertOwnedCustomIngredient(farmId, id) {
        const existing = await this.prisma.feedIngredient.findFirst({
            where: { id, farmId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Ingredient not found');
        }
        if (existing.sourceConcentrationId) {
            throw new common_1.BadRequestException('This ingredient was promoted from a Concentrate Mixer — edit the source concentration instead');
        }
        return existing;
    }
    async setOverride(farmId, userId, ingredientId, dto) {
        await this.assertIngredientExists(ingredientId);
        const data = {
            customPricePerKg: dto.customPricePerKg ?? null,
            customDmPct: dto.customDmPct ?? null,
            customCpPct: dto.customCpPct ?? null,
            customMeMjPerKgDm: dto.customMeMjPerKgDm ?? null,
            customFatPct: dto.customFatPct ?? null,
            customNdfPct: dto.customNdfPct ?? null,
            customRdpPct: dto.customRdpPct ?? null,
            customRupPct: dto.customRupPct ?? null,
            customStarchPct: dto.customStarchPct ?? null,
            customAdfPct: dto.customAdfPct ?? null,
            customCalciumPct: dto.customCalciumPct ?? null,
            customPhosphorusPct: dto.customPhosphorusPct ?? null,
            customTdnPct: dto.customTdnPct ?? null,
            notes: dto.notes ?? null,
        };
        const override = await this.prisma.feedIngredientOverride.upsert({
            where: { farmId_ingredientId: { farmId, ingredientId } },
            update: data,
            create: { farmId, ingredientId, createdBy: userId, ...data },
        });
        this.log.info('Feed ingredient override set', { farmId, ingredientId });
        return override;
    }
    async resetOverride(farmId, ingredientId) {
        await this.prisma.feedIngredientOverride.deleteMany({
            where: { farmId, ingredientId },
        });
        this.log.info('Feed ingredient override reset', { farmId, ingredientId });
        return { ingredient_id: ingredientId, price_source: 'rakhal_market' };
    }
    async listCatalogueForAdmin() {
        const rows = await this.prisma.feedIngredient.findMany({
            where: { farmId: null },
            orderBy: [{ feedClass: 'asc' }, { nameEn: 'asc' }],
        });
        return rows.map((ing) => this.toMerged(ing, null));
    }
    async createCatalogueIngredient(dto) {
        const created = await this.prisma.feedIngredient.create({
            data: {
                farmId: null,
                nameEn: dto.nameEn,
                nameBn: dto.nameBn,
                feedClass: dto.feedClass,
                feedSubType: dto.feedSubType,
                dmPct: dto.dmPct,
                cpPct: dto.cpPct,
                meMjPerKgDm: dto.meMjPerKgDm,
                fatPct: dto.fatPct ?? 0,
                ndfPct: dto.ndfPct ?? 0,
                rdpPct: dto.rdpPct ?? 0,
                rupPct: dto.rupPct ?? 0,
                starchPct: dto.starchPct ?? 0,
                adfPct: dto.adfPct ?? 0,
                calciumPct: dto.calciumPct ?? 0,
                phosphorusPct: dto.phosphorusPct ?? 0,
                tdnPct: dto.tdnPct ?? 0,
                currentPricePerKg: dto.currentPricePerKg,
                priceUpdatedAt: new Date(),
                nutritionSourceNote: dto.nutritionSourceNote,
                nutritionSource: dto.nutritionSource,
                sourceRef: dto.sourceRef,
                isAvailableBd: dto.isAvailableBd ?? true,
                isSystemDefault: true,
            },
        });
        this.log.info('Catalogue feed ingredient created (admin)', {
            id: created.id,
        });
        return this.toMerged(created, null);
    }
    async updateCatalogueIngredient(id, dto) {
        const existing = await this.prisma.feedIngredient.findUnique({
            where: { id },
        });
        if (!existing)
            throw new common_1.NotFoundException('Ingredient not found');
        if (existing.farmId != null) {
            throw new common_1.BadRequestException('Not a catalogue ingredient — farm-owned rows are managed by the farm, not the admin panel');
        }
        const priceChanged = dto.currentPricePerKg != null &&
            dto.currentPricePerKg !== existing.currentPricePerKg;
        const updated = await this.prisma.feedIngredient.update({
            where: { id },
            data: {
                nameEn: dto.nameEn,
                nameBn: dto.nameBn,
                feedClass: dto.feedClass,
                feedSubType: dto.feedSubType,
                dmPct: dto.dmPct,
                cpPct: dto.cpPct,
                meMjPerKgDm: dto.meMjPerKgDm,
                fatPct: dto.fatPct,
                ndfPct: dto.ndfPct,
                rdpPct: dto.rdpPct,
                rupPct: dto.rupPct,
                starchPct: dto.starchPct,
                adfPct: dto.adfPct,
                calciumPct: dto.calciumPct,
                phosphorusPct: dto.phosphorusPct,
                tdnPct: dto.tdnPct,
                currentPricePerKg: dto.currentPricePerKg,
                nutritionSourceNote: dto.nutritionSourceNote,
                nutritionSource: dto.nutritionSource,
                sourceRef: dto.sourceRef,
                isAvailableBd: dto.isAvailableBd,
                ...(priceChanged ? { priceUpdatedAt: new Date() } : {}),
            },
        });
        this.log.info('Catalogue feed ingredient updated (admin)', {
            id,
            priceChanged,
        });
        return this.toMerged(updated, null);
    }
    async setCatalogueIngredientActive(id, isActive) {
        const existing = await this.prisma.feedIngredient.findFirst({
            where: { id, farmId: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Catalogue ingredient not found');
        const updated = await this.prisma.feedIngredient.update({
            where: { id },
            data: { deletedAt: isActive ? null : new Date() },
        });
        this.log.info(isActive
            ? 'Catalogue feed ingredient restored (admin)'
            : 'Catalogue feed ingredient archived (admin)', { id });
        return this.toMerged(updated, null);
    }
    toMerged(ing, override) {
        const eff = (0, ingredient_resolver_1.resolveEffective)(ing, override);
        return {
            id: ing.id,
            name_en: ing.nameEn,
            name_bn: ing.nameBn,
            feed_class: ing.feedClass,
            feed_sub_type: ing.feedSubType,
            nutrient_group: ing.nutrientGroup,
            is_custom: ing.farmId != null,
            nutrition_source: ing.nutritionSourceNote,
            nutrition_source_type: eff.nutritionSource,
            source_ref: ing.sourceRef,
            rakhal_price_per_kg: ing.currentPricePerKg,
            price_updated_at: ing.priceUpdatedAt,
            effective_price_per_kg: eff.pricePerKg,
            price_source: eff.priceSource,
            has_nutrition_override: eff.hasNutritionOverride,
            is_available_bd: ing.isAvailableBd,
            nutrition: {
                dm_pct: eff.dmPct,
                cp_pct: eff.cpPct,
                me_mj_per_kg_dm: eff.meMjPerKgDm,
                fat_pct: eff.fatPct,
                ndf_pct: eff.ndfPct,
                rdp_pct: eff.rdpPct,
                rup_pct: eff.rupPct,
                starch_pct: eff.starchPct,
                adf_pct: eff.adfPct,
                calcium_pct: eff.calciumPct,
                phosphorus_pct: eff.phosphorusPct,
                tdn_pct: eff.tdnPct,
            },
            override_notes: override?.notes ?? null,
        };
    }
    async assertIngredientExists(ingredientId) {
        const ing = await this.prisma.feedIngredient.findUnique({
            where: { id: ingredientId },
            select: { id: true },
        });
        if (!ing) {
            throw new common_1.BadRequestException('Ingredient not found');
        }
    }
};
exports.FeedIngredientService = FeedIngredientService;
exports.FeedIngredientService = FeedIngredientService = FeedIngredientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], FeedIngredientService);
//# sourceMappingURL=feed-ingredient.service.js.map