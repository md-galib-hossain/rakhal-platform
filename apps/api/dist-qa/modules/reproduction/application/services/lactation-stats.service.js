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
var LactationStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LactationStatsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const milk_anomaly_1 = require("src/modules/milk/domain/milk-anomaly");
const lactation_yield_1 = require("../../domain/lactation-yield");
const lactation_curve_1 = require("../../domain/lactation-curve");
const lactation_persistency_1 = require("../../domain/lactation-persistency");
const lactation_dry_off_projection_1 = require("../../domain/lactation-dry-off-projection");
const lactation_comparison_1 = require("../../domain/lactation-comparison");
let LactationStatsService = LactationStatsService_1 = class LactationStatsService {
    prisma;
    logger;
    farmSettings;
    constructor(prisma, logger, farmSettings) {
        this.prisma = prisma;
        this.logger = logger;
        this.farmSettings = farmSettings;
        this.logger.setContext(LactationStatsService_1.name);
    }
    async getStats(farmId, lactationId) {
        const lactation = await this.getLactationOrThrow(farmId, lactationId);
        const now = new Date();
        const rangeEnd = lactation.endDate ?? now;
        const entries = await this.prisma.milkLogEntry.findMany({
            where: {
                cattleId: lactation.cattleId,
                logDate: { gte: lactation.startDate, lte: rangeEnd },
            },
            select: { logDate: true, yieldL: true, disposition: true },
        });
        const yieldEntries = entries;
        const referenceDate = rangeEnd < now ? rangeEnd : now;
        const sevenDayAvgYield = (0, lactation_yield_1.averageDailyYield)(yieldEntries, {
            referenceDate,
            windowDays: 7,
            lactationStart: lactation.startDate,
        });
        const peak = lactation.peakMilkYield != null &&
            lactation.peakDaysInMilk != null &&
            lactation.peakMilkDate != null
            ? {
                yieldL: lactation.peakMilkYield,
                date: lactation.peakMilkDate,
                dim: lactation.peakDaysInMilk,
            }
            : null;
        const persistency = (0, lactation_persistency_1.computeLactationPersistency)({
            currentSevenDayAvgYield: sevenDayAvgYield,
            peakMilkYield: lactation.peakMilkYield,
            peakDaysInMilk: lactation.peakDaysInMilk,
            currentDaysInMilk: (0, lactation_yield_1.daysBetween)(lactation.startDate, referenceDate),
        });
        const currentDaysInMilk = (0, lactation_yield_1.daysBetween)(lactation.startDate, referenceDate);
        const lactationToDate = (0, lactation_yield_1.totalsByDisposition)(yieldEntries);
        const dryOffProjection = await this.resolveDryOffProjection(farmId, lactation);
        const minDim = await this.farmSettings.minDimFor305DayYield(farmId);
        return {
            lactationId: lactation.id,
            cattleId: lactation.cattleId,
            tagNumber: lactation.cattleTagNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
            today: (0, lactation_yield_1.sumYieldForDay)(yieldEntries, referenceDate),
            sevenDayAvgYield,
            thirtyDayAvgYield: (0, lactation_yield_1.averageDailyYield)(yieldEntries, {
                referenceDate,
                windowDays: 30,
                lactationStart: lactation.startDate,
            }),
            lactationToDate,
            peak,
            persistency,
            recommendedDryOffAt: lactation.recommendedDryOffAt,
            plannedDryOffAt: lactation.plannedDryOffAt,
            managementEstimateDimRange: dryOffProjection.managementEstimateDimRange,
            dryOffConfidence: dryOffProjection.confidence,
            dryOffProjectionReason: dryOffProjection.reason,
            standardized305DayYield: (0, lactation_dry_off_projection_1.computeStandardized305DayYield)({
                producedToDateL: lactationToDate.produced,
                daysInMilk: currentDaysInMilk,
                minDimThreshold: minDim,
            }),
        };
    }
    async updatePlannedDryOff(farmId, lactationId, plannedDryOffAt) {
        await this.getLactationOrThrow(farmId, lactationId);
        return this.prisma.lactation.update({
            where: { id: lactationId },
            data: { plannedDryOffAt },
        });
    }
    async resolveDryOffProjection(farmId, lactation) {
        if (lactation.recommendedDryOffAt) {
            return {
                recommendedDryOffAt: lactation.recommendedDryOffAt,
                managementEstimateDimRange: null,
                confidence: null,
                reason: null,
            };
        }
        const priorLactations = await this.prisma.lactation.findMany({
            where: {
                cattleId: lactation.cattleId,
                id: { not: lactation.id },
                endDate: { not: null },
            },
            select: { startDate: true, endDate: true },
        });
        const previousLactationLengthsDays = priorLactations
            .filter((l) => l.endDate != null)
            .map((l) => (0, lactation_yield_1.daysBetween)(l.startDate, l.endDate));
        return (0, lactation_dry_off_projection_1.computeDryOffProjection)({
            isPregnant: false,
            previousLactationLengthsDays,
        });
    }
    async getCurve(farmId, lactationId, compareLactationId) {
        const lactation = await this.getLactationOrThrow(farmId, lactationId);
        const expectedSessions = await this.resolveExpectedSessions(farmId);
        const series = await this.buildSeriesFor(lactation, expectedSessions);
        let compareSeries = null;
        let compareLactation = null;
        if (compareLactationId) {
            compareLactation = await this.getLactationOrThrow(farmId, compareLactationId);
            compareSeries = await this.buildSeriesFor(compareLactation, expectedSessions);
        }
        return {
            lactationId: lactation.id,
            cattleId: lactation.cattleId,
            series,
            compareLactationId: compareLactation?.id ?? null,
            compareCattleId: compareLactation?.cattleId ?? null,
            compareSeries,
        };
    }
    async buildSeriesFor(lactation, expectedSessions) {
        const rangeEnd = lactation.endDate ?? new Date();
        const entries = await this.prisma.milkLogEntry.findMany({
            where: {
                cattleId: lactation.cattleId,
                logDate: { gte: lactation.startDate, lte: rangeEnd },
            },
            select: { logDate: true, session: true, yieldL: true },
        });
        const curveEntries = entries;
        return (0, lactation_curve_1.buildDailyYieldSeries)({
            startDate: lactation.startDate,
            endDate: rangeEnd,
            entries: curveEntries,
            expectedSessions,
        });
    }
    async resolveExpectedSessions(farmId) {
        const configured = await this.farmSettings.milkActiveSessions(farmId);
        return configured.length > 0 ? configured : milk_anomaly_1.DEFAULT_SESSION_CONFIG;
    }
    async getLactationOrThrow(farmId, lactationId) {
        const lactation = await this.prisma.lactation.findFirst({
            where: { id: lactationId, cattle: { farmId } },
            select: {
                id: true,
                cattleId: true,
                lactationNumber: true,
                startDate: true,
                endDate: true,
                peakMilkYield: true,
                peakMilkDate: true,
                peakDaysInMilk: true,
                recommendedDryOffAt: true,
                plannedDryOffAt: true,
                cattle: { select: { tagNumber: true } },
            },
        });
        if (!lactation) {
            throw new common_1.NotFoundException('Lactation not found');
        }
        return {
            id: lactation.id,
            cattleId: lactation.cattleId,
            lactationNumber: lactation.lactationNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
            cattleTagNumber: lactation.cattle.tagNumber,
            peakMilkYield: lactation.peakMilkYield,
            peakMilkDate: lactation.peakMilkDate,
            peakDaysInMilk: lactation.peakDaysInMilk,
            recommendedDryOffAt: lactation.recommendedDryOffAt,
            plannedDryOffAt: lactation.plannedDryOffAt,
        };
    }
    async compareLactations(farmId, cattleId, byLactationNumber) {
        const current = await this.getCurrentLactationOrThrow(farmId, cattleId);
        const previous = byLactationNumber
            ? await this.findLactationByNumber(farmId, cattleId, current.lactationNumber - 1)
            : await this.findPreviousEndedLactation(farmId, cattleId, current.id);
        const expectedSessions = await this.resolveExpectedSessions(farmId);
        const [currentSeries, previousSeries] = await Promise.all([
            this.buildSeriesFor(current, expectedSessions),
            previous
                ? this.buildSeriesFor(previous, expectedSessions)
                : Promise.resolve([]),
        ]);
        const [currentSummary, previousSummary] = await Promise.all([
            this.buildComparisonSummary(current),
            previous ? this.buildComparisonSummary(previous) : Promise.resolve(null),
        ]);
        return {
            cattleId,
            tagNumber: current.cattleTagNumber,
            byLactationNumber,
            current: currentSummary,
            previous: previousSummary,
            alignedSeries: (0, lactation_comparison_1.alignSeriesByDim)(currentSeries, previousSeries),
        };
    }
    async compareGroups(farmId, groupBy) {
        const now = new Date();
        const activeLactations = await this.prisma.lactation.findMany({
            where: { status: client_1.LactationStatus.ACTIVE, cattle: { farmId } },
            select: {
                id: true,
                cattleId: true,
                lactationNumber: true,
                startDate: true,
                endDate: true,
                peakMilkYield: true,
                peakDaysInMilk: true,
                cattle: {
                    select: {
                        shedId: true,
                        shed: { select: { name: true } },
                    },
                },
            },
        });
        if (activeLactations.length === 0)
            return [];
        const cattleIds = activeLactations.map((l) => l.cattleId);
        const earliestStart = activeLactations.reduce((min, l) => (l.startDate < min ? l.startDate : min), activeLactations[0].startDate);
        const entries = await this.prisma.milkLogEntry.findMany({
            where: { cattleId: { in: cattleIds }, logDate: { gte: earliestStart } },
            select: {
                cattleId: true,
                logDate: true,
                yieldL: true,
                disposition: true,
            },
        });
        const entriesByCattle = new Map();
        for (const entry of entries) {
            const bucket = entriesByCattle.get(entry.cattleId) ?? [];
            bucket.push(entry);
            entriesByCattle.set(entry.cattleId, bucket);
        }
        const snapshots = activeLactations.map((lactation) => {
            const dim = (0, lactation_yield_1.daysBetween)(lactation.startDate, now);
            const sevenDayAvgYield = (0, lactation_yield_1.averageDailyYield)(entriesByCattle.get(lactation.cattleId) ?? [], {
                referenceDate: now,
                windowDays: 7,
                lactationStart: lactation.startDate,
            });
            const persistency = (0, lactation_persistency_1.computeLactationPersistency)({
                currentSevenDayAvgYield: sevenDayAvgYield,
                peakMilkYield: lactation.peakMilkYield,
                peakDaysInMilk: lactation.peakDaysInMilk,
                currentDaysInMilk: dim,
            });
            const { bucketKey, bucketLabel } = this.resolveGroupBucket(groupBy, {
                lactationNumber: lactation.lactationNumber,
                dim,
                shedId: lactation.cattle.shedId,
                shedName: lactation.cattle.shed?.name ?? null,
            });
            return {
                cattleId: lactation.cattleId,
                lactationId: lactation.id,
                bucketKey,
                bucketLabel,
                dim,
                sevenDayAvgYield,
                peakMilkYield: lactation.peakMilkYield,
                persistencyPct: persistency?.persistencyPct ?? null,
            };
        });
        return (0, lactation_comparison_1.aggregateByBucket)(snapshots);
    }
    resolveGroupBucket(groupBy, input) {
        switch (groupBy) {
            case 'parity': {
                const key = (0, lactation_comparison_1.parityBucketKey)(input.lactationNumber);
                return { bucketKey: key, bucketLabel: `Parity ${key}` };
            }
            case 'dimRange': {
                const key = (0, lactation_comparison_1.dimRangeBucketKey)(input.dim);
                return { bucketKey: key, bucketLabel: (0, lactation_comparison_1.dimRangeBucketLabel)(key) };
            }
            case 'shed':
                return {
                    bucketKey: input.shedId ?? 'UNASSIGNED',
                    bucketLabel: input.shedName ?? 'Unassigned',
                };
        }
    }
    async buildComparisonSummary(lactation) {
        const now = new Date();
        const rangeEnd = lactation.endDate ?? now;
        const referenceDate = rangeEnd < now ? rangeEnd : now;
        const entries = await this.prisma.milkLogEntry.findMany({
            where: {
                cattleId: lactation.cattleId,
                logDate: { gte: lactation.startDate, lte: rangeEnd },
            },
            select: { logDate: true, yieldL: true, disposition: true },
        });
        const yieldEntries = entries;
        const dim = (0, lactation_yield_1.daysBetween)(lactation.startDate, referenceDate);
        const sevenDayAvgYield = (0, lactation_yield_1.averageDailyYield)(yieldEntries, {
            referenceDate,
            windowDays: 7,
            lactationStart: lactation.startDate,
        });
        const peak = lactation.peakMilkYield != null &&
            lactation.peakDaysInMilk != null &&
            lactation.peakMilkDate != null
            ? {
                yieldL: lactation.peakMilkYield,
                date: lactation.peakMilkDate,
                dim: lactation.peakDaysInMilk,
            }
            : null;
        return {
            lactationId: lactation.id,
            lactationNumber: lactation.lactationNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
            dim,
            sevenDayAvgYield,
            thirtyDayAvgYield: (0, lactation_yield_1.averageDailyYield)(yieldEntries, {
                referenceDate,
                windowDays: 30,
                lactationStart: lactation.startDate,
            }),
            lactationToDate: (0, lactation_yield_1.totalsByDisposition)(yieldEntries),
            peak,
            persistency: (0, lactation_persistency_1.computeLactationPersistency)({
                currentSevenDayAvgYield: sevenDayAvgYield,
                peakMilkYield: lactation.peakMilkYield,
                peakDaysInMilk: lactation.peakDaysInMilk,
                currentDaysInMilk: dim,
            }),
        };
    }
    async getCurrentLactationOrThrow(farmId, cattleId) {
        const lactation = await this.prisma.lactation.findFirst({
            where: {
                cattleId,
                status: client_1.LactationStatus.ACTIVE,
                cattle: { farmId },
            },
            select: this.lactationForAccessSelect(),
        });
        if (!lactation) {
            throw new common_1.NotFoundException('No active lactation found for this cattle');
        }
        return this.mapLactationForAccess(lactation);
    }
    async findLactationByNumber(farmId, cattleId, lactationNumber) {
        if (lactationNumber < 1)
            return null;
        const lactation = await this.prisma.lactation.findFirst({
            where: { cattleId, lactationNumber, cattle: { farmId } },
            select: this.lactationForAccessSelect(),
        });
        return lactation ? this.mapLactationForAccess(lactation) : null;
    }
    async findPreviousEndedLactation(farmId, cattleId, excludeLactationId) {
        const lactation = await this.prisma.lactation.findFirst({
            where: {
                cattleId,
                id: { not: excludeLactationId },
                endDate: { not: null },
                cattle: { farmId },
            },
            orderBy: [{ endDate: 'desc' }],
            select: this.lactationForAccessSelect(),
        });
        return lactation ? this.mapLactationForAccess(lactation) : null;
    }
    lactationForAccessSelect() {
        return {
            id: true,
            cattleId: true,
            lactationNumber: true,
            startDate: true,
            endDate: true,
            peakMilkYield: true,
            peakMilkDate: true,
            peakDaysInMilk: true,
            recommendedDryOffAt: true,
            plannedDryOffAt: true,
            cattle: { select: { tagNumber: true } },
        };
    }
    mapLactationForAccess(lactation) {
        return {
            id: lactation.id,
            cattleId: lactation.cattleId,
            lactationNumber: lactation.lactationNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
            cattleTagNumber: lactation.cattle.tagNumber,
            peakMilkYield: lactation.peakMilkYield,
            peakMilkDate: lactation.peakMilkDate,
            peakDaysInMilk: lactation.peakDaysInMilk,
            recommendedDryOffAt: lactation.recommendedDryOffAt,
            plannedDryOffAt: lactation.plannedDryOffAt,
        };
    }
};
exports.LactationStatsService = LactationStatsService;
exports.LactationStatsService = LactationStatsService = LactationStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        farm_settings_service_1.FarmSettingsService])
], LactationStatsService);
//# sourceMappingURL=lactation-stats.service.js.map