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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedLotResolver = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const ingredient_resolver_1 = require("../../domain/ingredient-resolver");
const unit_service_1 = require("src/modules/inventory/application/services/unit.service");
const recipe_line_1 = require("../../domain/recipe-line");
const nutrition_profile_1 = require("../../domain/nutrition-profile");
let FeedLotResolver = class FeedLotResolver {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async effectiveIngredients(farmId, ingredientIds) {
        const ids = [...new Set(ingredientIds)];
        if (ids.length === 0)
            return new Map();
        const [ingredients, overrides] = await Promise.all([
            this.prisma.feedIngredient.findMany({ where: { id: { in: ids } } }),
            this.prisma.feedIngredientOverride.findMany({
                where: { farmId, ingredientId: { in: ids } },
            }),
        ]);
        const overrideById = new Map(overrides.map((o) => [o.ingredientId, o]));
        return new Map(ingredients.map((ing) => [
            ing.id,
            (0, ingredient_resolver_1.resolveEffective)(ing, overrideById.get(ing.id) ?? null),
        ]));
    }
    async effectiveLines(farmId, lines) {
        const out = new Map();
        const catalogueIds = lines
            .filter((l) => !(0, recipe_line_1.isLotBacked)(l) && l.ingredientId)
            .map((l) => l.ingredientId);
        const catalogue = await this.effectiveIngredients(farmId, catalogueIds);
        for (const l of lines) {
            if (!(0, recipe_line_1.isLotBacked)(l) && l.ingredientId) {
                const eff = catalogue.get(l.ingredientId);
                if (eff)
                    out.set((0, recipe_line_1.lineKey)(l), eff);
            }
        }
        const lotLines = lines.filter(recipe_line_1.isLotBacked);
        if (lotLines.length === 0)
            return out;
        const items = await this.prisma.feedItem.findMany({
            where: {
                farmId,
                id: { in: [...new Set(lotLines.map((l) => l.feedItemId))] },
            },
            include: {
                unit: true,
                batches: {
                    where: { deletedAt: null },
                    orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
                    include: { nutritionProfile: true },
                },
            },
        });
        const byId = new Map(items.map((i) => [i.id, i]));
        for (const l of lotLines) {
            const item = byId.get(l.feedItemId);
            if (!item)
                continue;
            const batch = l.feedItemBatchId
                ? item.batches.find((b) => b.id === l.feedItemBatchId)
                : (item.batches.find((b) => b.currentStock > 0) ??
                    item.batches[item.batches.length - 1]);
            if (!batch)
                continue;
            const kgPerUnit = (0, unit_service_1.resolveKgPerUnit)(item.unit, item.kgPerUnit);
            const p = batch.nutritionProfile;
            out.set((0, recipe_line_1.lineKey)(l), {
                id: (0, recipe_line_1.lineKey)(l),
                pricePerKg: kgPerUnit && kgPerUnit > 0 ? batch.costPerUnit / kgPerUnit : 0,
                priceSource: 'farm_override',
                hasNutritionOverride: false,
                dmPct: p.dmPct,
                cpPct: p.cpPct,
                meMjPerKgDm: p.meMjPerKgDm,
                fatPct: p.fatPct ?? 0,
                ndfPct: p.ndfPct ?? 0,
                rdpPct: p.rdpPct ?? 0,
                rupPct: p.rupPct ?? 0,
                starchPct: p.starchPct ?? 0,
                adfPct: p.adfPct ?? 0,
                calciumPct: p.calciumPct ?? 0,
                phosphorusPct: p.phosphorusPct ?? 0,
                tdnPct: p.tdnPct ?? 0,
                nutritionSource: p.nutritionSource,
            });
        }
        return out;
    }
    async lineNames(farmId, lines) {
        const out = new Map();
        const ingredientIds = lines
            .filter((l) => !(0, recipe_line_1.isLotBacked)(l) && l.ingredientId)
            .map((l) => l.ingredientId);
        const itemIds = lines
            .filter(recipe_line_1.isLotBacked)
            .map((l) => l.feedItemId);
        const [ingredients, items] = await Promise.all([
            ingredientIds.length
                ? this.prisma.feedIngredient.findMany({
                    where: { id: { in: [...new Set(ingredientIds)] } },
                    select: { id: true, nameEn: true },
                })
                : [],
            itemIds.length
                ? this.prisma.feedItem.findMany({
                    where: { farmId, id: { in: [...new Set(itemIds)] } },
                    select: { id: true, name: true },
                })
                : [],
        ]);
        const ingName = new Map(ingredients.map((i) => [i.id, i.nameEn]));
        const itemName = new Map(items.map((i) => [i.id, i.name]));
        for (const l of lines) {
            const name = (0, recipe_line_1.isLotBacked)(l)
                ? itemName.get(l.feedItemId)
                : ingName.get(l.ingredientId);
            if (name)
                out.set((0, recipe_line_1.lineKey)(l), name);
        }
        return out;
    }
    async catalogueValues(farmId, ingredientId) {
        const ingredient = await this.prisma.feedIngredient.findUnique({
            where: { id: ingredientId },
        });
        if (!ingredient)
            return null;
        const override = await this.prisma.feedIngredientOverride.findUnique({
            where: { farmId_ingredientId: { farmId, ingredientId } },
        });
        return {
            values: (0, nutrition_profile_1.mergeCatalogueNutrition)(ingredient, override),
            nutritionSource: (0, ingredient_resolver_1.resolveEffective)(ingredient, override).nutritionSource,
        };
    }
    async profiles(farmId, profileIds) {
        const ids = [...new Set(profileIds)];
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.nutritionProfile.findMany({
            where: { id: { in: ids }, farmId },
        });
        return new Map(rows.map((r) => [r.id, r]));
    }
    async batchProfile(farmId, batchId) {
        const batch = await this.prisma.feedItemBatch.findFirst({
            where: { id: batchId, farmId },
            include: { nutritionProfile: true },
        });
        return batch?.nutritionProfile ?? null;
    }
    toValues(profile) {
        const values = {};
        for (const key of nutrition_profile_1.NUTRIENT_KEYS) {
            values[key] = profile[key];
        }
        return values;
    }
};
exports.FeedLotResolver = FeedLotResolver;
exports.FeedLotResolver = FeedLotResolver = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FeedLotResolver);
//# sourceMappingURL=feed-lot-resolver.service.js.map