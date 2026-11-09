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
var ReproductionDerivationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproductionDerivationService = void 0;
exports.deriveReproductionState = deriveReproductionState;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const breeding_status_1 = require("../../domain/breeding-status");
const reproduction_fold_1 = require("../../domain/reproduction-fold");
const reproduction_fold_facts_1 = require("./reproduction-fold-facts");
const lactation_dry_off_projection_1 = require("../../domain/lactation-dry-off-projection");
const MIN_BREEDING_AGE_DAYS = 450;
const DAY_MS = 24 * 60 * 60 * 1000;
function deriveReproductionState(input) {
    const { now, gender, dateOfBirth, hasBreedingHistory, hasActivePregnancy, lastBreeding, lastCalving, vwpDays, breedingAgeDays = MIN_BREEDING_AGE_DAYS, } = input;
    const ageDays = dateOfBirth
        ? Math.floor((now.getTime() - dateOfBirth.getTime()) / DAY_MS)
        : null;
    const underBreedingAge = ageDays !== null && ageDays < breedingAgeDays;
    if (gender !== client_1.CattleGender.FEMALE ||
        (underBreedingAge && !hasBreedingHistory)) {
        return client_1.ReproductionState.NOT_ELIGIBLE;
    }
    if (hasActivePregnancy) {
        return client_1.ReproductionState.PREGNANT;
    }
    if (lastBreeding?.status === client_1.BreedingStatus.PENDING_CHECK) {
        return client_1.ReproductionState.BRED_AWAITING_CONFIRMATION;
    }
    if (lastCalving) {
        const daysSinceCalving = Math.floor((now.getTime() - lastCalving.calvingDate.getTime()) / DAY_MS);
        if (daysSinceCalving < vwpDays) {
            return client_1.ReproductionState.POSTPARTUM_WAITING;
        }
    }
    return client_1.ReproductionState.OPEN;
}
let ReproductionDerivationService = ReproductionDerivationService_1 = class ReproductionDerivationService {
    prisma;
    farmSettings;
    log;
    constructor(prisma, farmSettings, logger) {
        this.prisma = prisma;
        this.farmSettings = farmSettings;
        this.log = logger.setContext(ReproductionDerivationService_1.name);
    }
    async refreshDerivedState(farmId, cattleId) {
        await this.refreshPregnancyStatuses(cattleId);
        await this.refreshBreedingEventStatuses(cattleId);
        await this.refreshCattleProductionStatus(cattleId);
        await this.refreshLactationDryOffProjection(farmId, cattleId);
        await this.refreshReproductionProfile(farmId, cattleId);
    }
    async refreshPregnancyStatuses(cattleId) {
        const pregnancies = await this.prisma.pregnancy.findMany({
            where: { cattleId },
            select: { id: true, status: true },
        });
        if (pregnancies.length === 0)
            return;
        const pregnancyIds = pregnancies.map((p) => p.id);
        const [calvings, abortions] = await Promise.all([
            this.prisma.calvingEvent.findMany({
                where: { pregnancyId: { in: pregnancyIds } },
                select: { pregnancyId: true },
            }),
            this.prisma.abortionEvent.findMany({
                where: { pregnancyId: { in: pregnancyIds } },
                select: { pregnancyId: true },
            }),
        ]);
        const calvedIds = new Set(calvings.map((c) => c.pregnancyId));
        const abortedIds = new Set(abortions.map((a) => a.pregnancyId));
        await Promise.all(pregnancies.map((pregnancy) => {
            const next = calvedIds.has(pregnancy.id)
                ? client_1.PregnancyStatus.CALVED
                : abortedIds.has(pregnancy.id)
                    ? client_1.PregnancyStatus.ABORTED
                    : pregnancy.status === client_1.PregnancyStatus.FAILED
                        ? client_1.PregnancyStatus.FAILED
                        : pregnancy.status === client_1.PregnancyStatus.CANCELLED_CORRECTION
                            ? client_1.PregnancyStatus.CANCELLED_CORRECTION
                            : client_1.PregnancyStatus.ACTIVE;
            if (next === pregnancy.status)
                return Promise.resolve();
            return this.prisma.pregnancy.update({
                where: { id: pregnancy.id },
                data: { status: next },
            });
        }));
    }
    async refreshBreedingEventStatuses(cattleId) {
        const events = await this.prisma.breedingEvent.findMany({
            where: { cattleId, voidedAt: null },
            select: { id: true, status: true },
        });
        if (events.length === 0)
            return;
        const eventIds = events.map((e) => e.id);
        const [pregnancies, failedDiagnoses, returnedToHeatEvents] = await Promise.all([
            this.prisma.pregnancy.findMany({
                where: { breedingEventId: { in: eventIds } },
                select: { breedingEventId: true, status: true },
            }),
            this.prisma.pregnancyDiagnosis.findMany({
                where: {
                    breedingEventId: { in: eventIds },
                    result: client_1.PregnancyDiagnosisResult.NOT_PREGNANT,
                },
                select: { breedingEventId: true },
            }),
            this.prisma.heatEvent.findMany({
                where: { returnedFromBreedingEventId: { in: eventIds } },
                select: { returnedFromBreedingEventId: true },
            }),
        ]);
        const statusesByEvent = new Map();
        for (const pregnancy of pregnancies) {
            if (!pregnancy.breedingEventId)
                continue;
            const list = statusesByEvent.get(pregnancy.breedingEventId) ?? [];
            list.push(pregnancy.status);
            statusesByEvent.set(pregnancy.breedingEventId, list);
        }
        const failedDiagnosisEventIds = new Set(failedDiagnoses
            .map((d) => d.breedingEventId)
            .filter((id) => id !== null));
        const returnedToHeatEventIds = new Set(returnedToHeatEvents
            .map((h) => h.returnedFromBreedingEventId)
            .filter((id) => id !== null));
        await Promise.all(events.map((event) => {
            const statuses = statusesByEvent.get(event.id) ?? [];
            const next = (0, breeding_status_1.deriveBreedingStatus)({
                hasCalving: statuses.includes(client_1.PregnancyStatus.CALVED),
                hasAbortion: statuses.includes(client_1.PregnancyStatus.ABORTED),
                hasActivePregnancy: statuses.includes(client_1.PregnancyStatus.ACTIVE),
                hasFailedDiagnosis: failedDiagnosisEventIds.has(event.id),
                hasReturnedToHeat: returnedToHeatEventIds.has(event.id),
            });
            if (next === event.status)
                return Promise.resolve();
            return this.prisma.breedingEvent.update({
                where: { id: event.id },
                data: { status: next },
            });
        }));
    }
    async refreshCattleProductionStatus(cattleId) {
        const [cattle, openDryPeriod, activeLactation] = await Promise.all([
            this.prisma.cattle.findUnique({
                where: { id: cattleId },
                select: { productionStatus: true, herdStatus: true, deletedAt: true },
            }),
            this.prisma.dryPeriod.findFirst({
                where: { cattleId, actualEndDate: null },
                select: { id: true },
            }),
            this.prisma.lactation.findFirst({
                where: { cattleId, status: client_1.LactationStatus.ACTIVE },
                select: { id: true },
            }),
        ]);
        if (!cattle || cattle.herdStatus !== 'ACTIVE' || cattle.deletedAt)
            return;
        const next = openDryPeriod
            ? client_1.ProductionStatus.DRY
            : activeLactation
                ? client_1.ProductionStatus.MILKING
                : null;
        if (!next || next === cattle.productionStatus)
            return;
        await this.prisma.cattle.updateMany({
            where: { id: cattleId, herdStatus: 'ACTIVE', deletedAt: null },
            data: { productionStatus: next },
        });
    }
    async refreshLactationDryOffProjection(farmId, cattleId) {
        const activeLactation = await this.prisma.lactation.findFirst({
            where: { cattleId, status: client_1.LactationStatus.ACTIVE },
            select: { id: true, recommendedDryOffAt: true },
        });
        if (!activeLactation)
            return;
        const activePregnancy = await this.prisma.pregnancy.findFirst({
            where: { cattleId, status: client_1.PregnancyStatus.ACTIVE },
            orderBy: { conceptionDate: 'desc' },
            select: { expectedCalvingDate: true },
        });
        let recommendedDryOffAt = null;
        if (activePregnancy?.expectedCalvingDate) {
            const dryPeriodDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
            recommendedDryOffAt = (0, lactation_dry_off_projection_1.computeDryOffProjection)({
                isPregnant: true,
                expectedCalvingDate: activePregnancy.expectedCalvingDate,
                dryPeriodDays,
            }).recommendedDryOffAt;
        }
        const currentTime = activeLactation.recommendedDryOffAt?.getTime() ?? null;
        const nextTime = recommendedDryOffAt?.getTime() ?? null;
        if (currentTime === nextTime)
            return;
        await this.prisma.lactation.update({
            where: { id: activeLactation.id },
            data: { recommendedDryOffAt },
        });
    }
    async refreshReproductionProfile(farmId, cattleId) {
        const [cattle, vwpDays, totalBreedings, pregnancies, realCalvingCount, totalAbortions, firstCalving, lastBreeding, lastDiagnosis, lastCalving, currentPregnancy, currentLactation, existingProfile,] = await Promise.all([
            this.prisma.cattle.findUnique({
                where: { id: cattleId },
                select: { gender: true, dateOfBirth: true },
            }),
            this.farmSettings.reproVwpDays(farmId),
            this.prisma.breedingEvent.count({ where: { cattleId, voidedAt: null } }),
            this.prisma.pregnancy.findMany({
                where: {
                    cattleId,
                    status: {
                        notIn: [
                            client_1.PregnancyStatus.FAILED,
                            client_1.PregnancyStatus.CANCELLED_CORRECTION,
                        ],
                    },
                },
                select: { id: true, status: true },
            }),
            this.prisma.calvingEvent.count({ where: { cattleId } }),
            this.prisma.abortionEvent.count({ where: { cattleId } }),
            this.prisma.calvingEvent.findFirst({
                where: { cattleId },
                orderBy: { calvingDate: 'asc' },
            }),
            this.prisma.breedingEvent.findFirst({
                where: { cattleId, voidedAt: null },
                orderBy: { breedingDate: 'desc' },
            }),
            this.prisma.pregnancyDiagnosis.findFirst({
                where: { cattleId },
                orderBy: { diagnosisDate: 'desc' },
            }),
            this.prisma.calvingEvent.findFirst({
                where: { cattleId },
                orderBy: { calvingDate: 'desc' },
            }),
            this.prisma.pregnancy.findFirst({
                where: { cattleId, status: client_1.PregnancyStatus.ACTIVE },
                orderBy: { conceptionDate: 'desc' },
            }),
            this.prisma.lactation.findFirst({
                where: { cattleId, status: client_1.LactationStatus.ACTIVE },
                orderBy: { startDate: 'desc' },
            }),
            this.prisma.reproductionProfile.findUnique({
                where: { cattleId },
                select: { totalCalvings: true },
            }),
        ]);
        const totalCalvings = Math.max(realCalvingCount, existingProfile?.totalCalvings ?? 0);
        const { breedingAgeDays } = await this.farmSettings.lifecycleBoundaries(farmId);
        const foldFacts = await (0, reproduction_fold_facts_1.loadFoldFacts)(this.prisma, cattleId);
        const fold = foldFacts.length ? (0, reproduction_fold_1.foldReproduction)(foldFacts) : null;
        const status = deriveReproductionState({
            breedingAgeDays,
            now: new Date(),
            gender: cattle?.gender,
            dateOfBirth: cattle?.dateOfBirth ?? null,
            hasBreedingHistory: totalBreedings > 0 || pregnancies.length > 0 || totalCalvings > 0,
            ...(fold
                ? {
                    hasActivePregnancy: fold.hasActivePregnancy,
                    lastBreeding: fold.pendingBreeding
                        ? { status: client_1.BreedingStatus.PENDING_CHECK }
                        : null,
                    lastCalving: fold.lastCalvingAt
                        ? { calvingDate: fold.lastCalvingAt }
                        : null,
                }
                : {
                    hasActivePregnancy: Boolean(currentPregnancy),
                    lastBreeding: lastBreeding ? { status: lastBreeding.status } : null,
                    lastCalving: lastCalving
                        ? { calvingDate: lastCalving.calvingDate }
                        : null,
                }),
            vwpDays,
        });
        await this.prisma.reproductionProfile.upsert({
            where: { cattleId },
            create: {
                cattleId,
                reproductiveStatus: status,
                currentLactationNumber: currentLactation?.lactationNumber ?? 0,
                totalBreedings,
                totalPregnancies: pregnancies.length,
                totalCalvings,
                totalAbortions,
                firstCalvingDate: firstCalving?.calvingDate,
                lastBreedingDate: lastBreeding?.breedingDate,
                lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
                lastCalvingDate: lastCalving?.calvingDate,
                currentPregnancyId: currentPregnancy?.id,
                currentLactationId: currentLactation?.id,
            },
            update: {
                reproductiveStatus: status,
                currentLactationNumber: currentLactation?.lactationNumber ?? 0,
                totalBreedings,
                totalPregnancies: pregnancies.length,
                totalCalvings,
                totalAbortions,
                firstCalvingDate: firstCalving?.calvingDate,
                lastBreedingDate: lastBreeding?.breedingDate,
                lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
                lastCalvingDate: lastCalving?.calvingDate,
                currentPregnancyId: currentPregnancy?.id,
                currentLactationId: currentLactation?.id,
            },
        });
    }
};
exports.ReproductionDerivationService = ReproductionDerivationService;
exports.ReproductionDerivationService = ReproductionDerivationService = ReproductionDerivationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_settings_service_1.FarmSettingsService,
        logger_service_1.LoggerService])
], ReproductionDerivationService);
//# sourceMappingURL=reproduction-derivation.service.js.map