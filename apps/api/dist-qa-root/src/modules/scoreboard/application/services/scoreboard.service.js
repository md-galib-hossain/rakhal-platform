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
var ScoreboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const TOP_TIER_AQR = 90;
const round1 = (n) => Math.round(n * 10) / 10;
let ScoreboardService = ScoreboardService_1 = class ScoreboardService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ScoreboardService_1.name);
    }
    async join(farmId, userId, dto) {
        if (!dto.accept_data_visibility_terms) {
            throw new common_1.BadRequestException('You must accept the data-visibility terms to join the leaderboard');
        }
        const now = new Date();
        const row = await this.prisma.scoreboardParticipation.upsert({
            where: { farmId },
            create: { farmId, joinedBy: userId, acceptedTermsAt: now },
            update: { joinedBy: userId, acceptedTermsAt: now },
        });
        this.log.info('Farm joined scoreboard', { farmId });
        return { leaderboard_joined: true, visible_from: row.joinedAt };
    }
    async leave(farmId) {
        await this.prisma.scoreboardParticipation.deleteMany({ where: { farmId } });
        this.log.info('Farm left scoreboard', { farmId });
        return { leaderboard_joined: false };
    }
    async highlights(farmId) {
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: {
                district: true,
                scoreboardParticipation: { select: { id: true } },
            },
        });
        const herdWhere = {
            farmId,
            isActive: true,
            aqrScore: { not: null },
        };
        const [topTier, bestCow, avgAgg] = await Promise.all([
            this.prisma.cattle.count({
                where: { ...herdWhere, aqrScore: { gte: TOP_TIER_AQR } },
            }),
            this.prisma.cattle.findFirst({
                where: herdWhere,
                orderBy: { aqrScore: 'desc' },
                select: { id: true, name: true, tagNumber: true, aqrScore: true },
            }),
            this.prisma.cattle.aggregate({
                where: herdWhere,
                _avg: { aqrScore: true },
            }),
        ]);
        return {
            top_tier_cows_count: topTier,
            best_performing_cow: bestCow
                ? {
                    id: bestCow.id,
                    name: bestCow.name ?? bestCow.tagNumber,
                    aqr_score: round1(bestCow.aqrScore ?? 0),
                }
                : null,
            best_performing_farm_in_district: await this.bestFarmInDistrict(farmId, farm.district),
            avg_herd_aqr: avgAgg._avg.aqrScore ? round1(avgAgg._avg.aqrScore) : null,
            aqr_change_pct: null,
            change_period: 'vs_last_month',
            leaderboard_joined: Boolean(farm.scoreboardParticipation),
        };
    }
    async leaderboard(farmId, query) {
        const scopedFarmIds = await this.scopedFarmIds(farmId, query.scope);
        return query.view === 'top_firms'
            ? this.topFirms(farmId, scopedFarmIds, query)
            : this.starCows(farmId, scopedFarmIds, query);
    }
    async starCows(farmId, scopedFarmIds, query) {
        const where = {
            farmId: { in: scopedFarmIds },
            isActive: true,
            aqrScore: { not: null },
        };
        const offset = (query.page - 1) * query.per_page;
        const [total, rows] = await Promise.all([
            this.prisma.cattle.count({ where }),
            this.prisma.cattle.findMany({
                where,
                orderBy: [{ aqrScore: 'desc' }, { id: 'asc' }],
                skip: offset,
                take: query.per_page,
                select: {
                    id: true,
                    name: true,
                    tagNumber: true,
                    aqrScore: true,
                    farmId: true,
                    breed: { select: { name: true } },
                    farm: { select: { name: true, district: true } },
                },
            }),
        ]);
        const milkByCow = await this.recentDailyMilk(rows.map((r) => r.id));
        const entries = rows.map((r, i) => ({
            rank: offset + i + 1,
            rank_trend: 'stable',
            cattle_id: r.id,
            name: r.name ?? r.tagNumber,
            tag: r.tagNumber,
            breed: r.breed?.name ?? null,
            farm_name: r.farm.name,
            district: r.farm.district,
            aqr_score: round1(r.aqrScore ?? 0),
            milk_production_l_day: milkByCow.get(r.id) ?? 0,
            market_value: null,
            is_own: r.farmId === farmId,
        }));
        return {
            scope: query.scope,
            view: 'star_cows',
            own_farm_id: farmId,
            entries,
            meta: { page: query.page, per_page: query.per_page, total },
        };
    }
    async topFirms(farmId, scopedFarmIds, query) {
        const grouped = await this.prisma.cattle.groupBy({
            by: ['farmId'],
            where: {
                farmId: { in: scopedFarmIds },
                herdStatus: 'ACTIVE',
                deletedAt: null,
                aqrScore: { not: null },
            },
            _avg: { aqrScore: true },
            _count: { _all: true },
        });
        const ranked = grouped
            .map((g) => ({
            farmId: g.farmId,
            avg_aqr: round1(g._avg.aqrScore ?? 0),
            cattle_count: g._count._all,
        }))
            .sort((a, b) => b.avg_aqr - a.avg_aqr);
        const farms = await this.prisma.farm.findMany({
            where: { id: { in: ranked.map((r) => r.farmId) } },
            select: { id: true, name: true, district: true },
        });
        const farmById = new Map(farms.map((f) => [f.id, f]));
        const offset = (query.page - 1) * query.per_page;
        const entries = ranked
            .slice(offset, offset + query.per_page)
            .map((r, i) => ({
            rank: offset + i + 1,
            rank_trend: 'stable',
            farm_id: r.farmId,
            farm_name: farmById.get(r.farmId)?.name ?? null,
            district: farmById.get(r.farmId)?.district ?? null,
            avg_aqr: r.avg_aqr,
            cattle_count: r.cattle_count,
            is_own: r.farmId === farmId,
        }));
        return {
            scope: query.scope,
            view: 'top_firms',
            own_farm_id: farmId,
            entries,
            meta: {
                page: query.page,
                per_page: query.per_page,
                total: ranked.length,
            },
        };
    }
    async scopedFarmIds(farmId, scope) {
        const participations = await this.prisma.scoreboardParticipation.findMany({
            select: {
                farmId: true,
                farm: { select: { district: true, division: true } },
            },
        });
        if (scope === 'national')
            return participations.map((p) => p.farmId);
        const me = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { district: true, division: true },
        });
        return participations
            .filter((p) => scope === 'district'
            ? me?.district && p.farm.district === me.district
            : me?.division && p.farm.division === me.division)
            .map((p) => p.farmId);
    }
    async bestFarmInDistrict(farmId, district) {
        if (!district)
            return null;
        const participants = await this.prisma.scoreboardParticipation.findMany({
            where: { farm: { district } },
            select: { farmId: true, farm: { select: { name: true } } },
        });
        if (participants.length === 0)
            return null;
        const grouped = await this.prisma.cattle.groupBy({
            by: ['farmId'],
            where: {
                farmId: { in: participants.map((p) => p.farmId) },
                herdStatus: 'ACTIVE',
                deletedAt: null,
                aqrScore: { not: null },
            },
            _avg: { aqrScore: true },
        });
        if (grouped.length === 0)
            return null;
        const best = grouped.reduce((a, b) => (b._avg.aqrScore ?? 0) > (a._avg.aqrScore ?? 0) ? b : a);
        const name = participants.find((p) => p.farmId === best.farmId)?.farm.name ?? null;
        return { name, avg_aqr: round1(best._avg.aqrScore ?? 0) };
    }
    async recentDailyMilk(cattleIds) {
        if (cattleIds.length === 0)
            return new Map();
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const grouped = await this.prisma.milkLogEntry.groupBy({
            by: ['cattleId'],
            where: { cattleId: { in: cattleIds }, logDate: { gte: since } },
            _sum: { yieldL: true },
        });
        return new Map(grouped.map((g) => [g.cattleId, round1((g._sum.yieldL ?? 0) / 7)]));
    }
};
exports.ScoreboardService = ScoreboardService;
exports.ScoreboardService = ScoreboardService = ScoreboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ScoreboardService);
//# sourceMappingURL=scoreboard.service.js.map