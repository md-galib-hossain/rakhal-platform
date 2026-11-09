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
exports.FeedLookaheadService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const requirement_settings_service_1 = require("./requirement-settings.service");
const lookahead_1 = require("../../domain/lookahead");
let FeedLookaheadService = class FeedLookaheadService {
    prisma;
    requirementSettings;
    constructor(prisma, requirementSettings) {
        this.prisma = prisma;
        this.requirementSettings = requirementSettings;
    }
    async forCattle(farmId, cattleIds, now) {
        const out = new Map();
        if (cattleIds.length === 0)
            return out;
        const [settings, pregnancies, lactations] = await Promise.all([
            this.requirementSettings.resolve(farmId),
            this.prisma.pregnancy.findMany({
                where: { cattleId: { in: cattleIds }, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                select: { cattleId: true, expectedCalvingDate: true },
            }),
            this.prisma.lactation.findMany({
                where: { cattleId: { in: cattleIds }, status: 'ACTIVE' },
                orderBy: { startDate: 'desc' },
                select: {
                    cattleId: true,
                    startDate: true,
                    plannedDryOffAt: true,
                    recommendedDryOffAt: true,
                    peakDaysInMilk: true,
                },
            }),
        ]);
        const pregnancyByCow = new Map();
        for (const p of pregnancies) {
            if (!pregnancyByCow.has(p.cattleId)) {
                pregnancyByCow.set(p.cattleId, p.expectedCalvingDate);
            }
        }
        const lactationByCow = new Map();
        for (const l of lactations) {
            if (!lactationByCow.has(l.cattleId))
                lactationByCow.set(l.cattleId, l);
        }
        for (const id of cattleIds) {
            const lactation = lactationByCow.get(id);
            const events = (0, lookahead_1.computeLookahead)({
                now,
                windowDays: settings.lookaheadDays,
                expectedCalvingDate: pregnancyByCow.get(id),
                dryOffDate: lactation?.plannedDryOffAt ?? lactation?.recommendedDryOffAt,
                lactationStart: lactation?.startDate,
                peakDaysInMilk: lactation?.peakDaysInMilk,
            });
            if (events.length > 0)
                out.set(id, events);
        }
        return out;
    }
};
exports.FeedLookaheadService = FeedLookaheadService;
exports.FeedLookaheadService = FeedLookaheadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        requirement_settings_service_1.RequirementSettingsService])
], FeedLookaheadService);
//# sourceMappingURL=feed-lookahead.service.js.map