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
var LactationEconomicsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LactationEconomicsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const lactation_economics_1 = require("../../domain/lactation-economics");
const lactation_yield_1 = require("../../domain/lactation-yield");
const lactation_stats_service_1 = require("./lactation-stats.service");
const cattle_finance_aggregation_1 = require("../../../cattle/application/services/cattle-finance-aggregation");
let LactationEconomicsService = LactationEconomicsService_1 = class LactationEconomicsService {
    prisma;
    logger;
    lactationStatsService;
    constructor(prisma, logger, lactationStatsService) {
        this.prisma = prisma;
        this.logger = logger;
        this.lactationStatsService = lactationStatsService;
        this.logger.setContext(LactationEconomicsService_1.name);
    }
    async getEconomics(farmId, lactationId) {
        const lactation = await this.getLactationOrThrow(farmId, lactationId);
        const rangeEnd = lactation.endDate ?? new Date();
        const stats = await this.lactationStatsService.getStats(farmId, lactationId);
        const effectiveMilkRatePerLitre = await this.resolveEffectiveMilkRate(farmId, rangeEnd);
        const feedCost = await this.computeAllocatedFeedCost(farmId, lactation.cattleId, lactation.startDate, rangeEnd);
        const cattleFinance = await (0, cattle_finance_aggregation_1.computeCattleFinance)(this.prisma, farmId, lactation.cattleId, lactation.startDate, rangeEnd);
        const medicineCost = cattleFinance.expense.health;
        const breedingCost = cattleFinance.expense.breeding;
        const milkRevenue = (0, lactation_economics_1.computeMilkRevenue)(stats.lactationToDate.saleable, effectiveMilkRatePerLitre);
        const discardedWithheldValue = (0, lactation_economics_1.computeDiscardedWithheldValue)(stats.lactationToDate.withheld, stats.lactationToDate.discarded, effectiveMilkRatePerLitre);
        const financialTotals = (0, lactation_economics_1.computeLactationMargin)({
            milkRevenue,
            feedCost,
            medicineCost,
            breedingCost,
            discardedWithheldValue,
        });
        return {
            lactationId: lactation.id,
            cattleId: lactation.cattleId,
            tagNumber: lactation.cattleTagNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
            biological: {
                dim: (0, lactation_yield_1.daysBetween)(lactation.startDate, rangeEnd),
                today: stats.today,
                sevenDayAvgYield: stats.sevenDayAvgYield,
                thirtyDayAvgYield: stats.thirtyDayAvgYield,
                lactationToDate: stats.lactationToDate,
                peak: stats.peak,
                persistency: stats.persistency,
            },
            financial: {
                ...financialTotals,
                effectiveMilkRatePerLitre,
                saleableLitres: stats.lactationToDate.saleable,
                withheldLitres: stats.lactationToDate.withheld,
                discardedLitres: stats.lactationToDate.discarded,
            },
            assumptions: [
                "Milk revenue uses one effective rate per litre for the whole farm (the most recent dispatch price, or the average of active buyers' base price when no dispatch exists yet) — milk sales are not tracked per cow in this system.",
                "Feed cost counts only this cow's own individual feed distributions; herd-wide rations are not allocated per cow.",
            ],
        };
    }
    async resolveEffectiveMilkRate(farmId, onOrBefore) {
        const latestDispatch = await this.prisma.milkDispatch.findFirst({
            where: { farmId, cancelledAt: null, dispatchedAt: { lte: onOrBefore } },
            orderBy: { dispatchedAt: 'desc' },
            select: { basePricePerLitre: true },
        });
        if (latestDispatch)
            return latestDispatch.basePricePerLitre;
        const activeBuyers = await this.prisma.milkBuyer.findMany({
            where: { farmId, deletedAt: null },
            select: { basePricePerLitre: true },
        });
        if (activeBuyers.length === 0)
            return 0;
        const sum = activeBuyers.reduce((s, b) => s + b.basePricePerLitre, 0);
        return sum / activeBuyers.length;
    }
    async computeAllocatedFeedCost(farmId, cattleId, startDate, rangeEnd) {
        const distributions = await this.prisma.feedDistribution.findMany({
            where: {
                farmId,
                cattleId,
                distributedAt: { gte: startDate, lte: rangeEnd },
            },
            select: { totalActualCost: true },
        });
        const total = distributions.reduce((sum, d) => sum + d.totalActualCost, 0);
        return Math.round(total * 100) / 100;
    }
    async getLactationOrThrow(farmId, lactationId) {
        const lactation = await this.prisma.lactation.findFirst({
            where: { id: lactationId, cattle: { farmId } },
            select: {
                id: true,
                cattleId: true,
                startDate: true,
                endDate: true,
                cattle: { select: { tagNumber: true } },
            },
        });
        if (!lactation) {
            throw new common_1.NotFoundException('Lactation not found');
        }
        return {
            id: lactation.id,
            cattleId: lactation.cattleId,
            cattleTagNumber: lactation.cattle.tagNumber,
            startDate: lactation.startDate,
            endDate: lactation.endDate,
        };
    }
};
exports.LactationEconomicsService = LactationEconomicsService;
exports.LactationEconomicsService = LactationEconomicsService = LactationEconomicsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        lactation_stats_service_1.LactationStatsService])
], LactationEconomicsService);
//# sourceMappingURL=lactation-economics.service.js.map