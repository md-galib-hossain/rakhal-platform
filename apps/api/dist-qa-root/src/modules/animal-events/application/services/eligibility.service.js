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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EligibilityService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const event_registry_1 = require("../../domain/event-registry");
const categories_1 = require("../../domain/eligibility/categories");
const evaluate_1 = require("../../domain/eligibility/evaluate");
const animal_event_types_service_1 = require("./animal-event-types.service");
let EligibilityService = class EligibilityService {
    prisma;
    settings;
    registry;
    constructor(prisma, settings, registry) {
        this.prisma = prisma;
        this.settings = settings;
        this.registry = registry;
    }
    async context(farmId, opts = {}) {
        const s = await this.settings.getEffective(farmId);
        return {
            now: opts.now ?? new Date(),
            weaningDays: s.cattleLifecycleWeaningDays,
            breedingAgeDays: s.cattleLifecycleBreedingAgeDays,
            freshDays: s.lactationFreshDays,
            fatteningCattleIds: opts.withFattening
                ? await this.fatteningCattleIds(farmId)
                : undefined,
        };
    }
    async categoryWhere(farmId, category) {
        const ctx = await this.context(farmId, {
            withFattening: category === 'FATTENING',
        });
        return categories_1.CATEGORY_RULES[category].where(ctx);
    }
    async fatteningCattleIds(farmId) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT DISTINCT e."cattleId" FROM "AnimalEvent" e
       WHERE e."farmId" = ${farmId} AND e.type = 'ENTER_FATTENING' AND e.status = 'ACTIVE'
         AND NOT EXISTS (
           SELECT 1 FROM "AnimalEvent" l
            WHERE l."cattleId" = e."cattleId" AND l.type = 'LEAVE_FATTENING' AND l.status = 'ACTIVE'
              AND (l."eventAt" > e."eventAt" OR (l."eventAt" = e."eventAt" AND l."createdAt" >= e."createdAt")))`);
        return rows.map((r) => r.cattleId);
    }
    async loadFacts(farmId, cattleId, now) {
        const row = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: {
                id: true,
                gender: true,
                dateOfBirth: true,
                productionStatus: true,
                herdStatus: true,
                reproductionProfile: {
                    select: { totalCalvings: true, reproductiveStatus: true },
                },
                lactations: {
                    where: { status: 'ACTIVE' },
                    select: { startDate: true },
                    orderBy: { startDate: 'desc' },
                    take: 1,
                },
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Animal not found');
        const ctx = await this.context(farmId, { now });
        const fattening = await this.fatteningCattleIds(farmId);
        const facts = {
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
            productionStatus: row.productionStatus,
            reproductiveStatus: row.reproductionProfile?.reproductiveStatus ?? null,
            activeLactationStart: row.lactations[0]?.startDate ?? null,
            inFattening: fattening.includes(row.id),
        };
        return { facts, ctx, leftHerd: row.herdStatus !== 'ACTIVE' };
    }
    async eligible(farmId, cattleId, date) {
        const { facts, ctx, leftHerd } = await this.loadFacts(farmId, cattleId);
        return {
            categories: (0, categories_1.categoriesOf)(facts, ctx),
            types: this.registry
                .all()
                .map((def) => (0, evaluate_1.evaluateEligibility)(def, { facts, ctx, date, leftHerd })),
        };
    }
};
exports.EligibilityService = EligibilityService;
exports.EligibilityService = EligibilityService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_settings_service_1.FarmSettingsService,
        event_registry_1.EventRegistry])
], EligibilityService);
//# sourceMappingURL=eligibility.service.js.map