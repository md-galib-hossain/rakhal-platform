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
var NutritionProfileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NutritionProfileService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const nutrition_profile_1 = require("../../domain/nutrition-profile");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
let NutritionProfileService = NutritionProfileService_1 = class NutritionProfileService {
    prisma;
    resolver;
    activityLog;
    log;
    constructor(prisma, logger, resolver, activityLog) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.activityLog = activityLog;
        this.log = logger.setContext(NutritionProfileService_1.name);
    }
    async create(farmId, userId, input, tx) {
        const problems = input.trusted ? [] : (0, nutrition_profile_1.validateNutrition)(input.values);
        if (problems.length > 0) {
            throw new common_1.BadRequestException(`Invalid nutrition profile: ${problems.join('; ')}`);
        }
        const client = tx ?? this.prisma;
        if (input.supersedesId) {
            const previous = await client.nutritionProfile.findFirst({
                where: { id: input.supersedesId, farmId },
                select: { id: true },
            });
            if (!previous)
                throw new common_1.NotFoundException('Superseded profile not found');
        }
        return client.nutritionProfile.create({
            data: {
                farmId,
                ...input.values,
                nutritionSource: input.nutritionSource ?? 'FARM_ESTIMATE',
                sourceRef: input.sourceRef ?? null,
                note: input.note ?? null,
                copiedFromIngredientId: input.copiedFromIngredientId ?? null,
                supersedesId: input.supersedesId ?? null,
                createdBy: userId,
            },
        });
    }
    async createFromIngredient(farmId, userId, ingredientId, tx, supersedesId) {
        const catalogue = await this.resolver.catalogueValues(farmId, ingredientId);
        if (!catalogue)
            throw new common_1.NotFoundException('Ingredient not found');
        return this.create(farmId, userId, {
            values: catalogue.values,
            nutritionSource: catalogue.nutritionSource,
            copiedFromIngredientId: ingredientId,
            supersedesId,
            note: 'Copied from the Rakhal catalogue.',
            trusted: true,
        }, tx);
    }
    async get(farmId, id) {
        const row = await this.prisma.nutritionProfile.findFirst({
            where: { id, farmId },
        });
        if (!row)
            throw new common_1.NotFoundException('Nutrition profile not found');
        return row;
    }
    async history(farmId, id, limit = 50) {
        const chain = [];
        let cursor = id;
        const seen = new Set();
        while (cursor && chain.length < limit && !seen.has(cursor)) {
            seen.add(cursor);
            const row = await this.prisma.nutritionProfile.findFirst({
                where: { id: cursor, farmId },
            });
            if (!row)
                break;
            chain.push(row);
            cursor = row.supersedesId;
        }
        if (chain.length === 0) {
            throw new common_1.NotFoundException('Nutrition profile not found');
        }
        return chain;
    }
    async differsFromCatalogue(farmId, profile) {
        if (!profile.copiedFromIngredientId)
            return null;
        const catalogue = await this.resolver.catalogueValues(farmId, profile.copiedFromIngredientId);
        if (!catalogue)
            return null;
        return (0, nutrition_profile_1.diffNutrition)(this.resolver.toValues(profile), catalogue.values);
    }
    async reviseBatch(farmId, userId, batchId, input) {
        return this.replaceBatchProfile(farmId, userId, batchId, {
            create: (tx, current) => this.create(farmId, userId, {
                values: input.values,
                nutritionSource: input.nutritionSource,
                sourceRef: input.sourceRef,
                note: input.note,
                copiedFromIngredientId: current.copiedFromIngredientId,
                supersedesId: current.id,
            }, tx),
            expectedUpdatedAt: input.expectedUpdatedAt,
            makeDefault: input.makeDefault ?? true,
            action: 'edited',
        });
    }
    async revertBatch(farmId, userId, batchId) {
        return this.replaceBatchProfile(farmId, userId, batchId, {
            create: async (tx, current) => {
                if (!current.supersedesId) {
                    throw new common_1.BadRequestException('There is no earlier profile to revert to');
                }
                const previous = await tx.nutritionProfile.findFirst({
                    where: { id: current.supersedesId, farmId },
                });
                if (!previous)
                    throw new common_1.NotFoundException('Earlier profile not found');
                return this.create(farmId, userId, {
                    values: this.resolver.toValues(previous),
                    nutritionSource: previous.nutritionSource,
                    sourceRef: previous.sourceRef,
                    note: `Reverted to the profile from ${previous.createdAt.toISOString().slice(0, 10)}.`,
                    copiedFromIngredientId: previous.copiedFromIngredientId,
                    supersedesId: current.id,
                }, tx);
            },
            makeDefault: false,
            action: 'reverted',
        });
    }
    async resyncBatch(farmId, userId, batchId) {
        return this.replaceBatchProfile(farmId, userId, batchId, {
            create: async (tx, current) => {
                if (!current.copiedFromIngredientId) {
                    throw new common_1.BadRequestException('This profile was not copied from a catalogue ingredient');
                }
                return this.createFromIngredient(farmId, userId, current.copiedFromIngredientId, tx, current.id);
            },
            makeDefault: false,
            action: 're-synced from the catalogue',
        });
    }
    async replaceBatchProfile(farmId, userId, batchId, opts) {
        const existing = await this.prisma.feedItemBatch.findFirst({
            where: { id: batchId, farmId },
            include: { nutritionProfile: true, feedItem: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Feed batch not found');
        if (existing.deletedAt || existing.feedItem.deletedAt) {
            throw new common_1.BadRequestException('Nutrition cannot be edited on an archived feed item or batch');
        }
        if (opts.expectedUpdatedAt &&
            new Date(opts.expectedUpdatedAt).getTime() !==
                existing.updatedAt.getTime()) {
            throw new common_1.ConflictException('This batch was changed by someone else — reload and try again');
        }
        const before = this.resolver.toValues(existing.nutritionProfile);
        const result = await this.prisma.$transaction(async (tx) => {
            const profile = await opts.create(tx, existing.nutritionProfile);
            const moved = await tx.feedItemBatch.updateMany({
                where: {
                    id: batchId,
                    farmId,
                    nutritionProfileId: existing.nutritionProfileId,
                },
                data: { nutritionProfileId: profile.id },
            });
            if (moved.count !== 1) {
                throw new common_1.ConflictException('This batch was changed by someone else — reload and try again');
            }
            if (opts.makeDefault) {
                await tx.feedItem.update({
                    where: { id: existing.feedItemId },
                    data: { defaultNutritionProfileId: profile.id },
                });
            }
            return profile;
        });
        const changed = (0, nutrition_profile_1.diffNutrition)(before, this.resolver.toValues(result));
        await this.audit(farmId, userId, `Feed nutrition ${opts.action}`, `${existing.feedItem.name}${existing.batchCode ? ` (lot ${existing.batchCode})` : ''}: ` +
            `profile ${existing.nutritionProfileId} -> ${result.id}` +
            (changed.length > 0 ? `; changed ${changed.join(', ')}` : ''));
        this.log.info('Feed batch nutrition profile replaced', {
            farmId,
            batchId,
            from: existing.nutritionProfileId,
            to: result.id,
            action: opts.action,
        });
        return {
            batch: { id: batchId, nutritionProfileId: result.id },
            profile: result,
        };
    }
    async audit(farmId, actorId, eventTitle, actionDetails) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.INVENTORY,
                eventTitle,
                actionDetails,
                actorId,
            });
        }
        catch (err) {
            this.log.error('Nutrition activity log failed', {
                farmId,
                eventTitle,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
exports.NutritionProfileService = NutritionProfileService;
exports.NutritionProfileService = NutritionProfileService = NutritionProfileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_lot_resolver_service_1.FeedLotResolver,
        activity_log_service_1.ActivityLogService])
], NutritionProfileService);
//# sourceMappingURL=nutrition-profile.service.js.map