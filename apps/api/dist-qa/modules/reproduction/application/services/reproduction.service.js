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
var ReproductionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproductionService = exports.deriveReproductionState = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const semen_service_1 = require("src/modules/inventory/application/services/semen.service");
const expense_service_1 = require("src/modules/purchasing/application/expense.service");
const calf_service_1 = require("src/modules/calf/application/services/calf.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const animal_hold_service_1 = require("src/modules/cattle/application/services/animal-hold.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const reproduction_alerts_1 = require("../../domain/reproduction-alerts");
const lactation_stage_1 = require("../../domain/lactation-stage");
const pregnancy_stage_1 = require("../../domain/pregnancy-stage");
const lactation_dry_off_projection_1 = require("../../domain/lactation-dry-off-projection");
const event_api_context_1 = require("src/modules/animal-events/application/event-api-context");
const pregnancy_estimate_1 = require("../../domain/pregnancy-estimate");
const reproduction_derivation_service_1 = require("./reproduction-derivation.service");
Object.defineProperty(exports, "deriveReproductionState", { enumerable: true, get: function () { return reproduction_derivation_service_1.deriveReproductionState; } });
const DEFAULT_GESTATION_DAYS = 280;
const PREGNANCY_RECHECK_DAYS = 10;
let ReproductionService = ReproductionService_1 = class ReproductionService {
    prisma;
    aqrService;
    taskService;
    semenService;
    expenseService;
    calfService;
    farmSettings;
    animalHoldService;
    logger;
    derivation;
    activityLog;
    log;
    constructor(prisma, aqrService, taskService, semenService, expenseService, calfService, farmSettings, animalHoldService, logger, derivation, activityLog) {
        this.prisma = prisma;
        this.aqrService = aqrService;
        this.taskService = taskService;
        this.semenService = semenService;
        this.expenseService = expenseService;
        this.calfService = calfService;
        this.farmSettings = farmSettings;
        this.animalHoldService = animalHoldService;
        this.logger = logger;
        this.derivation = derivation;
        this.activityLog = activityLog;
        this.log = this.logger.setContext(ReproductionService_1.name);
    }
    async logActivity(farmId, actorId, cattleId, eventTitle, actionDetails, taggedValues) {
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.BREEDING,
            eventTitle,
            actionDetails,
            actorId: actorId ?? null,
            relatedCattleId: cattleId,
            taggedValues,
        });
    }
    async createHeatEvent(farmId, dto, idempotencyKey, actorId) {
        return this.withIdempotency(farmId, idempotencyKey, 'reproduction.createHeatEvent', () => this.createHeatEventInner(farmId, dto, actorId));
    }
    async createHeatEventInner(farmId, dto, actorId) {
        const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
        const heatEvent = await this.prisma.heatEvent.create({
            data: {
                cattleId: dto.cattleId,
                heatDateTime: new Date(dto.heatDateTime),
                detectionMethod: dto.detectionMethod,
                standingHeat: dto.standingHeat ?? false,
                mucusDischarge: dto.mucusDischarge ?? false,
                mountingBehavior: dto.mountingBehavior ?? false,
                restlessness: dto.restlessness ?? false,
                notes: dto.notes,
            },
        });
        const activePregnancy = await this.prisma.pregnancy.findFirst({
            where: { cattleId: dto.cattleId, status: client_1.PregnancyStatus.ACTIVE },
            select: { id: true },
        });
        await this.ensureProfile(dto.cattleId);
        await this.logActivity(farmId, actorId, dto.cattleId, 'Heat detected', `Heat detected for [${cattle.tagNumber}] (${dto.detectionMethod}).`, [
            { key: 'cattle', value: cattle.tagNumber },
            { key: 'method', value: String(dto.detectionMethod) },
        ]);
        this.log.info('Heat event created', {
            heatEventId: heatEvent.id,
            cattleId: dto.cattleId,
            farmId: cattle.farmId,
            activePregnancyConflict: Boolean(activePregnancy),
        });
        if (activePregnancy) {
            return {
                ...heatEvent,
                activePregnancyConflict: true,
                pregnancyId: activePregnancy.id,
            };
        }
        return heatEvent;
    }
    async listHeatEvents(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'heatDateTime');
        const rows = await this.prisma.heatEvent.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async createBreedingEvent(farmId, userId, dto, idempotencyKey) {
        return this.withIdempotency(farmId, idempotencyKey, 'reproduction.createBreedingEvent', () => this.createBreedingEventInner(farmId, userId, dto));
    }
    async createBreedingEventInner(farmId, userId, dto) {
        const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
        const activePregnancy = await this.prisma.pregnancy.findFirst({
            where: { cattleId: dto.cattleId, status: client_1.PregnancyStatus.ACTIVE },
        });
        if (activePregnancy && !(0, event_api_context_1.eventApiContext)()) {
            throw new common_1.BadRequestException(`[${cattle.tagNumber}] already has an active pregnancy (id ${activePregnancy.id}, expected calving ${activePregnancy.expectedCalvingDate?.toISOString().slice(0, 10) ?? 'unknown'}). Resolve or correct it before recording a new breeding.`);
        }
        if (dto.bullId) {
            await this.assertCattleInFarm(farmId, dto.bullId);
        }
        const semenSource = dto.breedingMethod === client_1.BreedingMethod.AI
            ? (dto.semenSource ??
                (dto.semenBatchId
                    ? client_1.SemenSource.FARM_INVENTORY
                    : client_1.SemenSource.EXTERNAL))
            : undefined;
        if (semenSource &&
            semenSource !== client_1.SemenSource.FARM_INVENTORY &&
            dto.semenBatchId) {
            throw new common_1.BadRequestException('semenBatchId is only valid when semenSource is FARM_INVENTORY');
        }
        if (semenSource === client_1.SemenSource.TECHNICIAN_SUPPLIED &&
            !dto.serviceProviderId) {
            throw new common_1.BadRequestException('serviceProviderId is required when semenSource is TECHNICIAN_SUPPLIED');
        }
        const serviceProvider = dto.serviceProviderId
            ? await this.assertServiceProviderInFarm(farmId, dto.serviceProviderId)
            : null;
        if (dto.breedingMethod === client_1.BreedingMethod.AI &&
            semenSource !== client_1.SemenSource.FARM_INVENTORY &&
            dto.serviceCost == null) {
            throw new common_1.BadRequestException('serviceCost is required for AI breeding when semen is not sourced from farm inventory');
        }
        let inventorySemenType;
        let inventoryTargetSex;
        let inventoryCostPerUnit;
        let inventoryBatchName;
        if (dto.breedingMethod === client_1.BreedingMethod.AI &&
            semenSource === client_1.SemenSource.FARM_INVENTORY) {
            if (!dto.semenBatchId) {
                throw new common_1.BadRequestException('semenBatchId is required when semenSource is FARM_INVENTORY');
            }
            const batchPreview = await this.prisma.semenBatch.findFirst({
                where: { id: dto.semenBatchId, farmId },
                select: { name: true, costPerUnit: true },
            });
            if (!batchPreview) {
                throw new common_1.BadRequestException('semenBatchId does not refer to a batch on this farm');
            }
            if (batchPreview.costPerUnit == null) {
                throw new common_1.BadRequestException(`Semen batch [${batchPreview.name}] has no cost per straw set — set its cost before recording an AI event against it.`);
            }
            const batch = await this.semenService.decrementStraw(farmId, dto.semenBatchId, 1, userId);
            inventorySemenType = batch.semenType ?? undefined;
            inventoryTargetSex = batch.targetSex ?? undefined;
            inventoryCostPerUnit = batchPreview.costPerUnit;
            inventoryBatchName = batchPreview.name;
        }
        const resolvedCost = dto.breedingMethod === client_1.BreedingMethod.AI
            ? (semenSource === client_1.SemenSource.FARM_INVENTORY
                ? inventoryCostPerUnit
                : dto.serviceCost)
            : (dto.serviceCost ?? 0);
        const costEntityName = semenSource === client_1.SemenSource.FARM_INVENTORY
            ? inventoryBatchName
            : (serviceProvider?.name ?? dto.semenCompany ?? 'Breeding service');
        const breedingNumber = dto.breedingNumber ??
            (await this.prisma.breedingEvent.count({
                where: { cattleId: dto.cattleId, voidedAt: null },
            })) + 1;
        const heatWindowDays = await this.farmSettings.reproHeatWindowDays(farmId);
        const pregnancyCheckDays = await this.farmSettings.reproPregnancyCheckDays(farmId);
        const breedingDate = new Date(dto.breedingDate);
        let breedingEvent = await this.prisma.$transaction(async (tx) => {
            await this.lockCattleForUpdate(tx, dto.cattleId);
            const activePregnancyInTx = await tx.pregnancy.findFirst({
                where: { cattleId: dto.cattleId, status: client_1.PregnancyStatus.ACTIVE },
                select: { id: true },
            });
            if (activePregnancyInTx && !(0, event_api_context_1.eventApiContext)()) {
                throw new common_1.BadRequestException(`[${cattle.tagNumber}] already has an active pregnancy (id ${activePregnancyInTx.id}). Resolve or correct it before recording a new breeding.`);
            }
            const created = await tx.breedingEvent.create({
                data: {
                    cattleId: dto.cattleId,
                    breedingDate,
                    breedingMethod: dto.breedingMethod,
                    bullId: dto.bullId,
                    semenBatchId: dto.semenBatchId,
                    inseminator: dto.inseminator,
                    semenSource,
                    serviceProviderId: dto.serviceProviderId,
                    sireNameOrCode: dto.sireNameOrCode,
                    sireBreed: dto.sireBreed,
                    semenType: semenSource === client_1.SemenSource.FARM_INVENTORY
                        ? inventorySemenType
                        : dto.semenType,
                    targetSex: semenSource === client_1.SemenSource.FARM_INVENTORY
                        ? inventoryTargetSex
                        : dto.targetSex,
                    strawBatchCode: dto.strawBatchCode,
                    semenCompany: dto.semenCompany,
                    serviceCost: dto.serviceCost,
                    paymentMethod: dto.paymentMethod,
                    breedingNumber,
                    expectedPregnancyCheckDate: dto.expectedPregnancyCheckDate
                        ? new Date(dto.expectedPregnancyCheckDate)
                        : this.addDays(breedingDate, pregnancyCheckDays),
                    status: client_1.BreedingStatus.PENDING_CHECK,
                    notes: dto.notes,
                },
                include: {
                    bull: { select: { id: true, tagNumber: true, name: true } },
                },
            });
            const openHeat = await tx.heatEvent.findFirst({
                where: {
                    cattleId: dto.cattleId,
                    resolvedAt: null,
                    heatDateTime: {
                        gte: this.addDays(breedingDate, -heatWindowDays),
                        lte: this.endOfDay(breedingDate),
                    },
                },
                orderBy: { heatDateTime: 'desc' },
            });
            if (openHeat) {
                await tx.heatEvent.update({
                    where: { id: openHeat.id },
                    data: {
                        resolvedAt: breedingDate,
                        resolvedByBreedingEventId: created.id,
                        resolutionReason: client_1.HeatResolutionReason.INSEMINATED,
                    },
                });
            }
            return created;
        });
        if (resolvedCost > 0) {
            let postedExpenseId = null;
            if (semenSource === client_1.SemenSource.FARM_INVENTORY) {
                const posted = await this.expenseService.recordInventoryConsumption(farmId, userId, {
                    category: client_1.ExpenseCategory.BREEDING,
                    description: `${costEntityName ?? 'Semen Straw'} — Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod})`,
                    amount: resolvedCost,
                    expenseDate: breedingDate.toISOString(),
                    cattleId: dto.cattleId,
                });
                postedExpenseId = posted.id;
            }
            else {
                const posted = await this.expenseService.recordExpense(farmId, userId, {
                    category: client_1.ExpenseCategory.BREEDING,
                    description: `${costEntityName ?? 'Breeding service'} — Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod})`,
                    amount: resolvedCost,
                    expenseDate: breedingDate.toISOString(),
                    financialAccountId: await this.expenseService.resolveAccountId(farmId, userId, dto.financialAccountId),
                    cattleId: dto.cattleId,
                });
                postedExpenseId = posted.id;
            }
            if (postedExpenseId) {
                breedingEvent = await this.prisma.breedingEvent.update({
                    where: { id: breedingEvent.id },
                    data: { financeTransactionId: postedExpenseId },
                    include: {
                        bull: { select: { id: true, tagNumber: true, name: true } },
                    },
                });
            }
        }
        await this.derivation.refreshDerivedState(farmId, dto.cattleId);
        if (!(0, event_api_context_1.eventApiContext)())
            await this.createBreedingTaskUnlessDuplicate({
                farmId,
                createdBy: userId,
                name: `Pregnancy check — ${cattle.tagNumber}`,
                details: `Confirm pregnancy for breeding #${breedingEvent.breedingNumber} of [${cattle.tagNumber}].`,
                category: client_1.TaskCategory.BREEDING,
                priority: client_1.TaskPriority.MEDIUM,
                dueAt: breedingEvent.expectedPregnancyCheckDate ??
                    this.addDays(new Date(dto.breedingDate), pregnancyCheckDays),
                source: client_1.TaskSource.SYSTEM_AUTO,
                relatedCattleId: dto.cattleId,
                sourceEventType: 'BREEDING_EVENT',
                sourceEventId: breedingEvent.id,
            }, 'Pregnancy check — ');
        await this.logActivity(farmId, userId, dto.cattleId, 'Breeding recorded', `Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod}) recorded for [${cattle.tagNumber}].`, [
            { key: 'cattle', value: cattle.tagNumber },
            { key: 'method', value: String(dto.breedingMethod) },
            { key: 'breeding', value: `#${breedingEvent.breedingNumber}` },
        ]);
        this.log.info('Breeding event created', {
            breedingEventId: breedingEvent.id,
            cattleId: dto.cattleId,
            farmId,
        });
        return breedingEvent;
    }
    async listBreedingEvents(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'breedingDate');
        const rows = await this.prisma.breedingEvent.findMany({
            where: { ...where, voidedAt: null },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { bull: { select: { id: true, tagNumber: true, name: true } } },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async getBreedingEvent(farmId, id) {
        const event = await this.prisma.breedingEvent.findFirst({
            where: { id, cattle: { farmId } },
            include: {
                cattle: { select: { id: true, farmId: true } },
                bull: { select: { id: true, tagNumber: true, name: true } },
                diagnoses: true,
                pregnancies: true,
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Breeding event not found');
        }
        return event;
    }
    async createPregnancyDiagnosis(farmId, userId, dto, idempotencyKey) {
        return this.withIdempotency(farmId, idempotencyKey, 'reproduction.createPregnancyDiagnosis', () => this.createPregnancyDiagnosisInner(farmId, userId, dto));
    }
    async createPregnancyDiagnosisInner(farmId, userId, dto) {
        const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
        if (!dto.breedingEventId) {
            const openBreedings = await this.prisma.breedingEvent.findMany({
                where: { cattleId: dto.cattleId, status: client_1.BreedingStatus.PENDING_CHECK },
                select: { id: true, breedingDate: true },
                take: 2,
            });
            if (openBreedings.length === 1 &&
                (!(0, event_api_context_1.eventApiContext)() ||
                    openBreedings[0].breedingDate <= new Date(dto.diagnosisDate))) {
                dto.breedingEventId = openBreedings[0].id;
            }
        }
        const breedingEvent = dto.breedingEventId
            ? await this.getBreedingEventForCattle(dto.breedingEventId, dto.cattleId)
            : null;
        const dryPeriodDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
        const diagnosis = await this.prisma.$transaction(async (tx) => {
            await this.lockCattleForUpdate(tx, dto.cattleId);
            const created = await tx.pregnancyDiagnosis.create({
                data: {
                    cattleId: dto.cattleId,
                    breedingEventId: dto.breedingEventId,
                    diagnosisDate: new Date(dto.diagnosisDate),
                    result: dto.result,
                    diagnosisMethod: dto.diagnosisMethod,
                    gestationDay: dto.gestationDay,
                    expectedCalvingDate: dto.expectedCalvingDate
                        ? new Date(dto.expectedCalvingDate)
                        : undefined,
                    notes: dto.notes,
                },
            });
            if (dto.result === client_1.PregnancyDiagnosisResult.PREGNANT) {
                const estimate = (0, pregnancy_estimate_1.estimatePregnancyDates)({
                    diagnosisDate: new Date(dto.diagnosisDate),
                    breedingDate: breedingEvent?.breedingDate,
                    gestationDay: dto.gestationDay,
                    expectedCalvingDate: dto.expectedCalvingDate
                        ? new Date(dto.expectedCalvingDate)
                        : null,
                });
                if (estimate.source !== 'BREEDING') {
                    this.log.info('CONCEPTION_ESTIMATED', {
                        cattleId: dto.cattleId,
                        source: estimate.source,
                    });
                }
                const conceptionDate = estimate.conceptionDate;
                const calculatedCalvingDate = estimate.calculatedCalvingDate;
                const pregnancy = await tx.pregnancy.create({
                    data: {
                        cattleId: dto.cattleId,
                        breedingEventId: dto.breedingEventId,
                        conceptionDate,
                        conceptionConfidence: estimate.confidence,
                        calculatedCalvingDate,
                        expectedCalvingDate: dto.expectedCalvingDate
                            ? new Date(dto.expectedCalvingDate)
                            : calculatedCalvingDate,
                        expectedCalvingDateSource: dto.expectedCalvingDate
                            ? client_1.ExpectedCalvingDateSource.MANUAL
                            : client_1.ExpectedCalvingDateSource.SYSTEM,
                        gestationDays: dto.gestationDay,
                        status: client_1.PregnancyStatus.ACTIVE,
                        sourceDiagnosisId: created.id,
                    },
                });
                if (dto.breedingEventId) {
                    await tx.breedingEvent.update({
                        where: { id: dto.breedingEventId },
                        data: { status: client_1.BreedingStatus.PREGNANT },
                    });
                }
                await tx.reproductionProfile.upsert({
                    where: { cattleId: dto.cattleId },
                    create: {
                        cattleId: dto.cattleId,
                        reproductiveStatus: client_1.ReproductionState.PREGNANT,
                        lastPregnancyCheckDate: new Date(dto.diagnosisDate),
                        currentPregnancyId: pregnancy.id,
                    },
                    update: {
                        reproductiveStatus: client_1.ReproductionState.PREGNANT,
                        lastPregnancyCheckDate: new Date(dto.diagnosisDate),
                        currentPregnancyId: pregnancy.id,
                    },
                });
                if (pregnancy.expectedCalvingDate) {
                    const { recommendedDryOffAt } = (0, lactation_dry_off_projection_1.computeDryOffProjection)({
                        isPregnant: true,
                        expectedCalvingDate: pregnancy.expectedCalvingDate,
                        dryPeriodDays,
                    });
                    await tx.lactation.updateMany({
                        where: { cattleId: dto.cattleId, status: client_1.LactationStatus.ACTIVE },
                        data: { recommendedDryOffAt },
                    });
                }
            }
            else if (dto.breedingEventId &&
                dto.result === client_1.PregnancyDiagnosisResult.NOT_PREGNANT) {
                await tx.breedingEvent.update({
                    where: { id: dto.breedingEventId },
                    data: { status: client_1.BreedingStatus.FAILED },
                });
            }
            return created;
        });
        await this.derivation.refreshDerivedState(farmId, dto.cattleId);
        if (dto.breedingEventId) {
            await this.taskService.completeBySourceEvent(farmId, 'BREEDING_EVENT', dto.breedingEventId, userId);
            if (dto.result === client_1.PregnancyDiagnosisResult.SUSPECTED) {
                const recheckDueDate = this.addDays(new Date(dto.diagnosisDate), PREGNANCY_RECHECK_DAYS);
                await this.createBreedingTaskUnlessDuplicate({
                    farmId,
                    createdBy: userId,
                    name: `Pregnancy recheck — ${cattle.tagNumber}`,
                    details: `Diagnosis on ${dto.diagnosisDate} was inconclusive; recheck breeding #${breedingEvent?.breedingNumber ?? '?'} of [${cattle.tagNumber}].`,
                    category: client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: recheckDueDate,
                    source: client_1.TaskSource.SYSTEM_AUTO,
                    relatedCattleId: dto.cattleId,
                    sourceEventType: 'BREEDING_EVENT',
                    sourceEventId: dto.breedingEventId,
                }, 'Pregnancy recheck — ');
                await this.prisma.breedingEvent.update({
                    where: { id: dto.breedingEventId },
                    data: { expectedPregnancyCheckDate: recheckDueDate },
                });
            }
        }
        if (dto.result === client_1.PregnancyDiagnosisResult.PREGNANT) {
            await this.aqrService.applyEvent(farmId, dto.cattleId, 'pregnancy_confirmed', {
                actorId: userId,
                actionDetails: `Pregnancy confirmed for [${cattle.tagNumber}].`,
            });
        }
        else {
            await this.logActivity(farmId, userId, dto.cattleId, 'Pregnancy diagnosis', `Pregnancy diagnosis for [${cattle.tagNumber}]: ${dto.result}.`, [
                { key: 'cattle', value: cattle.tagNumber },
                { key: 'result', value: String(dto.result) },
            ]);
        }
        this.log.info('Pregnancy diagnosis created', {
            pregnancyDiagnosisId: diagnosis.id,
            cattleId: dto.cattleId,
            farmId,
            result: dto.result,
        });
        return diagnosis;
    }
    async listPregnancies(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'conceptionDate');
        const rows = await this.prisma.pregnancy.findMany({
            where: { ...where, ...(query.status ? { status: query.status } : {}) },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                cattle: { select: { id: true, name: true, tagNumber: true } },
            },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async createCalvingEvent(farmId, userId, dto, idempotencyKey) {
        return this.withIdempotency(farmId, idempotencyKey, 'reproduction.createCalvingEvent', () => this.createCalvingEventInner(farmId, userId, dto));
    }
    async createCalvingEventInner(farmId, userId, dto) {
        const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
        if (!dto.pregnancyId) {
            const activePregnancies = await this.prisma.pregnancy.findMany({
                where: { cattleId: dto.cattleId, status: client_1.PregnancyStatus.ACTIVE },
                select: { id: true },
                take: 2,
            });
            if (activePregnancies.length === 1) {
                dto.pregnancyId = activePregnancies[0].id;
            }
        }
        const pregnancy = dto.pregnancyId
            ? await this.getPregnancyForCattle(dto.pregnancyId, dto.cattleId)
            : null;
        const calvingDate = new Date(dto.calvingDate);
        const calvingNumber = dto.calvingNumber ??
            (await this.prisma.calvingEvent.count({
                where: { cattleId: dto.cattleId },
            })) + 1;
        const txResult = await this.prisma.$transaction(async (tx) => {
            const created = await tx.calvingEvent.create({
                data: {
                    cattleId: dto.cattleId,
                    pregnancyId: dto.pregnancyId,
                    calvingDate,
                    calvingNumber,
                    calvingEase: dto.calvingEase,
                    calfCount: dto.calfCount ?? dto.calves?.length ?? 1,
                    placentaExpelled: dto.placentaExpelled ?? false,
                    retainedPlacenta: dto.retainedPlacenta ?? false,
                    complications: dto.complications,
                    notes: dto.notes,
                },
            });
            if (pregnancy) {
                await tx.pregnancy.update({
                    where: { id: pregnancy.id },
                    data: {
                        status: client_1.PregnancyStatus.CALVED,
                        actualCalvingDate: calvingDate,
                        gestationDays: pregnancy.conceptionDate
                            ? this.daysBetween(pregnancy.conceptionDate, calvingDate)
                            : null,
                    },
                });
                if (pregnancy.breedingEventId) {
                    await tx.breedingEvent.update({
                        where: { id: pregnancy.breedingEventId },
                        data: { status: client_1.BreedingStatus.CALVED },
                    });
                }
            }
            const missedDryOffLactation = await tx.lactation.findFirst({
                where: { cattleId: dto.cattleId, status: client_1.LactationStatus.ACTIVE },
                orderBy: { startDate: 'desc' },
            });
            if (missedDryOffLactation) {
                await tx.lactation.update({
                    where: { id: missedDryOffLactation.id },
                    data: {
                        status: client_1.LactationStatus.ENDED,
                        endDate: calvingDate,
                        endReason: client_1.LactationEndReason.MISSING_DRY_OFF_RECORD,
                    },
                });
            }
            const lactation = await tx.lactation.create({
                data: {
                    cattleId: dto.cattleId,
                    lactationNumber: calvingNumber,
                    calvingEventId: created.id,
                    startDate: calvingDate,
                    status: client_1.LactationStatus.ACTIVE,
                    startReason: client_1.LactationStartReason.CALVING,
                    sourceCalvingEventId: created.id,
                },
            });
            for (const calf of dto.calves ?? []) {
                let calfId;
                if (calf.status === client_1.CalfBirthStatus.ALIVE) {
                    if (!calf.tagNumber) {
                        throw new common_1.BadRequestException('Alive calves must include tagNumber for cattle registration');
                    }
                    const createdCalf = await tx.cattle.create({
                        data: {
                            farmId: cattle.farmId,
                            name: calf.name,
                            tagNumber: calf.tagNumber,
                            gender: calf.gender,
                            dateOfBirth: calvingDate,
                            herdStatus: client_1.HerdStatus.ACTIVE,
                            motherId: dto.cattleId,
                            fatherId: pregnancy?.breedingEvent?.bullId ?? undefined,
                            sourceType: client_1.CattleSourceType.BORN,
                            createdBy: userId,
                        },
                    });
                    calfId = createdCalf.id;
                }
                await tx.calfBirth.create({
                    data: {
                        calvingEventId: created.id,
                        calfId,
                        gender: calf.gender,
                        birthWeight: calf.birthWeight,
                        status: calf.status,
                    },
                });
            }
            const totalCalvings = await tx.calvingEvent.count({
                where: { cattleId: dto.cattleId },
            });
            await tx.reproductionProfile.upsert({
                where: { cattleId: dto.cattleId },
                create: {
                    cattleId: dto.cattleId,
                    currentLactationNumber: calvingNumber,
                    firstCalvingDate: calvingDate,
                    lastCalvingDate: calvingDate,
                    currentLactationId: lactation.id,
                    currentPregnancyId: null,
                    totalCalvings,
                },
                update: {
                    currentLactationNumber: calvingNumber,
                    firstCalvingDate: calvingNumber === 1 ? calvingDate : undefined,
                    lastCalvingDate: calvingDate,
                    currentLactationId: lactation.id,
                    currentPregnancyId: null,
                    totalCalvings,
                },
            });
            await this.flipToMilking(tx, dto.cattleId);
            const createdCalvingEvent = await tx.calvingEvent.findUnique({
                where: { id: created.id },
                include: { calfBirths: { include: { calf: true } }, lactations: true },
            });
            return {
                calvingEvent: createdCalvingEvent,
                closedMissingDryOffLactation: missedDryOffLactation
                    ? await tx.lactation.findUniqueOrThrow({
                        where: { id: missedDryOffLactation.id },
                    })
                    : null,
            };
        });
        const { calvingEvent, closedMissingDryOffLactation } = txResult;
        await this.derivation.refreshDerivedState(farmId, dto.cattleId);
        for (const birth of calvingEvent?.calfBirths ?? []) {
            if (birth.calfId) {
                await this.aqrService.applyEvent(farmId, birth.calfId, 'animal_registered', {
                    actorId: userId,
                    actionDetails: `Calf [${birth.calf?.tagNumber ?? birth.calfId}] born to [${cattle.tagNumber}].`,
                });
                await this.calfService.scheduleCareReminders({
                    farmId,
                    createdBy: userId,
                    calfId: birth.calfId,
                    birthDate: calvingDate,
                    gender: birth.gender,
                    sourceEventId: calvingEvent?.id,
                });
            }
        }
        await this.aqrService.applyEvent(farmId, dto.cattleId, 'calving_successful', {
            actorId: userId,
            actionDetails: `Calving recorded for [${cattle.tagNumber}] (${calvingEvent?.calfBirths.length ?? 0} calf/calves).`,
        });
        await this.taskService.createInternal({
            farmId,
            createdBy: userId,
            name: `Colostrum feeding — calf of ${cattle.tagNumber}`,
            details: 'Feed colostrum to the newborn calf within the first 6 hours of birth.',
            category: client_1.TaskCategory.CALF_CARE,
            priority: client_1.TaskPriority.HIGH,
            dueAt: this.addHours(calvingDate, 6),
            source: client_1.TaskSource.SYSTEM_AUTO,
            relatedCattleId: dto.cattleId,
            safetyCritical: true,
            sourceEventType: 'CALVING_EVENT',
            sourceEventId: calvingEvent?.id,
        });
        this.log.info('Calving event created', {
            calvingEventId: calvingEvent?.id,
            cattleId: dto.cattleId,
            farmId,
            closedMissingDryOffLactationId: closedMissingDryOffLactation?.id ?? null,
        });
        return { ...calvingEvent, closedMissingDryOffLactation };
    }
    async recordDryOff(farmId, cattleId, dto, actorId) {
        const cattle = await this.getFemaleCattle(farmId, cattleId);
        const dryOffDate = dto.dryOffDate ? new Date(dto.dryOffDate) : new Date();
        const activeLactation = await this.prisma.lactation.findFirst({
            where: { cattleId, status: client_1.LactationStatus.ACTIVE },
            orderBy: { startDate: 'desc' },
        });
        if (!activeLactation && !(0, event_api_context_1.eventApiContext)()) {
            throw new common_1.BadRequestException(`[${cattle.tagNumber}] has no active lactation to dry off`);
        }
        const alreadyDry = await this.prisma.dryPeriod.findFirst({
            where: { cattleId, actualEndDate: null },
        });
        if (alreadyDry) {
            throw new common_1.BadRequestException(`[${cattle.tagNumber}] already has an open dry period`);
        }
        const targetDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
        const dryPeriod = await this.prisma.$transaction(async (tx) => {
            if (activeLactation) {
                await tx.lactation.update({
                    where: { id: activeLactation.id },
                    data: {
                        status: client_1.LactationStatus.ENDED,
                        endDate: dryOffDate,
                        endReason: client_1.LactationEndReason.DRY_OFF,
                    },
                });
            }
            const created = await tx.dryPeriod.create({
                data: {
                    cattleId,
                    startDate: dryOffDate,
                    expectedEndDate: this.addDays(dryOffDate, targetDays),
                    notes: dto.notes,
                    reason: dto.reason,
                },
            });
            await tx.cattle.updateMany({
                where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
                data: { productionStatus: client_1.ProductionStatus.DRY },
            });
            return created;
        });
        await this.derivation.refreshDerivedState(farmId, cattleId);
        await this.logActivity(farmId, actorId, cattleId, 'Dry-off recorded', `[${cattle.tagNumber}] dried off on ${dryOffDate.toISOString().slice(0, 10)}.`, [
            { key: 'cattle', value: cattle.tagNumber },
            {
                key: 'dryOffDate',
                value: dryOffDate.toISOString().slice(0, 10),
            },
        ]);
        this.log.info('Dry-off recorded', {
            dryPeriodId: dryPeriod.id,
            cattleId,
            farmId,
            lactationId: activeLactation?.id ?? null,
        });
        return dryPeriod;
    }
    async listCalvingEvents(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'calvingDate');
        const rows = await this.prisma.calvingEvent.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { calfBirths: { include: { calf: true } }, lactations: true },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async createAbortionEvent(farmId, dto, actorId) {
        const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
        const pregnancy = dto.pregnancyId
            ? await this.getPregnancyForCattle(dto.pregnancyId, dto.cattleId)
            : null;
        const abortion = await this.prisma.$transaction(async (tx) => {
            const created = await tx.abortionEvent.create({
                data: {
                    cattleId: dto.cattleId,
                    pregnancyId: dto.pregnancyId,
                    abortionDate: new Date(dto.abortionDate),
                    gestationDay: dto.gestationDay,
                    suspectedCause: dto.suspectedCause,
                    notes: dto.notes,
                },
            });
            if (pregnancy) {
                await tx.pregnancy.update({
                    where: { id: pregnancy.id },
                    data: { status: client_1.PregnancyStatus.ABORTED },
                });
                if (pregnancy.breedingEventId) {
                    await tx.breedingEvent.update({
                        where: { id: pregnancy.breedingEventId },
                        data: { status: client_1.BreedingStatus.ABORTED },
                    });
                }
            }
            await tx.reproductionProfile.upsert({
                where: { cattleId: dto.cattleId },
                create: { cattleId: dto.cattleId, currentPregnancyId: null },
                update: { currentPregnancyId: null },
            });
            await tx.lactation.updateMany({
                where: { cattleId: dto.cattleId, status: client_1.LactationStatus.ACTIVE },
                data: { recommendedDryOffAt: null },
            });
            return created;
        });
        await this.derivation.refreshDerivedState(farmId, dto.cattleId);
        await this.logActivity(farmId, actorId, dto.cattleId, 'Abortion recorded', `Abortion recorded for [${cattle.tagNumber}] on ${dto.abortionDate}.`, [
            { key: 'cattle', value: cattle.tagNumber },
            { key: 'date', value: String(dto.abortionDate) },
        ]);
        this.log.info('Abortion event created', {
            abortionEventId: abortion.id,
            cattleId: dto.cattleId,
            farmId,
        });
        return abortion;
    }
    async listAbortionEvents(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'abortionDate');
        const rows = await this.prisma.abortionEvent.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async listLactations(farmId, query) {
        const where = await this.buildScopedWhere(farmId, query, 'startDate');
        const rows = await this.prisma.lactation.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { calvingEvent: true },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async summary(farmId, cattleId) {
        const cattle = await this.getFemaleCattle(farmId, cattleId);
        await this.derivation.refreshDerivedState(farmId, cattleId);
        const [profile, breedings, pregnancies, calvings, abortions, currentPregnancy, currentLactation, recentHeat, heatWindowDays, closeUpWindowDays, openDryPeriod, lactationStageThresholds, pregnancyStageThresholds, overdueCheckDays, repeatBreederThreshold, longDaysOpenThresholdDays, calvingOverdueDays, reproductiveHolds,] = await Promise.all([
            this.prisma.reproductionProfile.findUnique({ where: { cattleId } }),
            this.prisma.breedingEvent.findMany({
                where: { cattleId, voidedAt: null },
                orderBy: { breedingDate: 'asc' },
            }),
            this.prisma.pregnancy.findMany({
                where: { cattleId, status: { not: client_1.PregnancyStatus.FAILED } },
            }),
            this.prisma.calvingEvent.findMany({
                where: { cattleId },
                orderBy: { calvingDate: 'asc' },
            }),
            this.prisma.abortionEvent.findMany({ where: { cattleId } }),
            this.prisma.pregnancy.findFirst({
                where: { cattleId, status: client_1.PregnancyStatus.ACTIVE },
                orderBy: { conceptionDate: 'desc' },
            }),
            this.prisma.lactation.findFirst({
                where: { cattleId, status: client_1.LactationStatus.ACTIVE },
                orderBy: { startDate: 'desc' },
            }),
            this.prisma.heatEvent.findFirst({
                where: { cattleId, resolvedAt: null },
                orderBy: { heatDateTime: 'desc' },
            }),
            this.farmSettings.reproHeatWindowDays(farmId),
            this.farmSettings.reproCloseUpWindowDays(farmId),
            this.prisma.dryPeriod.findFirst({
                where: { cattleId, actualEndDate: null },
            }),
            this.farmSettings.lactationStageThresholds(farmId),
            this.farmSettings.pregnancyStageThresholds(farmId),
            this.farmSettings.reproOverduePregnancyCheckDays(farmId),
            this.farmSettings.reproRepeatBreederThreshold(farmId),
            this.farmSettings.reproLongDaysOpenDays(farmId),
            this.farmSettings.reproCalvingOverdueDays(farmId),
            this.animalHoldService.activeHoldsForCattle(farmId, cattleId, 'REPRODUCTIVE'),
        ]);
        const successfulPregnancies = pregnancies.filter((pregnancy) => pregnancy.status === client_1.PregnancyStatus.ACTIVE ||
            pregnancy.status === client_1.PregnancyStatus.CALVED).length;
        const excluded = await this.historicalKpiExclusions({ cattleId });
        const kpiBreedings = breedings.filter((b) => !b.animalEventId || !excluded.eventIds.includes(b.animalEventId)).length;
        const kpiPregnancies = pregnancies.filter((p) => (p.status === client_1.PregnancyStatus.ACTIVE ||
            p.status === client_1.PregnancyStatus.CALVED) &&
            (!p.sourceDiagnosisId ||
                !excluded.diagnosisIds.includes(p.sourceDiagnosisId))).length;
        const lastBreeding = breedings.at(-1) ?? null;
        const reproductionState = profile?.reproductiveStatus ?? client_1.ReproductionState.NOT_ELIGIBLE;
        const lastCalvingForAlerts = calvings.at(-1) ?? null;
        const breedingsSinceLastSuccess = breedings.filter((b) => !lastCalvingForAlerts ||
            b.breedingDate.getTime() > lastCalvingForAlerts.calvingDate.getTime()).length;
        const daysOpenForAlerts = lastCalvingForAlerts
            ? this.daysBetween(lastCalvingForAlerts.calvingDate, new Date())
            : null;
        const reproductionAlerts = (0, reproduction_alerts_1.deriveReproductionAlerts)({
            now: new Date(),
            reproductionState,
            recentHeat: recentHeat ? { heatDateTime: recentHeat.heatDateTime } : null,
            heatWindowDays,
            lastBreeding: lastBreeding
                ? {
                    status: lastBreeding.status,
                    expectedPregnancyCheckDate: lastBreeding.expectedPregnancyCheckDate,
                }
                : null,
            currentPregnancy: currentPregnancy
                ? { expectedCalvingDate: currentPregnancy.expectedCalvingDate }
                : null,
            closeUpWindowDays,
            overdueCheckDays,
            calvingOverdueDays,
            breedingsSinceLastSuccess,
            repeatBreederThreshold,
            daysOpen: daysOpenForAlerts,
            longDaysOpenThresholdDays,
            totalAbortions: abortions.length,
            hasReproductiveHold: reproductiveHolds.length > 0,
        });
        const lactationStage = (0, lactation_stage_1.deriveLactationStage)({
            now: new Date(),
            lactationStartDate: currentLactation?.startDate ?? null,
            isInActiveDryPeriod: Boolean(openDryPeriod),
            farmSettings: lactationStageThresholds,
        });
        const pregnancyStage = (0, pregnancy_stage_1.derivePregnancyStage)({
            now: new Date(),
            conceptionDate: currentPregnancy?.conceptionDate ?? null,
            farmSettings: {
                ...pregnancyStageThresholds,
                closeUpWindowDays,
                gestationDays: DEFAULT_GESTATION_DAYS,
            },
        });
        return {
            cattle: {
                id: cattle.id,
                tagNumber: cattle.tagNumber,
            },
            status: reproductionState,
            reproductionAlerts,
            lactationStage,
            pregnancyStage,
            currentLactation: profile?.currentLactationNumber ?? 0,
            dim: currentLactation
                ? this.daysBetween(currentLactation.startDate, new Date())
                : null,
            isEstimated: currentLactation?.isEstimated ?? false,
            totalCalvings: calvings.length,
            totalPregnancies: successfulPregnancies,
            totalAbortions: abortions.length,
            conceptionRate: kpiBreedings > 0 ? kpiPregnancies / kpiBreedings : null,
            servicesPerConception: kpiPregnancies > 0 ? kpiBreedings / kpiPregnancies : null,
            averageCalvingInterval: this.averageCalvingInterval(calvings),
            expectedCalvingDate: currentPregnancy?.expectedCalvingDate ?? null,
            daysPregnant: currentPregnancy?.conceptionDate
                ? this.daysBetween(currentPregnancy.conceptionDate, new Date())
                : null,
            lastBreeding: profile?.lastBreedingDate ?? null,
            daysOpen: this.daysOpen(calvings, pregnancies),
            gestationLength: currentPregnancy?.actualCalvingDate && currentPregnancy.conceptionDate
                ? this.daysBetween(currentPregnancy.conceptionDate, currentPregnancy.actualCalvingDate)
                : null,
        };
    }
    async dashboard(farmId) {
        const now = new Date();
        const twelveMonthsAgo = this.addDays(now, -365);
        const vwpDays = await this.farmSettings.reproVwpDays(farmId);
        const heatWindowDays = await this.farmSettings.reproHeatWindowDays(farmId);
        const excludedHistory = await this.historicalKpiExclusions({ farmId });
        const [totalActiveFemaleCows, heatCount12mo, breedingEvents12mo, confirmedPregnancies12mo, allCalvingPairs,] = await Promise.all([
            this.prisma.cattle.count({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    gender: 'FEMALE',
                },
            }),
            this.prisma.heatEvent.count({
                where: {
                    cattle: { farmId },
                    heatDateTime: { gte: twelveMonthsAgo },
                },
            }),
            this.prisma.breedingEvent.count({
                where: {
                    cattle: { farmId },
                    breedingDate: { gte: twelveMonthsAgo },
                    voidedAt: null,
                    OR: [
                        { animalEventId: null },
                        { animalEventId: { notIn: excludedHistory.eventIds } },
                    ],
                },
            }),
            this.prisma.pregnancy.count({
                where: {
                    cattle: { farmId },
                    conceptionDate: { gte: twelveMonthsAgo },
                    status: { in: [client_1.PregnancyStatus.ACTIVE, client_1.PregnancyStatus.CALVED] },
                    OR: [
                        { sourceDiagnosisId: null },
                        { sourceDiagnosisId: { notIn: excludedHistory.diagnosisIds } },
                    ],
                },
            }),
            this.prisma.calvingEvent.findMany({
                where: { cattle: { farmId } },
                orderBy: [{ cattleId: 'asc' }, { calvingDate: 'asc' }],
                select: { cattleId: true, calvingDate: true },
            }),
        ]);
        const avgCalvingInterval = this.herdAvgCalvingInterval(allCalvingPairs);
        const kpis = {
            heat_detection_rate_pct: totalActiveFemaleCows > 0
                ? this.round((heatCount12mo / totalActiveFemaleCows) * 100)
                : null,
            conception_rate_pct: breedingEvents12mo > 0
                ? this.round((confirmedPregnancies12mo / breedingEvents12mo) * 100)
                : null,
            pregnancy_rate_pct: totalActiveFemaleCows > 0
                ? this.round((confirmedPregnancies12mo / totalActiveFemaleCows) * 100)
                : null,
            avg_calving_interval_days: avgCalvingInterval,
        };
        const vwpCutoff = this.addDays(now, -vwpDays);
        const in24h = this.addDays(now, -heatWindowDays);
        const in3d = this.addDays(now, 3);
        const in7d = this.addDays(now, 7);
        const dryoffDimThreshold = 265;
        const [readyForAi, inHeatNow, pregnancyCheckTasks, calvingNext7Days, dryoffDue14Days,] = await Promise.all([
            this.prisma.cattle.findMany({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    gender: 'FEMALE',
                    reproductionProfile: {
                        is: { reproductiveStatus: client_1.ReproductionState.OPEN },
                    },
                    lactations: {
                        some: {
                            status: client_1.LactationStatus.ACTIVE,
                            startDate: { lte: vwpCutoff },
                        },
                    },
                },
                select: {
                    id: true,
                    name: true,
                    tagNumber: true,
                    lactations: {
                        where: { status: client_1.LactationStatus.ACTIVE },
                        select: { startDate: true },
                        take: 1,
                    },
                    reproductionProfile: {
                        select: { lastBreedingDate: true },
                    },
                },
                take: 20,
            }),
            this.prisma.heatEvent.findMany({
                where: {
                    cattle: (0, herd_scope_1.activeHerd)(farmId),
                    heatDateTime: { gte: in24h },
                    resolvedAt: null,
                },
                include: {
                    cattle: { select: { id: true, name: true, tagNumber: true } },
                },
                orderBy: { heatDateTime: 'desc' },
                take: 20,
            }),
            this.prisma.task.findMany({
                where: {
                    farmId,
                    category: client_1.TaskCategory.BREEDING,
                    sourceEventType: 'BREEDING_EVENT',
                    status: { not: client_1.TaskStatus.COMPLETED },
                    dueAt: { lte: in3d },
                    OR: [
                        { name: { startsWith: 'Pregnancy check — ' } },
                        { name: { startsWith: 'Pregnancy recheck — ' } },
                    ],
                },
                orderBy: { dueAt: 'asc' },
                take: 40,
            }),
            this.prisma.pregnancy.findMany({
                where: {
                    cattle: (0, herd_scope_1.activeHerd)(farmId),
                    status: client_1.PregnancyStatus.ACTIVE,
                    expectedCalvingDate: { lte: in7d },
                },
                include: {
                    cattle: { select: { id: true, name: true, tagNumber: true } },
                },
                orderBy: { expectedCalvingDate: 'asc' },
                take: 20,
            }),
            this.prisma.lactation.findMany({
                where: {
                    cattle: (0, herd_scope_1.activeHerd)(farmId),
                    status: client_1.LactationStatus.ACTIVE,
                    startDate: { lte: this.addDays(now, -dryoffDimThreshold) },
                },
                include: {
                    cattle: { select: { id: true, name: true, tagNumber: true } },
                },
                orderBy: { startDate: 'asc' },
                take: 20,
            }),
        ]);
        const checkCattleIds = [
            ...new Set(pregnancyCheckTasks
                .map((t) => t.relatedCattleId)
                .filter((id) => !!id)),
        ];
        const checkBreedingEventIds = [
            ...new Set(pregnancyCheckTasks
                .map((t) => t.sourceEventId)
                .filter((id) => !!id)),
        ];
        const [checkCattleRows, checkBreedingRows] = await Promise.all([
            this.prisma.cattle.findMany({
                where: {
                    id: { in: checkCattleIds },
                    ...(0, herd_scope_1.activeHerd)(farmId),
                },
                select: { id: true, name: true, tagNumber: true },
            }),
            this.prisma.breedingEvent.findMany({
                where: { id: { in: checkBreedingEventIds } },
                select: { id: true, breedingDate: true },
            }),
        ]);
        const checkCattleById = new Map(checkCattleRows.map((c) => [c.id, c]));
        const checkBreedingById = new Map(checkBreedingRows.map((b) => [b.id, b]));
        const pregnancyCheckDue = pregnancyCheckTasks
            .filter((t) => t.name.startsWith('Pregnancy check — ') && t.relatedCattleId)
            .map((t) => {
            const cattle = checkCattleById.get(t.relatedCattleId);
            const breeding = t.sourceEventId
                ? checkBreedingById.get(t.sourceEventId)
                : undefined;
            return cattle
                ? {
                    cattle_id: cattle.id,
                    name: cattle.name,
                    tag: cattle.tagNumber,
                    ai_date: breeding?.breedingDate ?? null,
                    check_due_date: t.dueAt,
                    breeding_event_id: t.sourceEventId ?? null,
                }
                : null;
        })
            .filter((r) => r !== null)
            .slice(0, 20);
        const pregnancyRecheckDue = pregnancyCheckTasks
            .filter((t) => t.name.startsWith('Pregnancy recheck — ') && t.relatedCattleId)
            .map((t) => {
            const cattle = checkCattleById.get(t.relatedCattleId);
            const breeding = t.sourceEventId
                ? checkBreedingById.get(t.sourceEventId)
                : undefined;
            return cattle
                ? {
                    cattle_id: cattle.id,
                    name: cattle.name,
                    tag: cattle.tagNumber,
                    ai_date: breeding?.breedingDate ?? null,
                    recheck_due_date: t.dueAt,
                    breeding_event_id: t.sourceEventId ?? null,
                }
                : null;
        })
            .filter((r) => r !== null)
            .slice(0, 20);
        const action_required = {
            ready_for_ai: readyForAi.map((c) => {
                const lactationStart = c.lactations[0]?.startDate;
                return {
                    cattle_id: c.id,
                    name: c.name,
                    tag: c.tagNumber,
                    dim: lactationStart ? this.daysBetween(lactationStart, now) : null,
                    days_open: lactationStart
                        ? this.daysBetween(lactationStart, now)
                        : null,
                };
            }),
            in_heat_now: inHeatNow.map((h) => ({
                cattle_id: h.cattle.id,
                name: h.cattle.name,
                tag: h.cattle.tagNumber,
                heat_observed_at: h.heatDateTime,
            })),
            pregnancy_check_due: pregnancyCheckDue,
            pregnancy_recheck_due: pregnancyRecheckDue,
            calving_next_7_days: calvingNext7Days.map((p) => ({
                cattle_id: p.cattle.id,
                pregnancy_id: p.id,
                name: p.cattle.name,
                tag: p.cattle.tagNumber,
                expected_date: p.expectedCalvingDate,
                days_remaining: p.expectedCalvingDate
                    ? this.daysBetween(now, p.expectedCalvingDate)
                    : null,
            })),
            dryoff_due_14_days: dryoffDue14Days.map((l) => ({
                cattle_id: l.cattle.id,
                name: l.cattle.name,
                tag: l.cattle.tagNumber,
                dim: this.daysBetween(l.startDate, now),
                dryoff_target_date: this.addDays(l.startDate, 280),
            })),
        };
        const calvingForecast30 = await this.prisma.pregnancy.findMany({
            where: {
                cattle: { farmId },
                status: client_1.PregnancyStatus.ACTIVE,
                expectedCalvingDate: { gte: now, lte: this.addDays(now, 30) },
            },
            include: {
                cattle: { select: { id: true, name: true, tagNumber: true } },
            },
            orderBy: { expectedCalvingDate: 'asc' },
        });
        const calving_forecast_30_days = calvingForecast30.map((p) => ({
            cattle_id: p.cattle.id,
            name: p.cattle.name,
            tag: p.cattle.tagNumber,
            expected_date: p.expectedCalvingDate,
        }));
        const openCows = await this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                gender: 'FEMALE',
                reproductionProfile: {
                    is: { reproductiveStatus: client_1.ReproductionState.OPEN },
                },
            },
            include: {
                reproductionProfile: {
                    select: {
                        totalBreedings: true,
                        totalPregnancies: true,
                        lastBreedingDate: true,
                    },
                },
                lactations: {
                    where: { status: client_1.LactationStatus.ACTIVE },
                    select: { startDate: true },
                    take: 1,
                },
            },
            take: 50,
            orderBy: { createdAt: 'asc' },
        });
        const open_cows = openCows.map((c) => {
            const lactationStart = c.lactations[0]?.startDate ?? null;
            const dim = lactationStart ? this.daysBetween(lactationStart, now) : null;
            const profile = c.reproductionProfile;
            const conceptionRate = profile && profile.totalBreedings > 0
                ? this.round((profile.totalPregnancies / profile.totalBreedings) * 100)
                : null;
            return {
                cattle_id: c.id,
                name: c.name,
                tag: c.tagNumber,
                dim,
                days_open: dim,
                last_ai_date: profile?.lastBreedingDate ?? null,
                vwp_end_date: lactationStart
                    ? this.addDays(lactationStart, vwpDays)
                    : null,
                conception_rate_pct: conceptionRate,
            };
        });
        return { kpis, action_required, calving_forecast_30_days, open_cows };
    }
    async listReproductionCows(farmId, query) {
        const statuses = query.status
            ? [query.status]
            : [
                client_1.ReproductionState.OPEN,
                client_1.ReproductionState.BRED_AWAITING_CONFIRMATION,
                client_1.ReproductionState.PREGNANT,
            ];
        const rows = await this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                gender: client_1.CattleGender.FEMALE,
                reproductionProfile: { is: { reproductiveStatus: { in: statuses } } },
            },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                reproductionProfile: true,
                breedingEvents: {
                    where: { voidedAt: null },
                    orderBy: { breedingDate: 'desc' },
                    take: 1,
                    include: {
                        diagnoses: { orderBy: { diagnosisDate: 'desc' }, take: 1 },
                    },
                },
                pregnancies: {
                    where: { status: client_1.PregnancyStatus.ACTIVE },
                    take: 1,
                },
            },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const now = new Date();
        return {
            ...page,
            items: page.items.map((c) => {
                const profile = c.reproductionProfile;
                const lastBreeding = c.breedingEvents[0] ?? null;
                const activePregnancy = c.pregnancies[0] ?? null;
                return {
                    cattle_id: c.id,
                    name: c.name,
                    tag: c.tagNumber,
                    status: profile?.reproductiveStatus ?? null,
                    last_ai_date: profile?.lastBreedingDate ?? null,
                    pregnancy_checked: Boolean(lastBreeding?.diagnoses.length),
                    days_open: profile?.lastCalvingDate
                        ? this.daysBetween(profile.lastCalvingDate, now)
                        : null,
                    days_pregnant: activePregnancy?.conceptionDate
                        ? this.daysBetween(activePregnancy.conceptionDate, now)
                        : null,
                    expected_calving_date: activePregnancy?.expectedCalvingDate ?? null,
                };
            }),
        };
    }
    herdAvgCalvingInterval(pairs) {
        const byCow = new Map();
        for (const p of pairs) {
            const list = byCow.get(p.cattleId) ?? [];
            list.push(p.calvingDate);
            byCow.set(p.cattleId, list);
        }
        const intervals = [];
        for (const dates of byCow.values()) {
            for (let i = 1; i < dates.length; i += 1) {
                intervals.push(this.daysBetween(dates[i - 1], dates[i]));
            }
        }
        if (intervals.length === 0)
            return null;
        return Math.round(intervals.reduce((sum, v) => sum + v, 0) / intervals.length);
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
    async flipToMilking(tx, cattleId) {
        await tx.cattle.updateMany({
            where: { id: cattleId, herdStatus: 'ACTIVE', deletedAt: null },
            data: { productionStatus: client_1.ProductionStatus.MILKING },
        });
    }
    async lockCattleForUpdate(tx, cattleId) {
        await tx.$queryRaw(client_1.Prisma.sql `SELECT id FROM "Cattle" WHERE id = ${cattleId} FOR UPDATE`);
    }
    async createBreedingTaskUnlessDuplicate(input, namePrefix) {
        if ((0, event_api_context_1.eventApiContext)()?.historical)
            return;
        if (input.sourceEventType && input.sourceEventId) {
            const existing = await this.prisma.task.findFirst({
                where: {
                    farmId: input.farmId,
                    sourceEventType: input.sourceEventType,
                    sourceEventId: input.sourceEventId,
                    status: { not: client_1.TaskStatus.COMPLETED },
                    name: { startsWith: namePrefix },
                },
                select: { id: true },
            });
            if (existing) {
                this.log.info('Duplicate pregnancy-check/recheck task suppressed', {
                    farmId: input.farmId,
                    sourceEventId: input.sourceEventId,
                    existingTaskId: existing.id,
                });
                return existing;
            }
        }
        return this.taskService.createInternal(input);
    }
    async historicalKpiExclusions(scope) {
        const events = await this.prisma.animalEvent.findMany({
            where: { ...scope, provenance: 'HISTORICAL', status: 'ACTIVE' },
            select: { id: true },
        });
        const eventIds = events.map((e) => e.id);
        const diagnoses = eventIds.length
            ? await this.prisma.pregnancyDiagnosis.findMany({
                where: { animalEventId: { in: eventIds } },
                select: { id: true },
            })
            : [];
        return { eventIds, diagnosisIds: diagnoses.map((d) => d.id) };
    }
    async withIdempotency(farmId, key, endpoint, fn) {
        if (!key)
            return fn();
        try {
            await this.prisma.idempotencyKey.create({
                data: { farmId, key, endpoint },
            });
        }
        catch (error) {
            if (!this.isUniqueError(error))
                throw error;
            const existing = await this.prisma.idempotencyKey.findUnique({
                where: { farmId_key_endpoint: { farmId, key, endpoint } },
            });
            if (existing?.responseBody) {
                return existing.responseBody;
            }
            throw new common_1.ConflictException('An identical request with this Idempotency-Key is already in progress');
        }
        const result = await fn();
        await this.prisma.idempotencyKey.update({
            where: { farmId_key_endpoint: { farmId, key, endpoint } },
            data: { responseBody: result },
        });
        return result;
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
    async getFemaleCattle(farmId, cattleId) {
        const cattle = await this.getCattleOrThrow(farmId, cattleId);
        if (cattle.gender !== client_1.CattleGender.FEMALE) {
            throw new common_1.BadRequestException('Reproduction records can only be created for female cattle');
        }
        return cattle;
    }
    async getCattleOrThrow(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: {
                id: true,
                farmId: true,
                gender: true,
                tagNumber: true,
            },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
        return cattle;
    }
    async assertCattleInFarm(farmId, cattleId) {
        return this.getCattleOrThrow(farmId, cattleId);
    }
    async assertServiceProviderInFarm(farmId, serviceProviderId) {
        const provider = await this.prisma.serviceProvider.findFirst({
            where: { id: serviceProviderId, farmId, deletedAt: null },
        });
        if (!provider) {
            throw new common_1.BadRequestException('serviceProviderId does not refer to an active service provider on this farm');
        }
        return provider;
    }
    async getBreedingEventForCattle(id, cattleId) {
        const event = await this.prisma.breedingEvent.findFirst({
            where: { id, cattleId },
        });
        if (!event) {
            throw new common_1.BadRequestException('Breeding event must belong to the same cattle');
        }
        if (event.voidedAt) {
            throw new common_1.BadRequestException('That breeding was voided - pick a live breeding.');
        }
        return event;
    }
    async getPregnancyForCattle(id, cattleId) {
        const pregnancy = await this.prisma.pregnancy.findFirst({
            where: { id, cattleId },
            include: { breedingEvent: true },
        });
        if (!pregnancy) {
            throw new common_1.BadRequestException('Pregnancy must belong to the same cattle');
        }
        return pregnancy;
    }
    async buildScopedWhere(farmId, query, dateField) {
        if (query.cattleId) {
            await this.getCattleOrThrow(farmId, query.cattleId);
        }
        return {
            cattle: { farmId },
            ...(query.cattleId ? { cattleId: query.cattleId } : {}),
            ...this.dateRange(dateField, query.fromDate, query.toDate),
        };
    }
    async ensureProfile(cattleId) {
        await this.prisma.reproductionProfile.upsert({
            where: { cattleId },
            create: { cattleId },
            update: {},
        });
    }
    dateRange(field, fromDate, toDate) {
        if (!fromDate && !toDate)
            return {};
        return {
            [field]: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
            },
        };
    }
    averageCalvingInterval(calvings) {
        if (calvings.length < 2)
            return null;
        const intervals = [];
        for (let index = 1; index < calvings.length; index += 1) {
            intervals.push(this.daysBetween(calvings[index - 1].calvingDate, calvings[index].calvingDate));
        }
        return Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length);
    }
    daysOpen(calvings, pregnancies) {
        const lastCalving = calvings.at(-1);
        if (!lastCalving)
            return null;
        const conceptionAfterCalving = pregnancies.find((pregnancy) => pregnancy.conceptionDate !== null &&
            pregnancy.conceptionDate.getTime() >
                lastCalving.calvingDate.getTime() &&
            (pregnancy.status === client_1.PregnancyStatus.ACTIVE ||
                pregnancy.status === client_1.PregnancyStatus.CALVED));
        if (!conceptionAfterCalving?.conceptionDate)
            return null;
        return this.daysBetween(lastCalving.calvingDate, conceptionAfterCalving.conceptionDate);
    }
    daysBetween(start, end) {
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    endOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }
    addHours(date, hours) {
        return new Date(date.getTime() + hours * 60 * 60 * 1000);
    }
};
exports.ReproductionService = ReproductionService;
exports.ReproductionService = ReproductionService = ReproductionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aqr_service_1.AqrService,
        task_service_1.TaskService,
        semen_service_1.SemenService,
        expense_service_1.ExpenseService,
        calf_service_1.CalfService,
        farm_settings_service_1.FarmSettingsService,
        animal_hold_service_1.AnimalHoldService,
        logger_service_1.LoggerService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        activity_log_service_1.ActivityLogService])
], ReproductionService);
//# sourceMappingURL=reproduction.service.js.map