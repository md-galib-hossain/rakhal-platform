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
var FarmSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmSettingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let FarmSettingsService = FarmSettingsService_1 = class FarmSettingsService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(FarmSettingsService_1.name);
    }
    async getEffective(farmId) {
        const existing = await this.prisma.farmModuleSettings.findUnique({
            where: { farmId },
        });
        if (existing)
            return existing;
        try {
            return await this.prisma.farmModuleSettings.create({ data: { farmId } });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                return this.prisma.farmModuleSettings.findUniqueOrThrow({
                    where: { farmId },
                });
            }
            throw e;
        }
    }
    async reproVwpDays(farmId) {
        return (await this.getEffective(farmId)).reproVwpDays;
    }
    async reproPregnancyCheckDays(farmId) {
        return (await this.getEffective(farmId)).reproPregnancyCheckDays;
    }
    async reproDryPeriodTargetDays(farmId) {
        return (await this.getEffective(farmId)).reproDryPeriodTargetDays;
    }
    async reproHeatWindowDays(farmId) {
        return (await this.getEffective(farmId)).reproHeatWindowDays;
    }
    async reproCloseUpWindowDays(farmId) {
        return (await this.getEffective(farmId)).reproCloseUpWindowDays;
    }
    async lactationStageThresholds(farmId) {
        const s = await this.getEffective(farmId);
        return {
            freshDays: s.lactationFreshDays,
            earlyDays: s.lactationEarlyDays,
            midDays: s.lactationMidDays,
        };
    }
    async pregnancyStageThresholds(farmId) {
        const s = await this.getEffective(farmId);
        return { earlyDays: s.pregnancyEarlyDays, midDays: s.pregnancyMidDays };
    }
    async reproOverduePregnancyCheckDays(farmId) {
        return (await this.getEffective(farmId)).reproOverduePregnancyCheckDays;
    }
    async reproRepeatBreederThreshold(farmId) {
        return (await this.getEffective(farmId)).reproRepeatBreederThreshold;
    }
    async reproLongDaysOpenDays(farmId) {
        return (await this.getEffective(farmId)).reproLongDaysOpenDays;
    }
    async reproCalvingOverdueDays(farmId) {
        return (await this.getEffective(farmId)).reproCalvingOverdueDays;
    }
    async milkAnomalyFraction(farmId) {
        const pct = (await this.getEffective(farmId)).milkAnomalyThresholdPct;
        return Math.max(0, Math.min(1, 1 - pct / 100));
    }
    async financeRunwayThresholds(farmId) {
        const s = await this.getEffective(farmId);
        return {
            warningDays: s.financeRunwayWarningDays,
            criticalDays: s.financeRunwayCriticalDays,
        };
    }
    async healthScoreWarningPct(farmId) {
        return (await this.getEffective(farmId)).healthScoreWarningPct;
    }
    async milkColostrumWindowDays(farmId) {
        return (await this.getEffective(farmId)).milkColostrumWindowDays;
    }
    async milkActiveSessions(farmId) {
        const stored = (await this.getEffective(farmId)).milkActiveSessions;
        const valid = new Set(Object.values(client_1.MilkSession));
        return stored
            .map((s) => s.toUpperCase())
            .filter((s) => valid.has(s));
    }
    async minDimFor305DayYield(farmId) {
        return (await this.getEffective(farmId)).minDimFor305DayYield;
    }
    async lifecycleBoundaries(farmId) {
        const s = await this.getEffective(farmId);
        return {
            weaningDays: s.cattleLifecycleWeaningDays,
            growingStartDays: s.cattleLifecycleGrowingStartDays,
            breedingAgeDays: s.cattleLifecycleBreedingAgeDays,
        };
    }
    async lactationSuddenDropThresholdPct(farmId) {
        return (await this.getEffective(farmId)).milkAnomalyThresholdPct;
    }
    async lactationLongNotPregnantDimDays(farmId) {
        return (await this.getEffective(farmId)).reproLongDaysOpenDays;
    }
};
exports.FarmSettingsService = FarmSettingsService;
exports.FarmSettingsService = FarmSettingsService = FarmSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], FarmSettingsService);
//# sourceMappingURL=farm-settings.service.js.map