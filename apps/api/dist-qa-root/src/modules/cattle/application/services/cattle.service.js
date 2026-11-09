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
var CattleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CattleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const subscription_access_service_1 = require("src/modules/subscription/application/services/subscription-access.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const animal_hold_service_1 = require("./animal-hold.service");
const animal_upcoming_events_service_1 = require("./animal-upcoming-events.service");
const history_event_1 = require("../../domain/history-event");
const animal_event_write_service_1 = require("src/modules/animal-events/application/services/animal-event-write.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const eligibility_service_1 = require("src/modules/animal-events/application/services/eligibility.service");
const media_service_1 = require("src/modules/media/application/services/media.service");
const client_2 = require("@prisma/client");
const herd_scope_1 = require("../../domain/herd-scope");
const health_status_1 = require("../../domain/health-status");
const animal_category_1 = require("../../domain/animal-category");
const lifecycle_bands_1 = require("../../domain/lifecycle-bands");
const reproduction_alerts_1 = require("src/modules/reproduction/domain/reproduction-alerts");
const lactation_stage_1 = require("src/modules/reproduction/domain/lactation-stage");
const pregnancy_stage_1 = require("src/modules/reproduction/domain/pregnancy-stage");
const reproduction_derivation_service_1 = require("src/modules/reproduction/application/services/reproduction-derivation.service");
const reproduction_service_1 = require("src/modules/reproduction/application/services/reproduction.service");
const aqr_trend_1 = require("./aqr-trend");
const OPEN_HEALTH_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const DEFAULT_GESTATION_DAYS = 280;
const DISPOSITION_CATTLE_STATUS = {
    [client_1.CattleDispositionType.SALE]: client_1.HerdStatus.SOLD,
    [client_1.CattleDispositionType.DEATH]: client_1.HerdStatus.DECEASED,
    [client_1.CattleDispositionType.CULL]: client_1.HerdStatus.CULLED,
    [client_1.CattleDispositionType.TRANSFER]: client_1.HerdStatus.SOLD,
};
const DISPOSITION_LACTATION_END_REASON = {
    [client_1.CattleDispositionType.SALE]: client_1.LactationEndReason.SOLD,
    [client_1.CattleDispositionType.DEATH]: client_1.LactationEndReason.DEATH,
    [client_1.CattleDispositionType.CULL]: client_1.LactationEndReason.CULLED,
};
let CattleService = class CattleService {
    static { CattleService_1 = this; }
    prisma;
    aqrService;
    subscriptionAccess;
    media;
    farmSettings;
    derivation;
    reproductionService;
    taskService;
    animalHoldService;
    logger;
    upcomingEventsService;
    eligibility;
    eventWriter;
    log;
    constructor(prisma, aqrService, subscriptionAccess, media, farmSettings, derivation, reproductionService, taskService, animalHoldService, logger, upcomingEventsService, eligibility, eventWriter) {
        this.prisma = prisma;
        this.aqrService = aqrService;
        this.subscriptionAccess = subscriptionAccess;
        this.media = media;
        this.farmSettings = farmSettings;
        this.derivation = derivation;
        this.reproductionService = reproductionService;
        this.taskService = taskService;
        this.animalHoldService = animalHoldService;
        this.logger = logger;
        this.upcomingEventsService = upcomingEventsService;
        this.eligibility = eligibility;
        this.eventWriter = eventWriter;
        this.log = this.logger.setContext(CattleService_1.name);
    }
    async create(farmId, userId, dto) {
        const activeCount = await this.prisma.cattle.count({
            where: (0, herd_scope_1.activeHerd)(farmId),
        });
        await this.subscriptionAccess.assertCattleLimit(farmId, activeCount);
        await this.validateReferences(farmId, dto);
        await this.validateParentRules(farmId, undefined, dto);
        for (const h of dto.history ?? []) {
            if (h.kind === 'MILKING_SINCE' && h.date) {
                dto.productionStatus ??= client_1.ProductionStatus.MILKING;
                dto.priorCalvings ??= 1;
                dto.intakeLactation ??= { estimatedCalvingDate: h.date };
            }
            if (h.kind === 'DRY_SINCE' && h.date) {
                dto.productionStatus ??= client_1.ProductionStatus.DRY;
                dto.dryOffStartDate ??= h.date;
            }
        }
        const historyItems = [...(dto.history ?? [])];
        if (dto.intakeBreeding) {
            historyItems.push({
                kind: 'LAST_BREEDING',
                date: dto.intakeBreeding.breedingDate,
                method: dto.intakeBreeding.breedingMethod,
            });
        }
        if (dto.productionStatus === client_1.ProductionStatus.MILKING) {
            if (!dto.priorCalvings) {
                throw new common_1.BadRequestException('A heifer (no calving history) cannot be set to Milking. Record a calving event, or if she was purchased already-calved, supply priorCalvings.');
            }
            if (!dto.lactationStartDate && !dto.intakeLactation) {
                throw new common_1.BadRequestException('lactationStartDate or intakeLactation is required when registering a cow with productionStatus MILKING (e.g. a purchased already-milking cow with no calving history in this system).');
            }
        }
        if (dto.productionStatus === client_1.ProductionStatus.DRY && !dto.dryOffStartDate) {
            throw new common_1.BadRequestException('dryOffStartDate is required when registering a cow with productionStatus DRY (e.g. a purchased already-dry cow with no lactation history in this system).');
        }
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const cattle = await tx.cattle.create({
                    data: {
                        farmId,
                        name: dto.name,
                        tagNumber: dto.tagNumber,
                        image: dto.image,
                        breedId: dto.breedId,
                        gender: dto.gender,
                        dateOfBirth: dto.dateOfBirth
                            ? new Date(dto.dateOfBirth)
                            : undefined,
                        herdStatus: dto.status ?? client_1.HerdStatus.ACTIVE,
                        shedId: dto.shedId,
                        lastWeightKg: dto.weightKg,
                        lastBcs: dto.bcs,
                        motherId: dto.motherId,
                        fatherId: dto.fatherId,
                        sourceType: dto.sourceType ?? client_1.CattleSourceType.UNKNOWN,
                        color: dto.color,
                        notes: dto.notes,
                        createdBy: userId,
                        ...(dto.bcs
                            ? {
                                bcsRecords: {
                                    create: {
                                        score: dto.bcs,
                                        recordedDate: new Date(),
                                        recordedBy: userId,
                                    },
                                },
                            }
                            : {}),
                        ...(dto.gender === client_1.CattleGender.FEMALE
                            ? {
                                reproductionProfile: {
                                    create: {
                                        ...(dto.priorCalvings
                                            ? { totalCalvings: dto.priorCalvings }
                                            : {}),
                                    },
                                },
                            }
                            : {}),
                    },
                });
                if (dto.animalGroupId) {
                    await tx.animalGroupMember.create({
                        data: {
                            groupId: dto.animalGroupId,
                            cattleId: cattle.id,
                            farmId,
                            addedBy: userId,
                        },
                    });
                }
                if (dto.intakePregnancy) {
                    const conceptionDate = dto.intakePregnancy.conceptionDate
                        ? new Date(dto.intakePregnancy.conceptionDate)
                        : this.addDays(new Date(dto.intakePregnancy.expectedCalvingDate), -DEFAULT_GESTATION_DAYS);
                    const expectedCalvingDate = dto.intakePregnancy.expectedCalvingDate
                        ? new Date(dto.intakePregnancy.expectedCalvingDate)
                        : this.addDays(conceptionDate, DEFAULT_GESTATION_DAYS);
                    const diagnosis = await tx.pregnancyDiagnosis.create({
                        data: {
                            cattleId: cattle.id,
                            diagnosisDate: new Date(),
                            result: client_1.PregnancyDiagnosisResult.PREGNANT,
                            diagnosisMethod: client_1.PregnancyDiagnosisMethod.PURCHASE_INTAKE,
                            expectedCalvingDate,
                        },
                    });
                    await tx.pregnancy.create({
                        data: {
                            cattleId: cattle.id,
                            conceptionDate,
                            expectedCalvingDate,
                            status: client_1.PregnancyStatus.ACTIVE,
                            sourceDiagnosisId: diagnosis.id,
                        },
                    });
                }
                if (dto.productionStatus === client_1.ProductionStatus.MILKING) {
                    if (dto.intakeLactation) {
                        const now = new Date();
                        const startDate = dto.intakeLactation.estimatedDaysInMilk !== undefined
                            ? this.addDays(now, -dto.intakeLactation.estimatedDaysInMilk)
                            : dto.intakeLactation.estimatedCalvingDate
                                ? new Date(dto.intakeLactation.estimatedCalvingDate)
                                : now;
                        await tx.lactation.create({
                            data: {
                                cattleId: cattle.id,
                                lactationNumber: dto.intakeLactation.estimatedLactationNumber ?? 1,
                                startDate,
                                status: client_1.LactationStatus.ACTIVE,
                                startReason: client_1.LactationStartReason.PURCHASED_LACTATING,
                                isEstimated: true,
                                estimatedLactationNumber: dto.intakeLactation.estimatedLactationNumber ?? null,
                                estimatedDaysInMilk: dto.intakeLactation.estimatedDaysInMilk ?? null,
                            },
                        });
                    }
                    else if (dto.lactationStartDate) {
                        await tx.lactation.create({
                            data: {
                                cattleId: cattle.id,
                                lactationNumber: 1,
                                startDate: new Date(dto.lactationStartDate),
                                status: client_1.LactationStatus.ACTIVE,
                                startReason: client_1.LactationStartReason.PURCHASED_LACTATING,
                            },
                        });
                    }
                }
                if (dto.productionStatus === client_1.ProductionStatus.DRY) {
                    await tx.dryPeriod.create({
                        data: {
                            cattleId: cattle.id,
                            startDate: new Date(dto.dryOffStartDate),
                        },
                    });
                }
                if (dto.intakeHealthCondition) {
                    const caseCode = await this.nextHealthCaseCode(tx, farmId);
                    await tx.healthCase.create({
                        data: {
                            farmId,
                            cattleId: cattle.id,
                            caseCode,
                            note: dto.intakeHealthCondition.note,
                            condition: dto.intakeHealthCondition.condition,
                            careType: dto.intakeHealthCondition.careType,
                            priority: dto.intakeHealthCondition.priority,
                            startDate: new Date(),
                            symptoms: [],
                            notes: dto.intakeHealthCondition.notes,
                        },
                    });
                }
                if (historyItems.some((h) => (0, history_event_1.historyEvent)(h)) && this.eventWriter) {
                    for (const h of historyItems) {
                        const ev = (0, history_event_1.historyEvent)(h);
                        if (!ev)
                            continue;
                        await tx_context_1.txStore.run({ tx }, () => this.eventWriter.record(farmId, userId, cattle.id, {
                            type: ev.type,
                            eventAt: ev.eventAt,
                            provenance: 'HISTORICAL',
                            payload: ev.payload,
                        }));
                    }
                }
                return cattle.id;
            });
            if (dto.intakeHeat) {
                await this.reproductionService.createHeatEvent(farmId, {
                    cattleId: created,
                    heatDateTime: dto.intakeHeat.heatDateTime,
                    detectionMethod: client_1.HeatDetectionMethod.MANUAL,
                    notes: dto.intakeHeat.notes,
                });
            }
            await this.derivation.refreshDerivedState(farmId, created);
            const cattle = await this.prisma.cattle.findUniqueOrThrow({
                where: { id: created },
                include: this.defaultInclude(),
            });
            this.log.info('Cattle created', { cattleId: cattle.id, farmId });
            const aqr = await this.aqrService.applyEvent(farmId, cattle.id, 'animal_registered', {
                actorId: userId,
                actionDetails: `New cattle [${cattle.name ?? cattle.tagNumber}] registered.`,
            });
            return { ...this.composeStatus(cattle), aqrScore: aqr.aqrScore };
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Tag number already exists for this farm');
            }
            throw error;
        }
    }
    async findAll(farmId, query) {
        const presetSettings = query.lifecycleSubStage || query.animalCategory
            ? await this.farmSettings.getEffective(farmId)
            : undefined;
        const where = {
            ...(query.includeDeleted ? (0, herd_scope_1.anyRecord)(farmId) : (0, herd_scope_1.notDeleted)(farmId)),
            herdStatus: query.status ?? client_1.HerdStatus.ACTIVE,
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { tagNumber: { contains: query.search, mode: 'insensitive' } },
                        { color: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
            ...(query.breedId ? { breedId: query.breedId } : {}),
            ...(query.gender ? { gender: query.gender } : {}),
            ...(query.productionStatus
                ? { productionStatus: query.productionStatus }
                : {}),
            ...(query.shedId ? { shedId: query.shedId } : {}),
            ...(query.animalGroupId
                ? {
                    animalGroupMemberships: {
                        some: { groupId: query.animalGroupId },
                    },
                }
                : {}),
            ...(query.reproductiveStatus
                ? {
                    reproductionProfile: {
                        is: { reproductiveStatus: query.reproductiveStatus },
                    },
                }
                : {}),
            ...(query.healthStatus ? this.healthStatusWhere(query.healthStatus) : {}),
            ...(query.animalCategory
                ? (0, animal_category_1.buildAnimalCategoryWhere)(query.animalCategory, new Date(), presetSettings?.cattleLifecycleWeaningDays)
                : {}),
            ...(query.lifecycleSubStage
                ? (0, lifecycle_bands_1.buildLifecycleSubStageWhere)(query.lifecycleSubStage, new Date(), this.lifecycleBoundaries(presetSettings))
                : {}),
        };
        const dueWhere = query.dueFilter
            ? await this.upcomingEventsService.dueFilterWhere(farmId, query.dueFilter)
            : null;
        const categoryWhere = query.category && this.eligibility
            ? await this.eligibility.categoryWhere(farmId, query.category)
            : null;
        const extraWhere = [dueWhere, categoryWhere].filter((w) => w !== null);
        const rows = await this.prisma.cattle.findMany({
            where: extraWhere.length ? { AND: [where, ...extraWhere] } : where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: this.defaultInclude(),
        });
        const reproCtx = await this.buildReproductionContext(farmId, rows.map((row) => row.id), presetSettings);
        const upcoming = await this.upcomingEventsService.forCattle(farmId, rows.map((row) => row.id), { limit: 1 });
        const page = (0, pagination_1.toCursorPage)(rows.map((row) => {
            const events = upcoming.get(row.id);
            return {
                ...this.composeStatus(row, reproCtx),
                next_event: events?.events[0] ?? null,
                upcoming_event_count: events?.total ?? 0,
            };
        }), query);
        const items = await this.attachListPhotos(farmId, page.items);
        return { ...page, items };
    }
    async findUpcomingEvents(farmId, id, query) {
        await this.getCattleOrThrow(farmId, id);
        const result = await this.upcomingEventsService.forCattle(farmId, [id], {
            windowDays: query.windowDays,
            limit: query.limit,
        });
        return result.get(id) ?? { events: [], total: 0 };
    }
    async findOne(farmId, id) {
        const cattle = await this.getCattleOrThrow(farmId, id, this.defaultInclude());
        const reproCtx = await this.buildReproductionContext(farmId, [id]);
        let breedingsSinceLastSuccess;
        if (cattle.gender === client_1.CattleGender.FEMALE) {
            const lastCalvingDate = cattle.reproductionProfile?.lastCalvingDate ?? null;
            breedingsSinceLastSuccess = await this.prisma.breedingEvent.count({
                where: {
                    cattleId: id,
                    ...(lastCalvingDate ? { breedingDate: { gt: lastCalvingDate } } : {}),
                },
            });
        }
        return this.attachDetailPhoto(this.composeStatus(cattle, reproCtx, breedingsSinceLastSuccess));
    }
    async update(farmId, id, dto, userId) {
        await this.getCattleOrThrow(farmId, id);
        await this.validateReferences(farmId, dto);
        await this.validateParentRules(farmId, id, dto);
        let activeLactation = null;
        if (dto.lactationStartDate !== undefined ||
            dto.productionStatus === client_1.ProductionStatus.MILKING) {
            activeLactation = await this.prisma.lactation.findFirst({
                where: { cattleId: id, status: client_1.LactationStatus.ACTIVE },
                select: { id: true },
            });
        }
        if (dto.lactationStartDate !== undefined && activeLactation) {
            throw new common_1.BadRequestException('This cow already has an active lactation. lactationStartDate on PATCH /cattle/:id only starts a new one — record a calving event, or edit the existing lactation directly, instead.');
        }
        if (dto.productionStatus === client_1.ProductionStatus.MILKING &&
            !activeLactation &&
            !dto.lactationStartDate) {
            throw new common_1.BadRequestException('No active lactation on record. Provide lactationStartDate to record this cow as milking (e.g. for a purchased cow with no calving history in this system).');
        }
        let openDryPeriod = null;
        if (dto.productionStatus === client_1.ProductionStatus.DRY) {
            openDryPeriod = await this.prisma.dryPeriod.findFirst({
                where: { cattleId: id, actualEndDate: null },
                select: { id: true },
            });
            if (!openDryPeriod && !dto.dryOffStartDate) {
                throw new common_1.BadRequestException('dryOffStartDate is required to record this cow as dry (no open dry period on record). Provide dryOffStartDate, or record a real dry-off event instead.');
            }
        }
        try {
            const cattle = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.cattle.update({
                    where: { id },
                    data: {
                        name: dto.name,
                        tagNumber: dto.tagNumber,
                        image: dto.image,
                        breedId: dto.breedId,
                        gender: dto.gender,
                        dateOfBirth: dto.dateOfBirth
                            ? new Date(dto.dateOfBirth)
                            : undefined,
                        herdStatus: dto.status,
                        shedId: dto.shedId,
                        lastWeightKg: dto.weightKg,
                        lastBcs: dto.bcs,
                        motherId: dto.motherId,
                        fatherId: dto.fatherId,
                        sourceType: dto.sourceType,
                        color: dto.color,
                        notes: dto.notes,
                        ...(dto.bcs
                            ? {
                                bcsRecords: {
                                    create: {
                                        score: dto.bcs,
                                        recordedDate: new Date(),
                                        recordedBy: userId,
                                    },
                                },
                            }
                            : {}),
                    },
                });
                if (dto.priorCalvings !== undefined) {
                    await tx.reproductionProfile.upsert({
                        where: { cattleId: id },
                        update: { totalCalvings: dto.priorCalvings },
                        create: { cattleId: id, totalCalvings: dto.priorCalvings },
                    });
                }
                if (dto.lactationStartDate) {
                    const lactationCount = await tx.lactation.count({
                        where: { cattleId: id },
                    });
                    await tx.lactation.create({
                        data: {
                            cattleId: id,
                            lactationNumber: lactationCount + 1,
                            startDate: new Date(dto.lactationStartDate),
                            status: client_1.LactationStatus.ACTIVE,
                            startReason: client_1.LactationStartReason.PURCHASED_LACTATING,
                        },
                    });
                }
                if (dto.productionStatus === client_1.ProductionStatus.DRY &&
                    !openDryPeriod &&
                    dto.dryOffStartDate) {
                    await tx.dryPeriod.create({
                        data: { cattleId: id, startDate: new Date(dto.dryOffStartDate) },
                    });
                }
                return tx.cattle.findUniqueOrThrow({
                    where: { id: updated.id },
                    include: this.defaultInclude(),
                });
            });
            const needsRecompute = dto.priorCalvings !== undefined ||
                Boolean(dto.lactationStartDate) ||
                dto.productionStatus !== undefined;
            if (needsRecompute) {
                await this.derivation.refreshDerivedState(farmId, id);
            }
            const fresh = needsRecompute
                ? await this.prisma.cattle.findUniqueOrThrow({
                    where: { id },
                    include: this.defaultInclude(),
                })
                : cattle;
            this.log.info('Cattle updated', { cattleId: id, farmId });
            return this.composeStatus(fresh);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Tag number already exists for this farm');
            }
            throw error;
        }
    }
    async archive(farmId, id, userId) {
        return this.archiveWithReason(farmId, id, {}, userId);
    }
    static ARCHIVE_REASON_TO_DISPOSITION = {
        sold: client_1.CattleDispositionType.SALE,
        deceased: client_1.CattleDispositionType.DEATH,
        culled: client_1.CattleDispositionType.CULL,
    };
    async archiveWithReason(farmId, id, dto, userId) {
        await this.getCattleOrThrow(farmId, id);
        const dispositionType = dto.reason
            ? CattleService_1.ARCHIVE_REASON_TO_DISPOSITION[dto.reason]
            : undefined;
        if (dispositionType) {
            await this.recordDisposition(farmId, userId, id, {
                type: dispositionType,
                date: new Date(),
                reason: dto.notes ?? null,
            });
            return this.findOne(farmId, id);
        }
        const [milkLogCount, healthCaseCount, breedingEventCount] = await Promise.all([
            this.prisma.milkLogEntry.count({ where: { cattleId: id } }),
            this.prisma.healthCase.count({ where: { cattleId: id } }),
            this.prisma.breedingEvent.count({ where: { cattleId: id } }),
        ]);
        if (milkLogCount > 0 || healthCaseCount > 0 || breedingEventCount > 0) {
            throw new common_1.ConflictException('This animal has real history (milk logs, health cases, or breeding events) and cannot be deleted — dispose it instead.');
        }
        const cattle = await this.prisma.cattle.update({
            where: { id },
            data: { deletedAt: new Date(), deletedById: userId },
            include: this.defaultInclude(),
        });
        this.log.info('Cattle archived', { cattleId: id, farmId });
        return this.composeStatus(cattle);
    }
    async recordDisposition(farmId, userId, cattleId, dto, tx) {
        await this.getCattleOrThrow(farmId, cattleId);
        const existingSale = await this.prisma.cattleDisposition.findFirst({
            where: { cattleId, type: client_1.CattleDispositionType.SALE },
            select: { id: true },
        });
        if (existingSale) {
            throw new common_1.ConflictException('This animal has already been sold and cannot be sold again.');
        }
        const run = (client) => this.recordDispositionWithClient(client, farmId, userId, cattleId, dto);
        const disposition = tx
            ? await run(tx)
            : await this.prisma.$transaction((t) => run(t));
        this.log.info('Cattle disposition recorded', {
            cattleId,
            farmId,
            type: dto.type,
            dispositionId: disposition.id,
        });
        await this.cleanupOnDisposition(farmId, cattleId, userId, dto.type);
        return disposition;
    }
    async cleanupOnDisposition(farmId, cattleId, userId, type) {
        const note = `Animal left the herd (${type}) — task closed automatically.`;
        await this.taskService.completeForCattle(farmId, cattleId, userId, note);
        await this.animalHoldService.releaseAllForCattle(farmId, cattleId, userId);
    }
    async recordDispositionWithClient(client, farmId, userId, cattleId, dto) {
        const disposition = await client.cattleDisposition.create({
            data: {
                farmId,
                cattleId,
                type: dto.type,
                saleId: dto.saleId ?? null,
                date: dto.date,
                price: dto.price ?? null,
                reason: dto.reason ?? null,
                createdById: userId,
            },
        });
        const status = DISPOSITION_CATTLE_STATUS[dto.type];
        const lactationEndReason = DISPOSITION_LACTATION_END_REASON[dto.type];
        if (lactationEndReason) {
            await this.closeActiveLactation(client, cattleId, lactationEndReason);
        }
        await client.cattle.update({
            where: { id: cattleId },
            data: {
                herdStatus: status,
                productionStatus: null,
                dispositionId: disposition.id,
                ...(dto.type === client_1.CattleDispositionType.SALE
                    ? { soldAt: dto.date }
                    : {}),
            },
        });
        return disposition;
    }
    async undoDisposition(farmId, cattleId, tx) {
        const client = tx ?? this.prisma;
        const disposition = await client.cattleDisposition.findFirst({
            where: { farmId, cattleId, type: client_1.CattleDispositionType.SALE },
            select: { id: true },
        });
        if (!disposition) {
            throw new common_1.NotFoundException('No sale disposition found for this animal to undo');
        }
        await client.cattleDisposition.delete({ where: { id: disposition.id } });
        await client.cattle.update({
            where: { id: cattleId },
            data: {
                herdStatus: client_1.HerdStatus.ACTIVE,
                dispositionId: null,
                soldAt: null,
            },
        });
    }
    async closeActiveLactation(client, cattleId, endReason) {
        await client.lactation.updateMany({
            where: { cattleId, status: client_1.LactationStatus.ACTIVE },
            data: {
                status: client_1.LactationStatus.ENDED,
                endDate: new Date(),
                endReason,
            },
        });
    }
    async restore(farmId, id) {
        await this.getCattleOrThrow(farmId, id);
        const cattle = await this.prisma.cattle.update({
            where: { id },
            data: { deletedAt: null },
            include: this.defaultInclude(),
        });
        this.log.info('Cattle restored', { cattleId: id, farmId });
        return this.composeStatus(cattle);
    }
    async remove(farmId, id, dto = {}, userId) {
        return this.archiveWithReason(farmId, id, dto, userId);
    }
    async highlights(farmId) {
        const now = new Date();
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        const vwpDays = await this.farmSettings.reproVwpDays(farmId);
        const vwpCutoff = new Date(now);
        vwpCutoff.setDate(vwpCutoff.getDate() - vwpDays);
        const activeWhere = (0, herd_scope_1.activeHerd)(farmId);
        const [totalActive, prevActiveCattle, aqrAgg, breedingReady] = await Promise.all([
            this.prisma.cattle.count({ where: activeWhere }),
            this.prisma.cattle.findMany({
                where: { ...activeWhere, createdAt: { lte: monthAgo } },
                select: { id: true, aqrScore: true },
            }),
            this.prisma.cattle.aggregate({
                where: { ...activeWhere, aqrScore: { not: null } },
                _avg: { aqrScore: true },
            }),
            this.prisma.cattle.count({
                where: {
                    ...activeWhere,
                    productionStatus: client_1.ProductionStatus.MILKING,
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
            }),
        ]);
        const prevActive = prevActiveCattle.length;
        const aqrThenByCattle = await (0, aqr_trend_1.computeAqrScoreAsOf)(this.prisma, farmId, prevActiveCattle, monthAgo);
        const aqrThenScores = [...aqrThenByCattle.values()].filter((s) => s !== null);
        const avgHerdAqrThen = aqrThenScores.length
            ? aqrThenScores.reduce((sum, s) => sum + s, 0) / aqrThenScores.length
            : null;
        const { todayL, yesterdayL } = await this.dailyYield(farmId, now);
        return {
            total_active: totalActive,
            total_change_pct: this.pctChange(totalActive, prevActive),
            avg_herd_aqr: this.round(aqrAgg._avg.aqrScore ?? 0),
            aqr_change_pct: avgHerdAqrThen !== null
                ? this.pctChange(aqrAgg._avg.aqrScore ?? 0, avgHerdAqrThen)
                : null,
            breeding_ready_count: breedingReady,
            todays_yield_l: this.round(todayL),
            yield_change_pct: this.pctChange(todayL, yesterdayL),
        };
    }
    async bulk(farmId, dto, userId) {
        const { cattleIds, action, payload } = dto;
        const scope = { id: { in: cattleIds }, farmId };
        switch (action) {
            case 'change_shed': {
                if (!payload?.shedId) {
                    throw new common_1.BadRequestException('shedId is required for change_shed');
                }
                await this.assertShedInFarm(farmId, payload.shedId);
                const { count } = await this.prisma.cattle.updateMany({
                    where: scope,
                    data: { shedId: payload.shedId },
                });
                return this.bulkResult(action, count, cattleIds.length);
            }
            case 'mark_sold': {
                const activeScope = {
                    ...scope,
                    ...(0, herd_scope_1.activeHerd)(farmId),
                };
                const targets = await this.prisma.cattle.findMany({
                    where: activeScope,
                    select: { id: true },
                });
                const targetIds = targets.map((t) => t.id);
                if (targetIds.length === 0) {
                    return this.bulkResult(action, 0, cattleIds.length);
                }
                await this.prisma.$transaction(async (tx) => {
                    for (const cattleId of targetIds) {
                        await this.recordDispositionWithClient(tx, farmId, userId, cattleId, {
                            type: client_1.CattleDispositionType.SALE,
                            date: new Date(),
                        });
                    }
                });
                for (const cattleId of targetIds) {
                    await this.cleanupOnDisposition(farmId, cattleId, userId, client_1.CattleDispositionType.SALE);
                }
                return this.bulkResult(action, targetIds.length, cattleIds.length);
            }
            case 'dispose': {
                if (!payload?.type) {
                    throw new common_1.BadRequestException('type is required for dispose');
                }
                const disposeType = payload.type;
                const activeScope = {
                    ...scope,
                    ...(0, herd_scope_1.activeHerd)(farmId),
                };
                const targets = await this.prisma.cattle.findMany({
                    where: activeScope,
                    select: { id: true },
                });
                const targetIds = targets.map((t) => t.id);
                if (targetIds.length === 0) {
                    return this.bulkResult(action, 0, cattleIds.length);
                }
                await this.prisma.$transaction(async (tx) => {
                    for (const cattleId of targetIds) {
                        await this.recordDispositionWithClient(tx, farmId, userId, cattleId, {
                            type: disposeType,
                            date: payload.date ? new Date(payload.date) : new Date(),
                            reason: payload.reason,
                        });
                    }
                });
                for (const cattleId of targetIds) {
                    await this.cleanupOnDisposition(farmId, cattleId, userId, disposeType);
                }
                return this.bulkResult(action, targetIds.length, cattleIds.length);
            }
            case 'export': {
                const rows = await this.prisma.cattle.findMany({
                    where: scope,
                    orderBy: { tagNumber: 'asc' },
                    include: this.defaultInclude(),
                });
                return {
                    action,
                    updated: 0,
                    failed: cattleIds.length - rows.length,
                    items: rows.map((row) => this.composeStatus(row)),
                };
            }
        }
    }
    async profile(farmId, id) {
        const cattle = await this.getCattleOrThrow(farmId, id, this.defaultInclude());
        const childrenCount = await this.prisma.cattle.count({
            where: { farmId, OR: [{ motherId: id }, { fatherId: id }] },
        });
        const currentPregnancy = await this.prisma.pregnancy.findFirst({
            where: { cattleId: id, status: client_1.PregnancyStatus.ACTIVE },
            orderBy: { conceptionDate: 'desc' },
        });
        return {
            ...this.composeStatus(cattle),
            age: this.calculateAge(cattle.dateOfBirth),
            childrenCount,
            pregnancyStatus: currentPregnancy
                ? currentPregnancy.status
                : 'NOT_RECORDED',
        };
    }
    async ancestry(farmId, id, query) {
        await this.getCattleOrThrow(farmId, id);
        return this.buildAncestry(id, query.depth, new Set());
    }
    async children(farmId, id) {
        await this.getCattleOrThrow(farmId, id);
        return this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                OR: [{ motherId: id }, { fatherId: id }],
            },
            orderBy: { tagNumber: 'asc' },
            select: this.summarySelect(),
        });
    }
    async recordWeight(farmId, userId, id, dto) {
        await this.getCattleOrThrow(farmId, id);
        const record = await this.prisma.weightRecord.create({
            data: {
                cattleId: id,
                weightKg: dto.weightKg,
                recordedDate: new Date(dto.date),
                recordedBy: userId,
                notes: dto.notes,
            },
        });
        await this.prisma.cattle.update({
            where: { id },
            data: { lastWeightKg: dto.weightKg },
        });
        this.log.info('Weight recorded', {
            cattleId: id,
            farmId,
            kg: dto.weightKg,
        });
        return record;
    }
    async weightHistory(farmId, id) {
        await this.getCattleOrThrow(farmId, id);
        return this.prisma.weightRecord.findMany({
            where: { cattleId: id },
            orderBy: { recordedDate: 'desc' },
            take: 50,
        });
    }
    async tabReproduction(farmId, id) {
        await this.getCattleOrThrow(farmId, id);
        const [profile, heats, breedings, calvings] = await Promise.all([
            this.prisma.reproductionProfile.findUnique({ where: { cattleId: id } }),
            this.prisma.heatEvent.findMany({
                where: { cattleId: id },
                orderBy: { heatDateTime: 'desc' },
                take: 20,
            }),
            this.prisma.breedingEvent.findMany({
                where: { cattleId: id },
                orderBy: { breedingDate: 'desc' },
                take: 20,
                include: {
                    pregnancies: { select: { status: true, conceptionDate: true } },
                },
            }),
            this.prisma.calvingEvent.findMany({
                where: { cattleId: id },
                orderBy: { calvingDate: 'desc' },
                take: 20,
                include: {
                    calfBirths: {
                        take: 1,
                        include: {
                            calf: {
                                select: {
                                    id: true,
                                    name: true,
                                    tagNumber: true,
                                    gender: true,
                                    dateOfBirth: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);
        const activeLactation = await this.prisma.lactation.findFirst({
            where: { cattleId: id, status: 'ACTIVE' },
            orderBy: { startDate: 'desc' },
        });
        const vwpDays = await this.farmSettings.reproVwpDays(farmId);
        return {
            total_calvings: profile?.totalCalvings ?? 0,
            avg_calving_interval_days: null,
            conception_rate_pct: profile && profile.totalBreedings > 0
                ? this.round((profile.totalPregnancies / profile.totalBreedings) * 100)
                : null,
            services_per_conception: profile && profile.totalPregnancies > 0
                ? this.round(profile.totalBreedings / profile.totalPregnancies)
                : null,
            current_dim: activeLactation
                ? this.daysBetween(activeLactation.startDate, new Date())
                : null,
            vwp_end_date: activeLactation
                ? new Date(activeLactation.startDate.getTime() + vwpDays * 86400_000)
                    .toISOString()
                    .slice(0, 10)
                : null,
            reproductive_status: profile?.reproductiveStatus ?? null,
            heat_history: heats.map((h) => ({
                id: h.id,
                date: h.heatDateTime.toISOString().slice(0, 10),
                type: h.standingHeat ? 'standing_heat' : 'observed',
                detection_method: h.detectionMethod,
            })),
            ai_history: breedings
                .filter((b) => b.breedingMethod === client_1.BreedingMethod.AI)
                .map((b) => ({
                id: b.id,
                date: b.breedingDate.toISOString().slice(0, 10),
                inseminator: b.inseminator,
                outcome: b.status,
                pregnancy_confirmed_on: b.pregnancies[0]?.conceptionDate?.toISOString().slice(0, 10) ??
                    null,
            })),
            calving_history: calvings.map((c) => {
                const firstCalf = c.calfBirths[0]?.calf ?? null;
                return {
                    id: c.id,
                    date: c.calvingDate.toISOString().slice(0, 10),
                    ease_score: c.calvingEase,
                    calf: firstCalf
                        ? {
                            id: firstCalf.id,
                            tag: firstCalf.tagNumber,
                            name: firstCalf.name,
                            gender: firstCalf.gender,
                            birth_date: firstCalf.dateOfBirth?.toISOString().slice(0, 10) ?? null,
                        }
                        : null,
                };
            }),
        };
    }
    async tabHealth(farmId, id) {
        await this.getCattleOrThrow(farmId, id);
        const [activeCases, closedCases, bcsRecords] = await Promise.all([
            this.prisma.healthCase.findMany({
                where: {
                    cattleId: id,
                    farmId,
                    deletedAt: null,
                    status: { in: OPEN_HEALTH_CASE_STATUSES },
                },
                orderBy: { startDate: 'desc' },
                include: {
                    treatmentLogs: {
                        where: { voidedAt: null },
                        select: { id: true },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            }),
            this.prisma.healthCase.findMany({
                where: {
                    cattleId: id,
                    farmId,
                    deletedAt: null,
                    status: { notIn: OPEN_HEALTH_CASE_STATUSES },
                },
                orderBy: { closedDate: 'desc' },
                take: 10,
            }),
            this.prisma.bodyConditionScore.findMany({
                where: { cattleId: id },
                orderBy: { recordedDate: 'desc' },
                take: 10,
            }),
        ]);
        return {
            active_cases: activeCases.map((c) => ({
                id: c.id,
                diagnosis: c.note,
                priority: c.priority,
                status: c.status,
                opened_at: c.startDate.toISOString().slice(0, 10),
                withholding_active: c.isSafetyWithholdingActive,
                withholding_end_date: c.milkWithdrawalUntil?.toISOString().slice(0, 10) ?? null,
            })),
            treatment_history: closedCases.map((c) => ({
                id: c.id,
                diagnosis: c.note,
                status: c.status,
                opened_at: c.startDate.toISOString().slice(0, 10),
                closed_at: c.closedDate?.toISOString().slice(0, 10) ?? null,
            })),
            vaccination_history: [],
            bcs_trend: bcsRecords.map((b) => ({
                date: b.recordedDate.toISOString().slice(0, 10),
                score: b.score,
                alert: null,
            })),
        };
    }
    async siblings(farmId, id) {
        const cattle = await this.getCattleOrThrow(farmId, id);
        if (!cattle.motherId && !cattle.fatherId) {
            return [];
        }
        return this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                id: { not: id },
                OR: [
                    ...(cattle.motherId ? [{ motherId: cattle.motherId }] : []),
                    ...(cattle.fatherId ? [{ fatherId: cattle.fatherId }] : []),
                ],
            },
            orderBy: { tagNumber: 'asc' },
            select: this.summarySelect(),
        });
    }
    async setProfilePhoto(farmId, userId, id, file) {
        const cattle = await this.getCattleOrThrow(farmId, id);
        const asset = await this.media.uploadImage({
            farmId,
            uploadedByUserId: userId,
            category: client_2.MediaCategory.CATTLE,
            usage: client_2.MediaUsage.PROFILE_PHOTO,
            file,
        });
        const previousId = cattle.profilePhotoAssetId;
        await this.prisma.cattle.update({
            where: { id },
            data: { profilePhotoAssetId: asset.id },
        });
        if (previousId && previousId !== asset.id) {
            await this.media
                .softDeleteById(farmId, previousId, userId)
                .catch(() => undefined);
        }
        this.log.info('Cattle profile photo set', {
            cattleId: id,
            farmId,
            assetId: asset.id,
        });
        return this.media.signUrls(asset, true);
    }
    async removeProfilePhoto(farmId, userId, id) {
        const cattle = await this.getCattleOrThrow(farmId, id);
        if (cattle.profilePhotoAssetId) {
            const previousId = cattle.profilePhotoAssetId;
            await this.prisma.cattle.update({
                where: { id },
                data: { profilePhotoAssetId: null },
            });
            await this.media
                .softDeleteById(farmId, previousId, userId)
                .catch(() => undefined);
        }
        return { removed: true };
    }
    async getProfilePhoto(farmId, id) {
        const cattle = await this.getCattleOrThrow(farmId, id);
        if (!cattle.profilePhotoAssetId) {
            throw new common_1.NotFoundException('No profile photo for this cattle');
        }
        return this.media.presentUrls(farmId, cattle.profilePhotoAssetId, true);
    }
    async attachListPhotos(farmId, items) {
        const ids = items
            .map((i) => i.profilePhotoAssetId)
            .filter((x) => Boolean(x));
        const signed = await this.media.signThumbs(farmId, ids);
        return items.map((i) => ({
            ...i,
            profile_photo: i.profilePhotoAssetId
                ? (signed.get(i.profilePhotoAssetId) ?? null)
                : null,
        }));
    }
    async attachDetailPhoto(item) {
        const photo = item.profilePhotoAssetId
            ? await this.media
                .presentUrls(item.farmId, item.profilePhotoAssetId, true)
                .catch(() => null)
            : null;
        return { ...item, profile_photo: photo };
    }
    composeStatus(row, reproCtx, breedingsSinceLastSuccessOverride) {
        const now = new Date();
        const healthStatus = (0, health_status_1.deriveHealthStatus)(row.healthCases ?? []);
        const activeWithdrawal = (row.safetyWithdrawals ?? [])[0];
        const isQuarantined = !!activeWithdrawal;
        const quarantineUntil = activeWithdrawal
            ? this.laterDate(activeWithdrawal.milkWithdrawalUntil, activeWithdrawal.meatWithdrawalUntil)
            : null;
        const activeLactation = (row.lactations ?? [])[0];
        const dim = activeLactation
            ? this.daysBetween(activeLactation.startDate, now)
            : null;
        const animalCategory = (0, animal_category_1.deriveAnimalCategory)({
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
            now,
            weaningDays: reproCtx?.settings.cattleLifecycleWeaningDays,
        });
        const lifecycleSubStage = (0, lifecycle_bands_1.deriveLifecycleSubStage)({
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
            now,
            boundaries: reproCtx
                ? this.lifecycleBoundaries(reproCtx.settings)
                : undefined,
        });
        const reproductionState = row.reproductionProfile?.reproductiveStatus ?? null;
        let reproductionAlerts = [];
        let lactationStage = null;
        let pregnancyStage = null;
        if (reproCtx && row.gender === client_1.CattleGender.FEMALE && reproductionState) {
            const { settings, reproductiveHoldCattleIds } = reproCtx;
            const recentHeat = (row.heatEvents ?? [])[0] ?? null;
            const lastBreeding = (row.breedingEvents ?? [])[0] ?? null;
            const currentPregnancy = (row.pregnancies ?? [])[0] ?? null;
            const lastCalvingDate = row.reproductionProfile?.lastCalvingDate ?? null;
            const breedingsSinceLastSuccess = breedingsSinceLastSuccessOverride ??
                (row.breedingEvents ?? []).filter((b) => !lastCalvingDate ||
                    b.breedingDate.getTime() > lastCalvingDate.getTime()).length;
            const daysOpen = lastCalvingDate && reproductionState !== client_1.ReproductionState.PREGNANT
                ? this.daysBetween(lastCalvingDate, now)
                : null;
            reproductionAlerts = (0, reproduction_alerts_1.deriveReproductionAlerts)({
                now,
                reproductionState,
                recentHeat: recentHeat
                    ? { heatDateTime: recentHeat.heatDateTime }
                    : null,
                heatWindowDays: settings.reproHeatWindowDays,
                lastBreeding: lastBreeding
                    ? {
                        status: lastBreeding.status,
                        expectedPregnancyCheckDate: lastBreeding.expectedPregnancyCheckDate,
                    }
                    : null,
                currentPregnancy: currentPregnancy
                    ? { expectedCalvingDate: currentPregnancy.expectedCalvingDate }
                    : null,
                closeUpWindowDays: settings.reproCloseUpWindowDays,
                overdueCheckDays: settings.reproOverduePregnancyCheckDays,
                calvingOverdueDays: settings.reproCalvingOverdueDays,
                breedingsSinceLastSuccess,
                repeatBreederThreshold: settings.reproRepeatBreederThreshold,
                daysOpen,
                longDaysOpenThresholdDays: settings.reproLongDaysOpenDays,
                totalAbortions: row.reproductionProfile?.totalAbortions ?? 0,
                hasReproductiveHold: reproductiveHoldCattleIds.has(row.id),
            });
            lactationStage = (0, lactation_stage_1.deriveLactationStage)({
                now,
                lactationStartDate: activeLactation?.startDate ?? null,
                isInActiveDryPeriod: (row.dryPeriods ?? []).length > 0,
                farmSettings: {
                    freshDays: settings.lactationFreshDays,
                    earlyDays: settings.lactationEarlyDays,
                    midDays: settings.lactationMidDays,
                },
            });
            pregnancyStage = (0, pregnancy_stage_1.derivePregnancyStage)({
                now,
                conceptionDate: currentPregnancy?.conceptionDate ?? null,
                farmSettings: {
                    earlyDays: settings.pregnancyEarlyDays,
                    midDays: settings.pregnancyMidDays,
                    closeUpWindowDays: settings.reproCloseUpWindowDays,
                    gestationDays: DEFAULT_GESTATION_DAYS,
                },
            });
        }
        return {
            ...row,
            reproductiveStatus: reproductionState,
            reproductionAlerts,
            lactationStage,
            pregnancyStage,
            healthStatus,
            isQuarantined,
            quarantineUntil,
            dim,
            animalCategory,
            lifecycleSubStage,
        };
    }
    lifecycleBoundaries(settings) {
        return {
            weaningDays: settings.cattleLifecycleWeaningDays,
            growingStartDays: settings.cattleLifecycleGrowingStartDays,
            breedingAgeDays: settings.cattleLifecycleBreedingAgeDays,
        };
    }
    async buildReproductionContext(farmId, cattleIds, presetSettings) {
        if (cattleIds.length === 0) {
            const settings = presetSettings ?? (await this.farmSettings.getEffective(farmId));
            return { settings, reproductiveHoldCattleIds: new Set() };
        }
        const [settings, holds] = await Promise.all([
            presetSettings
                ? Promise.resolve(presetSettings)
                : this.farmSettings.getEffective(farmId),
            this.prisma.animalHold.findMany({
                where: {
                    farmId,
                    cattleId: { in: cattleIds },
                    type: 'REPRODUCTIVE',
                    endedAt: null,
                },
                select: { cattleId: true },
            }),
        ]);
        return {
            settings,
            reproductiveHoldCattleIds: new Set(holds.map((h) => h.cattleId)),
        };
    }
    healthStatusWhere(filter) {
        switch (filter) {
            case 'WITHHOLDING':
            case 'QUARANTINE':
                return {
                    safetyWithdrawals: { some: { status: 'ACTIVE' } },
                };
            case 'SICK':
            case 'IN_TREATMENT':
                return {
                    healthCases: {
                        some: {
                            deletedAt: null,
                            careType: 'CURATIVE',
                            status: { in: OPEN_HEALTH_CASE_STATUSES },
                        },
                    },
                };
            case 'HEALTHY':
                return {
                    healthCases: {
                        none: {
                            deletedAt: null,
                            careType: 'CURATIVE',
                            status: { in: OPEN_HEALTH_CASE_STATUSES },
                        },
                    },
                    safetyWithdrawals: { none: { status: 'ACTIVE' } },
                };
            default:
                return { id: '__none__' };
        }
    }
    async dailyYield(farmId, now) {
        const farm = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { timezone: true },
        });
        const todayStart = (0, farm_time_1.localDayStart)(farm?.timezone ?? farm_time_1.DEFAULT_FARM_TIMEZONE, now);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
        const [today, yesterday] = await Promise.all([
            this.prisma.milkLogEntry.aggregate({
                where: {
                    farmId,
                    submitted: true,
                    logDate: { gte: todayStart, lt: tomorrowStart },
                },
                _sum: { yieldL: true },
            }),
            this.prisma.milkLogEntry.aggregate({
                where: {
                    farmId,
                    submitted: true,
                    logDate: { gte: yesterdayStart, lt: todayStart },
                },
                _sum: { yieldL: true },
            }),
        ]);
        return {
            todayL: today._sum.yieldL ?? 0,
            yesterdayL: yesterday._sum.yieldL ?? 0,
        };
    }
    bulkResult(action, updated, requested) {
        return { action, updated, failed: requested - updated };
    }
    async assertShedInFarm(farmId, shedId) {
        const shed = await this.prisma.shed.findFirst({
            where: { id: shedId, farmId, deletedAt: null },
            select: { id: true },
        });
        if (!shed) {
            throw new common_1.BadRequestException('Shed must belong to the same farm');
        }
    }
    pctChange(current, previous) {
        if (!previous) {
            return current ? 100 : 0;
        }
        return this.round(((current - previous) / previous) * 100);
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
    async validateReferences(farmId, dto) {
        if (dto.breedId) {
            const breed = await this.prisma.breed.findFirst({
                where: { id: dto.breedId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!breed) {
                throw new common_1.BadRequestException('Breed must belong to the same farm');
            }
        }
        if (dto.shedId) {
            await this.assertShedInFarm(farmId, dto.shedId);
        }
        if (dto.animalGroupId) {
            const group = await this.prisma.animalGroup.findFirst({
                where: { id: dto.animalGroupId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!group) {
                throw new common_1.BadRequestException('Animal group must belong to the same farm');
            }
        }
    }
    async validateParentRules(farmId, cattleId, dto) {
        const parentIds = [dto.motherId, dto.fatherId].filter((parentId) => Boolean(parentId));
        if (cattleId && parentIds.includes(cattleId)) {
            throw new common_1.BadRequestException('A cattle cannot be its own parent');
        }
        if (parentIds.length === 0) {
            return;
        }
        const parents = await this.prisma.cattle.findMany({
            where: { id: { in: parentIds }, farmId },
            select: { id: true },
        });
        if (parents.length !== new Set(parentIds).size) {
            throw new common_1.BadRequestException('Mother and father must belong to the same farm');
        }
        if (cattleId) {
            for (const parentId of parentIds) {
                const createsCycle = await this.isDescendant(parentId, cattleId);
                if (createsCycle) {
                    throw new common_1.BadRequestException('Circular ancestry is not allowed');
                }
            }
        }
    }
    async isDescendant(startId, targetId) {
        const queue = [startId];
        const visited = new Set();
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (!currentId || visited.has(currentId))
                continue;
            if (currentId === targetId)
                return true;
            visited.add(currentId);
            const children = await this.prisma.cattle.findMany({
                where: { OR: [{ motherId: currentId }, { fatherId: currentId }] },
                select: { id: true },
            });
            queue.push(...children.map((child) => child.id));
        }
        return false;
    }
    async buildAncestry(id, depth, visited) {
        if (depth < 1 || visited.has(id)) {
            return null;
        }
        visited.add(id);
        const cattle = await this.prisma.cattle.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                tagNumber: true,
                motherId: true,
                fatherId: true,
            },
        });
        if (!cattle) {
            return null;
        }
        return {
            id: cattle.id,
            name: cattle.name,
            tagNumber: cattle.tagNumber,
            mother: cattle.motherId
                ? await this.buildAncestry(cattle.motherId, depth - 1, new Set(visited))
                : null,
            father: cattle.fatherId
                ? await this.buildAncestry(cattle.fatherId, depth - 1, new Set(visited))
                : null,
        };
    }
    async getCattleOrThrow(farmId, id, include) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id, farmId },
            include,
        });
        if (!cattle) {
            this.log.warn('Cattle not found', { cattleId: id, farmId });
            throw new common_1.NotFoundException('Cattle not found');
        }
        return cattle;
    }
    defaultInclude() {
        return {
            breed: true,
            shed: true,
            mother: { select: this.summarySelect() },
            father: { select: this.summarySelect() },
            reproductionProfile: {
                select: {
                    reproductiveStatus: true,
                    totalCalvings: true,
                    totalAbortions: true,
                    lastCalvingDate: true,
                },
            },
            healthCases: {
                where: { status: { in: OPEN_HEALTH_CASE_STATUSES } },
                select: {
                    status: true,
                    careType: true,
                    isSafetyWithholdingActive: true,
                    milkWithdrawalUntil: true,
                },
                take: 5,
            },
            safetyWithdrawals: {
                where: { status: 'ACTIVE' },
                select: { milkWithdrawalUntil: true, meatWithdrawalUntil: true },
                take: 1,
            },
            lactations: {
                where: { status: client_1.LactationStatus.ACTIVE },
                orderBy: { startDate: 'desc' },
                select: { startDate: true },
                take: 1,
            },
            heatEvents: {
                where: { resolvedAt: null },
                orderBy: { heatDateTime: 'desc' },
                select: { heatDateTime: true },
                take: 1,
            },
            breedingEvents: {
                orderBy: { breedingDate: 'desc' },
                select: {
                    status: true,
                    breedingDate: true,
                    expectedPregnancyCheckDate: true,
                },
                take: 20,
            },
            pregnancies: {
                where: { status: client_1.PregnancyStatus.ACTIVE },
                orderBy: { conceptionDate: 'desc' },
                select: { conceptionDate: true, expectedCalvingDate: true },
                take: 1,
            },
            dryPeriods: {
                where: { actualEndDate: null },
                select: { id: true },
                take: 1,
            },
        };
    }
    summarySelect() {
        return {
            id: true,
            name: true,
            tagNumber: true,
        };
    }
    calculateAge(dateOfBirth) {
        if (!dateOfBirth) {
            return null;
        }
        const now = new Date();
        let years = now.getFullYear() - dateOfBirth.getFullYear();
        let months = now.getMonth() - dateOfBirth.getMonth();
        const days = now.getDate() - dateOfBirth.getDate();
        if (days < 0) {
            months -= 1;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        return { years, months };
    }
    daysBetween(start, end) {
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    laterDate(a, b) {
        if (!a)
            return b;
        if (!b)
            return a;
        return a.getTime() >= b.getTime() ? a : b;
    }
    addDays(date, days) {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    }
    async nextHealthCaseCode(tx, farmId) {
        const rows = await tx.healthCase.findMany({
            where: { farmId, caseCode: { startsWith: 'HC-' } },
            select: { caseCode: true },
        });
        const n = rows.reduce((max, row) => {
            const match = /^HC-(\d+)$/.exec(row.caseCode);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `HC-${String(n + 1).padStart(5, '0')}`;
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.CattleService = CattleService;
exports.CattleService = CattleService = CattleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aqr_service_1.AqrService,
        subscription_access_service_1.SubscriptionAccessService,
        media_service_1.MediaService,
        farm_settings_service_1.FarmSettingsService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        reproduction_service_1.ReproductionService,
        task_service_1.TaskService,
        animal_hold_service_1.AnimalHoldService,
        logger_service_1.LoggerService,
        animal_upcoming_events_service_1.AnimalUpcomingEventsService,
        eligibility_service_1.EligibilityService,
        animal_event_write_service_1.AnimalEventWriteService])
], CattleService);
//# sourceMappingURL=cattle.service.js.map