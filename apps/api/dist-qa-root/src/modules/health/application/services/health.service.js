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
var HealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const farm_time_1 = require("src/common/farm-time/farm-time");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const health_farm_day_1 = require("../../domain/health-farm-day");
const protocol_time_1 = require("../../domain/protocol-time");
const protocol_stock_service_1 = require("./protocol-stock.service");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const medicine_service_1 = require("src/modules/inventory/application/services/medicine.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const health_outcomes_service_1 = require("./health-outcomes.service");
const health_step_notification_producer_1 = require("../resolvers/health-step-notification.producer");
const cattle_service_1 = require("src/modules/cattle/application/services/cattle.service");
const expense_service_1 = require("src/modules/purchasing/application/expense.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const ACTIVE_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
function careTypeForPlanCategory(category) {
    return category === client_1.HealthPlanCategory.TREATMENT
        ? client_1.HealthCareType.CURATIVE
        : client_1.HealthCareType.PREVENTIVE;
}
const event_api_context_1 = require("src/modules/animal-events/application/event-api-context");
let HealthService = HealthService_1 = class HealthService {
    prisma;
    aqrService;
    activityLog;
    medicineService;
    taskService;
    notificationService;
    cattleService;
    expenseService;
    logger;
    outcomes;
    protocolStock;
    farmClock;
    stepNotices;
    log;
    constructor(prisma, aqrService, activityLog, medicineService, taskService, notificationService, cattleService, expenseService, logger, outcomes, protocolStock, farmClock, stepNotices) {
        this.prisma = prisma;
        this.aqrService = aqrService;
        this.activityLog = activityLog;
        this.medicineService = medicineService;
        this.taskService = taskService;
        this.notificationService = notificationService;
        this.cattleService = cattleService;
        this.expenseService = expenseService;
        this.logger = logger;
        this.outcomes = outcomes;
        this.protocolStock = protocolStock;
        this.farmClock = farmClock;
        this.stepNotices = stepNotices;
        this.log = this.logger.setContext(HealthService_1.name);
    }
    async stampMovements(tx, movementIds, treatmentLogId) {
        if (!movementIds || movementIds.length === 0)
            return;
        await tx.medicineStockMovement.updateMany({
            where: { id: { in: movementIds } },
            data: { treatmentLogId },
        });
    }
    async dueResolver(farmId) {
        const tz = (await this.farmClock?.timezone(farmId)) ?? 'UTC';
        return (base, step) => (0, protocol_time_1.applyTimeOfDay)(base, step.timeOfDay, tz);
    }
    async getHealthDashboard(farmId) {
        const now = new Date();
        const [totalAnimalCount, sickBayCount, safetyWithdrawalCount, upcomingTasksCount, overdueTasksCount, diseaseRows, shedRows, trendRows, medicineExpense,] = await Promise.all([
            this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(farmId),
            }),
            this.prisma.healthCase.count({
                where: {
                    farmId,
                    status: { in: ACTIVE_CASE_STATUSES },
                    deletedAt: null,
                },
            }),
            this.prisma.safetyWithdrawal.count({
                where: { farmId, status: client_1.SafetyWithdrawalStatus.ACTIVE },
            }),
            this.prisma.healthTask.count({
                where: {
                    farmId,
                    deletedAt: null,
                    status: client_1.HealthTaskStatus.PENDING,
                    dueDateTime: { gte: now },
                },
            }),
            this.prisma.healthTask.count({
                where: {
                    farmId,
                    deletedAt: null,
                    status: { in: [client_1.HealthTaskStatus.PENDING, client_1.HealthTaskStatus.OVERDUE] },
                    dueDateTime: { lt: now },
                },
            }),
            this.prisma.healthCase.groupBy({
                by: ['condition'],
                where: {
                    farmId,
                    deletedAt: null,
                    condition: { not: null },
                },
                _count: { condition: true },
            }),
            this.prisma.healthCase.groupBy({
                by: ['shedName'],
                where: {
                    farmId,
                    deletedAt: null,
                },
                _count: { shedName: true },
            }),
            this.prisma.healthCase.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                },
                select: { startDate: true },
                orderBy: { startDate: 'asc' },
            }),
            this.sumHealthExpense(farmId),
        ]);
        const healthyAnimalCount = Math.max(totalAnimalCount - sickBayCount, 0);
        return {
            herdHealthScore: this.calculateHerdHealthScore(healthyAnimalCount, totalAnimalCount),
            healthyAnimalCount,
            totalAnimalCount,
            sickBayCount,
            medicineExpense,
            safetyWithdrawalCount,
            morbidityTrend: this.groupByDay(trendRows.map((row) => row.startDate)),
            diseaseBreakdown: diseaseRows.map((row) => ({
                diagnosis: this.describeCondition(row.condition),
                count: row._count.condition,
            })),
            shedWiseHealth: shedRows.map((row) => ({
                shedName: row.shedName ?? 'Unassigned',
                count: row._count.shedName,
            })),
            upcomingTasksCount,
            overdueTasksCount,
        };
    }
    async getSickBay(farmId, query) {
        const andClauses = [];
        if (query.search) {
            andClauses.push({
                OR: [
                    { note: { contains: query.search, mode: 'insensitive' } },
                    { caseCode: { contains: query.search, mode: 'insensitive' } },
                    {
                        cattle: {
                            tagNumber: { contains: query.search, mode: 'insensitive' },
                        },
                    },
                    {
                        cattle: {
                            name: { contains: query.search, mode: 'insensitive' },
                        },
                    },
                ],
            });
        }
        if (query.diagnosis) {
            const matchingConditions = this.matchConditionLabels(query.diagnosis);
            andClauses.push({
                OR: [
                    { note: { contains: query.diagnosis, mode: 'insensitive' } },
                    ...(matchingConditions.length
                        ? [{ condition: { in: matchingConditions } }]
                        : []),
                ],
            });
        }
        const where = {
            farmId,
            deletedAt: null,
            status: query.status ?? { in: ACTIVE_CASE_STATUSES },
            ...(query.shed
                ? { shedName: { contains: query.shed, mode: 'insensitive' } }
                : {}),
            ...(query.priority ? { priority: query.priority } : {}),
            ...(query.cattleId ? { cattleId: query.cattleId } : {}),
            ...(andClauses.length ? { AND: andClauses } : {}),
        };
        const rows = await this.prisma.healthCase.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                cattle: {
                    select: { id: true, name: true, tagNumber: true, image: true },
                },
                healthPlan: { select: { id: true, name: true } },
                tasks: {
                    where: { status: client_1.HealthTaskStatus.PENDING },
                    orderBy: { dueDateTime: 'asc' },
                    take: 1,
                },
                safetyWithdrawals: {
                    where: {
                        status: {
                            in: [
                                client_1.SafetyWithdrawalStatus.ACTIVE,
                                client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE,
                            ],
                        },
                    },
                    select: { milkWithdrawalUntil: true, meatWithdrawalUntil: true },
                },
            },
        });
        const projected = rows.map(({ safetyWithdrawals, ...row }) => {
            const days = safetyWithdrawals
                .flatMap((w) => [
                this.daysRemaining(w.milkWithdrawalUntil),
                this.daysRemaining(w.meatWithdrawalUntil),
            ])
                .filter((d) => d !== null);
            return {
                ...row,
                withdrawalDaysLeft: days.length ? Math.max(...days) : null,
            };
        });
        return (0, pagination_1.toCursorPage)(projected, query);
    }
    async getTreatmentLogs(farmId, query) {
        const andClauses = [];
        if (query.search) {
            andClauses.push({
                OR: [
                    { medicineName: { contains: query.search, mode: 'insensitive' } },
                    { notes: { contains: query.search, mode: 'insensitive' } },
                    {
                        cattle: {
                            tagNumber: { contains: query.search, mode: 'insensitive' },
                        },
                    },
                    {
                        cattle: {
                            name: { contains: query.search, mode: 'insensitive' },
                        },
                    },
                ],
            });
        }
        if (query.fromDate || query.toDate) {
            andClauses.push({
                administeredAt: {
                    ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
                    ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
                },
            });
        }
        if (query.careType) {
            andClauses.push({
                healthCase: {
                    careType: query.careType,
                },
            });
        }
        if (query.route) {
            andClauses.push({
                route: query.route,
            });
        }
        const where = {
            farmId,
            voidedAt: null,
            ...(query.cattleId ? { cattleId: query.cattleId } : {}),
            ...(andClauses.length ? { AND: andClauses } : {}),
        };
        const rows = await this.prisma.treatmentLog.findMany({
            where,
            orderBy: [
                { administeredAt: query.sortOrder ?? 'desc' },
                { id: query.sortOrder ?? 'desc' },
            ],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                cattle: {
                    select: { id: true, name: true, tagNumber: true, image: true },
                },
                healthCase: {
                    select: {
                        id: true,
                        caseCode: true,
                        careType: true,
                        condition: true,
                        note: true,
                    },
                },
            },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async createHealthCase(farmId, userId, dto) {
        const cattle = await this.assertCattleInFarm(farmId, dto.cattleId);
        if (dto.shedId)
            await this.assertShedInFarm(farmId, dto.shedId);
        if (dto.condition || dto.note) {
            const duplicate = await this.prisma.healthCase.findFirst({
                where: {
                    farmId,
                    cattleId: dto.cattleId,
                    status: { in: ACTIVE_CASE_STATUSES },
                    ...(dto.condition
                        ? { condition: dto.condition }
                        : { note: { equals: dto.note, mode: 'insensitive' } }),
                },
            });
            if (duplicate && !(0, event_api_context_1.eventApiContext)()) {
                throw new common_1.ConflictException('Active health case already exists for this diagnosis');
            }
        }
        const healthCase = await this.createCaseWithCode(farmId, (caseCode) => ({
            data: {
                farmId,
                cattleId: dto.cattleId,
                caseCode,
                note: dto.note,
                condition: dto.condition,
                careType: dto.careType,
                priority: dto.priority,
                shedId: dto.shedId ?? cattle.shedId,
                shedName: dto.shedName,
                reportedBy: dto.reportedBy ?? userId,
                assignedVet: dto.assignedVet,
                startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
                expectedRecoveryDate: dto.expectedRecoveryDate
                    ? new Date(dto.expectedRecoveryDate)
                    : undefined,
                symptoms: dto.symptoms ?? [],
                notes: dto.notes,
                photoUrl: dto.photoUrl,
            },
            include: this.caseInclude(),
        }));
        if (dto.temperature !== undefined ||
            dto.appetite !== undefined ||
            dto.staffObservation) {
            await this.prisma.healthUpdate.create({
                data: {
                    farmId,
                    cattleId: dto.cattleId,
                    healthCaseId: healthCase.id,
                    clinicalProgress: client_1.ClinicalProgress.STABLE,
                    symptoms: dto.symptoms ?? [],
                    temperature: dto.temperature,
                    appetite: dto.appetite,
                    observation: dto.staffObservation,
                    recordedBy: userId,
                    recordedAt: new Date(),
                },
            });
        }
        const description = this.caseDescription(dto);
        if (dto.careType === client_1.HealthCareType.CURATIVE) {
            await this.aqrService.applyEvent(farmId, dto.cattleId, 'sickness_reported', {
                actorId: userId,
                actionDetails: `Sickness reported for [${cattle.tagNumber}] — ${description}.`,
            });
            await this.taskService.createInternal({
                farmId,
                createdBy: userId,
                name: `Review reported sickness — ${cattle.tagNumber}`,
                details: `Sickness reported for [${cattle.name ?? cattle.tagNumber}] (${cattle.tagNumber}) — ${description}. Priority: ${dto.priority}.`,
                category: client_1.TaskCategory.HEALTHCARE,
                priority: this.toTaskPriority(dto.priority),
                dueAt: new Date(),
                source: client_1.TaskSource.SYSTEM_AUTO,
                relatedCattleId: dto.cattleId,
            });
            await this.notificationService.notifyOwnersAndManagers({
                farmId,
                eventKey: 'animal_sickness_reported',
                title: 'Animal Sickness Reported',
                message: `${cattle.name ?? cattle.tagNumber} (${cattle.tagNumber}) — ${description} reported (priority: ${dto.priority}).`,
                params: {
                    name: cattle.name ?? cattle.tagNumber,
                    tagNumber: cattle.tagNumber,
                    diagnosis: description,
                    priority: dto.priority,
                },
                link: `/healthcare/cases/${healthCase.id}`,
            });
        }
        else {
            await this.aqrService.applyEvent(farmId, dto.cattleId, 'preventive_care_logged', {
                actorId: userId,
                actionDetails: `Preventive care logged for [${cattle.tagNumber}] — ${description}.`,
            });
        }
        this.log.info('Health case created', {
            healthCaseId: healthCase.id,
            farmId,
            cattleId: dto.cattleId,
        });
        return healthCase;
    }
    async createHealthCasesBulk(farmId, userId, dto) {
        if (!dto.condition && !dto.note?.trim()) {
            throw new common_1.BadRequestException('Give a condition or a note, so the cases can be told apart from duplicates');
        }
        const cattleIds = [...new Set(dto.cattleIds)];
        const careType = dto.careType ?? client_1.HealthCareType.CURATIVE;
        const cattleRows = await this.prisma.cattle.findMany({
            where: { id: { in: cattleIds }, farmId, deletedAt: null },
            select: { id: true, tagNumber: true, name: true, shedId: true },
        });
        const byId = new Map(cattleRows.map((c) => [c.id, c]));
        const missing = cattleIds.filter((id) => !byId.has(id));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Cattle not found in this farm: ${missing.join(', ')}`);
        }
        const open = await this.prisma.healthCase.findMany({
            where: {
                farmId,
                cattleId: { in: cattleIds },
                status: { in: ACTIVE_CASE_STATUSES },
                ...(dto.condition
                    ? { condition: dto.condition }
                    : { note: { equals: dto.note, mode: 'insensitive' } }),
            },
            select: { cattleId: true },
        });
        const alreadyOpen = new Set(open.map((c) => c.cattleId));
        const toCreate = cattleIds.filter((id) => !alreadyOpen.has(id));
        const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
        const created = new Map();
        if (toCreate.length > 0) {
            await this.prisma.$transaction(async (tx) => {
                for (const cattleId of toCreate) {
                    const caseCode = await this.nextCaseCode(farmId, tx);
                    const healthCase = await tx.healthCase.create({
                        data: {
                            farmId,
                            cattleId,
                            caseCode,
                            note: dto.note,
                            condition: dto.condition,
                            careType,
                            priority: dto.priority,
                            shedId: byId.get(cattleId).shedId,
                            reportedBy: userId,
                            assignedVet: dto.assignedVet,
                            startDate,
                            expectedRecoveryDate: dto.expectedRecoveryDate
                                ? new Date(dto.expectedRecoveryDate)
                                : undefined,
                            symptoms: dto.symptoms ?? [],
                            notes: dto.notes,
                        },
                        select: { id: true, caseCode: true },
                    });
                    created.set(cattleId, {
                        healthCaseId: healthCase.id,
                        caseCode: healthCase.caseCode,
                    });
                }
            });
        }
        if (toCreate.length > 0) {
            const description = this.caseDescription(dto);
            const curative = careType === client_1.HealthCareType.CURATIVE;
            for (const cattleId of toCreate) {
                const tag = byId.get(cattleId).tagNumber;
                await this.aqrService.applyEvent(farmId, cattleId, curative ? 'sickness_reported' : 'preventive_care_logged', {
                    actorId: userId,
                    actionDetails: curative
                        ? `Sickness reported for [${tag}] — ${description} (group report of ${toCreate.length}).`
                        : `Preventive care logged for [${tag}] — ${description} (group report of ${toCreate.length}).`,
                });
            }
            if (curative) {
                const tags = toCreate.map((id) => byId.get(id).tagNumber);
                const shown = tags.slice(0, 5).join(', ');
                const summary = `${toCreate.length} animal${toCreate.length === 1 ? '' : 's'}`;
                await this.taskService.createInternal({
                    farmId,
                    createdBy: userId,
                    name: `Review reported sickness — ${summary}`,
                    details: `Sickness reported for ${summary} (${shown}${tags.length > 5 ? ', …' : ''}) — ${description}. Priority: ${dto.priority}.`,
                    category: client_1.TaskCategory.HEALTHCARE,
                    priority: this.toTaskPriority(dto.priority),
                    dueAt: new Date(),
                    source: client_1.TaskSource.SYSTEM_AUTO,
                });
                await this.notificationService.notifyOwnersAndManagers({
                    farmId,
                    eventKey: 'animal_sickness_reported',
                    title: 'Animal Sickness Reported',
                    message: `${summary} (${shown}${tags.length > 5 ? ', …' : ''}) — ${description} reported (priority: ${dto.priority}).`,
                    params: {
                        name: summary,
                        tagNumber: shown,
                        diagnosis: description,
                        priority: dto.priority,
                    },
                    link: '/healthcare',
                });
            }
        }
        this.log.info('Health cases bulk-reported', {
            farmId,
            requested: cattleIds.length,
            createdCount: created.size,
            skippedCount: alreadyOpen.size,
        });
        return {
            createdCount: created.size,
            skippedCount: alreadyOpen.size,
            results: cattleIds.map((cattleId) => {
                const made = created.get(cattleId);
                return made
                    ? { cattleId, status: 'created', ...made }
                    : {
                        cattleId,
                        status: 'skipped',
                        reason: 'Animal already has an open case for this condition',
                    };
            }),
        };
    }
    toTaskPriority(priority) {
        switch (priority) {
            case client_1.HealthPriority.CRITICAL:
            case client_1.HealthPriority.HIGH:
                return client_1.TaskPriority.HIGH;
            case client_1.HealthPriority.MEDIUM:
                return client_1.TaskPriority.MEDIUM;
            case client_1.HealthPriority.LOW:
                return client_1.TaskPriority.LOW;
        }
    }
    describeCondition(condition) {
        return condition
            .toLowerCase()
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    matchConditionLabels(search) {
        const needle = search.trim().toLowerCase();
        if (!needle)
            return [];
        return Object.values(client_1.HealthCondition).filter((condition) => this.describeCondition(condition).toLowerCase().includes(needle));
    }
    caseDescription(dto) {
        if (dto.note?.trim())
            return dto.note.trim();
        if (dto.condition)
            return this.describeCondition(dto.condition);
        return 'health issue';
    }
    async createCaseWithCode(farmId, build) {
        for (let attempt = 0;; attempt += 1) {
            const caseCode = await this.nextCaseCode(farmId);
            try {
                return (await this.prisma.healthCase.create(build(caseCode)));
            }
            catch (error) {
                const isUnique = error.code === 'P2002';
                if (isUnique && attempt < 4)
                    continue;
                throw error;
            }
        }
    }
    async nextCaseCode(farmId, client = this.prisma) {
        const rows = await client.healthCase.findMany({
            where: { farmId, caseCode: { startsWith: 'HC-' } },
            select: { caseCode: true },
        });
        const n = rows.reduce((max, row) => {
            const match = /^HC-(\d+)$/.exec(row.caseCode);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `HC-${String(n + 1).padStart(5, '0')}`;
    }
    async getHealthCase(farmId, id) {
        const healthCase = await this.prisma.healthCase.findFirst({
            where: { id, farmId },
            include: {
                ...this.caseInclude(),
                treatmentLogs: {
                    where: { voidedAt: null },
                    orderBy: { administeredAt: 'desc' },
                },
                healthUpdates: { orderBy: { recordedAt: 'desc' } },
                tasks: { orderBy: { dueDateTime: 'asc' } },
                mortalityRecord: true,
                safetyWithdrawals: { where: { status: client_1.SafetyWithdrawalStatus.ACTIVE } },
            },
        });
        if (!healthCase)
            throw new common_1.NotFoundException('Health case not found');
        return {
            ...healthCase,
            summary: await this.outcomes.caseSummary(farmId, healthCase),
            nextDose: healthCase.tasks.find((task) => task.status === client_1.HealthTaskStatus.PENDING) ?? null,
            lastDose: healthCase.treatmentLogs[0] ?? null,
            activeSafetyWithdrawal: healthCase.safetyWithdrawals[0] ?? null,
        };
    }
    async updateHealthCase(farmId, id, dto) {
        await this.getCaseOrThrow(farmId, id);
        const updated = await this.prisma.healthCase.update({
            where: { id },
            data: {
                note: dto.note,
                condition: dto.condition,
                careType: dto.careType,
                priority: dto.priority,
                status: dto.status,
                assignedVet: dto.assignedVet,
                expectedRecoveryDate: dto.expectedRecoveryDate
                    ? new Date(dto.expectedRecoveryDate)
                    : undefined,
                symptoms: dto.symptoms,
                notes: dto.notes,
            },
            include: this.caseInclude(),
        });
        this.log.info('Health case updated', { healthCaseId: id, farmId });
        return updated;
    }
    async applyHealthPlanToCase(farmId, id, dto) {
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id: dto.healthPlanId, farmId, deletedAt: null },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Health plan not found');
        const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
        await this.protocolStock?.assertInStock(farmId, plan.steps, 1);
        const dueOf = await this.dueResolver(farmId);
        let pendingNotices = null;
        const result = await this.prisma.$transaction(async (tx) => {
            const staleKeys = (await this.stepNotices?.keysOfCase(tx, farmId, id)) ?? [];
            await tx.healthTask.deleteMany({
                where: { healthCaseId: id, status: client_1.HealthTaskStatus.PENDING },
            });
            const tasks = await Promise.all(plan.steps.map((step, index) => {
                const dueDateTime = dueOf(this.addDays(startDate, Math.max(0, step.dayNumber - 1)), step);
                return tx.healthTask.create({
                    data: {
                        farmId: healthCase.farmId,
                        cattleId: healthCase.cattleId,
                        healthCaseId: id,
                        healthPlanId: plan.id,
                        taskCode: `${healthCase.caseCode}-T${String(index + 1).padStart(2, '0')}`,
                        taskDate: dueDateTime,
                        dueDateTime,
                        taskType: step.actionType,
                        title: step.title,
                        instruction: step.instruction,
                        stepNumber: index + 1,
                        totalSteps: plan.steps.length,
                        medicineId: step.medicineId,
                        medicineName: step.medicineName,
                        doseAmount: step.doseAmount,
                        doseUnit: step.doseUnit,
                        doseUnitId: step.doseUnitId,
                        timeOfDay: step.timeOfDay,
                        route: step.route,
                    },
                });
            }));
            const updatedCase = await tx.healthCase.update({
                where: { id },
                data: {
                    healthPlanId: plan.id,
                    totalSteps: plan.steps.length,
                    currentStep: 0,
                    progressPercentage: 0,
                },
                include: this.caseInclude(),
            });
            pendingNotices =
                (await this.stepNotices?.syncCases(tx, farmId, [id], staleKeys)) ??
                    null;
            return { healthCase: updatedCase, tasks };
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        this.log.info('Health plan applied to case', {
            healthCaseId: id,
            healthPlanId: plan.id,
        });
        return result;
    }
    async applyPlanToAnimals(farmId, userId, id, dto) {
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id, farmId, deletedAt: null },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Health plan not found');
        if (plan.steps.length === 0) {
            throw new common_1.BadRequestException('Health plan has no steps to apply');
        }
        const cattleIds = dto.cattleIds;
        if (cattleIds.length === 0) {
            throw new common_1.BadRequestException('cattleIds must not be empty');
        }
        const cattleRows = await this.prisma.cattle.findMany({
            where: { id: { in: cattleIds }, farmId, deletedAt: null },
            select: { id: true, tagNumber: true, shedId: true },
        });
        const foundIds = new Set(cattleRows.map((c) => c.id));
        const missing = cattleIds.filter((cattleId) => !foundIds.has(cattleId));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Cattle not found in this farm: ${missing.join(', ')}`);
        }
        const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
        const careType = careTypeForPlanCategory(plan.category);
        return careType === client_1.HealthCareType.CURATIVE
            ? this.applyCurativePlanToAnimals(farmId, plan, cattleRows, startDate)
            : this.applyPreventivePlanToAnimals(farmId, userId, plan, cattleRows, startDate);
    }
    async addAnimalsToRound(farmId, userId, input) {
        const { plan, cattleIds, startDate, applicationId } = input;
        if (plan.steps.length === 0) {
            throw new common_1.BadRequestException('Health plan has no steps to apply');
        }
        const uniqueIds = [...new Set(cattleIds)];
        const cattleRows = await this.prisma.cattle.findMany({
            where: { id: { in: uniqueIds }, farmId, deletedAt: null },
            select: { id: true, tagNumber: true, shedId: true },
        });
        const found = new Set(cattleRows.map((c) => c.id));
        const missing = uniqueIds.filter((id) => !found.has(id));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Cattle not found in this farm: ${missing.join(', ')}`);
        }
        const minDue = new Date();
        return applicationId
            ? this.applyPreventivePlanToAnimals(farmId, userId, plan, cattleRows, startDate, { applicationId, minDue })
            : this.applyCurativePlanToAnimals(farmId, plan, cattleRows, startDate, {
                minDue,
                createdAt: startDate,
            });
    }
    async applyCurativePlanToAnimals(farmId, plan, cattleRows, startDate, join) {
        const existing = await this.prisma.healthCase.findMany({
            where: {
                farmId,
                cattleId: { in: cattleRows.map((c) => c.id) },
                healthPlanId: plan.id,
                status: { in: ACTIVE_CASE_STATUSES },
            },
            select: { cattleId: true },
        });
        const alreadyOnPlan = new Set(existing.map((c) => c.cattleId));
        const toApply = cattleRows.filter((c) => !alreadyOnPlan.has(c.id));
        const skipped = cattleRows
            .filter((c) => alreadyOnPlan.has(c.id))
            .map((c) => ({
            cattleId: c.id,
            status: 'skipped',
            reason: 'Animal already has an active case for this protocol',
        }));
        const applied = [];
        if (toApply.length > 0) {
            await this.protocolStock?.assertInStock(farmId, plan.steps, toApply.length);
            const dueOf = await this.dueResolver(farmId);
            let pendingNotices = null;
            await this.prisma.$transaction(async (tx) => {
                for (const cattle of toApply) {
                    const caseCode = await this.nextCaseCode(farmId, tx);
                    const healthCase = await tx.healthCase.create({
                        data: {
                            farmId,
                            cattleId: cattle.id,
                            caseCode,
                            note: plan.diagnosis ?? plan.name,
                            careType: client_1.HealthCareType.CURATIVE,
                            priority: client_1.HealthPriority.LOW,
                            shedId: cattle.shedId,
                            startDate,
                            healthPlanId: plan.id,
                            totalSteps: plan.steps.length,
                            currentStep: 0,
                            progressPercentage: 0,
                        },
                    });
                    await Promise.all(plan.steps.map((step, index) => {
                        const dueDateTime = this.dueNoEarlierThan(dueOf(this.addDays(startDate, Math.max(0, step.dayNumber - 1)), step), join?.minDue);
                        return tx.healthTask.create({
                            data: {
                                ...(join ? { createdAt: join.createdAt } : {}),
                                farmId,
                                cattleId: cattle.id,
                                healthCaseId: healthCase.id,
                                healthPlanId: plan.id,
                                taskCode: `${caseCode}-T${String(index + 1).padStart(2, '0')}`,
                                taskDate: dueDateTime,
                                dueDateTime,
                                taskType: step.actionType,
                                title: step.title,
                                instruction: step.instruction,
                                stepNumber: index + 1,
                                totalSteps: plan.steps.length,
                                medicineId: step.medicineId,
                                medicineName: step.medicineName,
                                doseAmount: step.doseAmount,
                                doseUnit: step.doseUnit,
                                doseUnitId: step.doseUnitId,
                                timeOfDay: step.timeOfDay,
                                route: step.route,
                            },
                        });
                    }));
                    applied.push({
                        cattleId: cattle.id,
                        healthCaseId: healthCase.id,
                        status: 'applied',
                    });
                }
                pendingNotices =
                    (await this.stepNotices?.syncCases(tx, farmId, applied.map((a) => a.healthCaseId))) ?? null;
            });
            await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        }
        this.log.info('Health plan bulk-applied', {
            farmId,
            healthPlanId: plan.id,
            appliedCount: applied.length,
            skippedCount: skipped.length,
        });
        return {
            healthPlanId: plan.id,
            appliedCount: applied.length,
            skippedCount: skipped.length,
            results: [...applied, ...skipped],
        };
    }
    async applyPreventivePlanToAnimals(farmId, userId, plan, cattleRows, startDate, join, cycle) {
        const existing = await this.prisma.planEnrollment.findMany({
            where: {
                farmId,
                cattleId: { in: cattleRows.map((c) => c.id) },
                healthPlanId: plan.id,
                status: client_1.PlanEnrollmentStatus.ACTIVE,
                deletedAt: null,
            },
            select: { cattleId: true },
        });
        const alreadyEnrolled = new Set(existing.map((e) => e.cattleId));
        const toApply = cattleRows.filter((c) => !alreadyEnrolled.has(c.id));
        const skipped = cattleRows
            .filter((c) => alreadyEnrolled.has(c.id))
            .map((c) => ({
            cattleId: c.id,
            status: 'skipped',
            reason: 'Animal already has an active enrollment for this protocol',
        }));
        const applied = [];
        let planApplicationId = null;
        if (toApply.length > 0) {
            await this.protocolStock?.assertInStock(farmId, plan.steps, toApply.length);
            const dueOf = await this.dueResolver(farmId);
            let pendingNotices = null;
            planApplicationId = await this.prisma.$transaction(async (tx) => {
                const application = join
                    ? await tx.planApplication.update({
                        where: { id: join.applicationId },
                        data: { animalCount: { increment: toApply.length } },
                    })
                    : await tx.planApplication.create({
                        data: {
                            farmId,
                            healthPlanId: plan.id,
                            startDate,
                            appliedBy: userId,
                            animalCount: toApply.length,
                        },
                    });
                for (const cattle of toApply) {
                    const enrollment = await tx.planEnrollment.create({
                        data: {
                            farmId,
                            cattleId: cattle.id,
                            healthPlanId: plan.id,
                            planApplicationId: application.id,
                            startDate,
                            totalSteps: plan.steps.length,
                            currentStep: 0,
                            progressPercentage: 0,
                            ...(cycle ?? {}),
                        },
                    });
                    await Promise.all(plan.steps.map((step, index) => {
                        const dueDateTime = this.dueNoEarlierThan(dueOf(this.addDays(startDate, Math.max(0, step.dayNumber - 1)), step), join?.minDue);
                        return tx.healthTask.create({
                            data: {
                                farmId,
                                cattleId: cattle.id,
                                planEnrollmentId: enrollment.id,
                                healthPlanId: plan.id,
                                taskCode: `${application.id}-${cattle.id}-T${String(index + 1).padStart(2, '0')}`,
                                taskDate: dueDateTime,
                                dueDateTime,
                                taskType: step.actionType,
                                title: step.title,
                                instruction: step.instruction,
                                stepNumber: index + 1,
                                totalSteps: plan.steps.length,
                                medicineId: step.medicineId,
                                medicineName: step.medicineName,
                                doseAmount: step.doseAmount,
                                doseUnit: step.doseUnit,
                                doseUnitId: step.doseUnitId,
                                timeOfDay: step.timeOfDay,
                                route: step.route,
                            },
                        });
                    }));
                    applied.push({
                        cattleId: cattle.id,
                        planEnrollmentId: enrollment.id,
                        status: 'applied',
                    });
                }
                pendingNotices =
                    (await this.stepNotices?.syncRound(tx, farmId, application.id)) ??
                        null;
                return application.id;
            });
            await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        }
        this.log.info('Preventive plan bulk-applied', {
            farmId,
            healthPlanId: plan.id,
            planApplicationId,
            appliedCount: applied.length,
            skippedCount: skipped.length,
        });
        return {
            healthPlanId: plan.id,
            planApplicationId,
            appliedCount: applied.length,
            skippedCount: skipped.length,
            results: [...applied, ...skipped],
        };
    }
    async voidTreatmentLog(farmId, userId, logId, reason, opts = {}) {
        const log = await this.prisma.treatmentLog.findFirst({
            where: { id: logId, farmId },
        });
        if (!log)
            throw new common_1.NotFoundException('Treatment not found');
        if (log.voidedAt) {
            throw new common_1.BadRequestException('This treatment was already voided');
        }
        const note = reason ? `Voided: ${reason}` : 'Voided';
        await this.medicineService.restoreForTreatmentVoid(farmId, userId, {
            treatmentLogId: log.id,
            fallbackMedicineId: log.stockDeducted ? log.medicineId : null,
            fallbackQuantity: log.stockDeducted
                ? Number(log.stockDeductionQuantity ?? 0)
                : null,
            notes: `${note} (treatment ${log.id})`,
        });
        if (log.financeTransactionId) {
            await this.expenseService.voidInventoryConsumption(farmId, log.financeTransactionId, userId);
        }
        if (log.vetExpenseId) {
            await this.expenseService.voidInventoryConsumption(farmId, log.vetExpenseId, userId);
        }
        const taskId = log.healthTaskId;
        await this.prisma.$transaction(async (tx) => {
            await tx.safetyWithdrawal.updateMany({
                where: {
                    farmId,
                    treatmentLogId: log.id,
                    status: {
                        in: [
                            client_1.SafetyWithdrawalStatus.ACTIVE,
                            client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE,
                        ],
                    },
                },
                data: { status: client_1.SafetyWithdrawalStatus.CANCELLED },
            });
            await tx.treatmentLog.update({
                where: { id: log.id },
                data: { voidedAt: new Date(), voidedBy: userId, voidReason: reason },
            });
            if (taskId && opts.resetTask !== false) {
                await tx.healthTask.update({
                    where: { id: taskId },
                    data: {
                        status: client_1.HealthTaskStatus.PENDING,
                        completedAt: null,
                        completedBy: null,
                    },
                });
            }
        });
        if (taskId && opts.resetTask !== false && !opts.skipProgress) {
            const task = await this.prisma.healthTask.findUnique({
                where: { id: taskId },
                select: { healthCaseId: true, planEnrollmentId: true },
            });
            if (task?.healthCaseId) {
                await this.updateCaseProgress(this.prisma, task.healthCaseId);
            }
            else if (task?.planEnrollmentId) {
                await this.updateEnrollmentProgress(this.prisma, task.planEnrollmentId);
            }
        }
        await this.reverseAqrNear(farmId, log.cattleId, 'Treatment Completed', log.createdAt, userId, `Treatment ${log.id} voided${reason ? ` — ${reason}` : ''}.`);
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.HEALTH_SAFETY,
            eventTitle: 'Voided: Treatment',
            actionDetails: `Treatment ${log.id} voided${reason ? ` — ${reason}` : ''} (stock restored, cost reversed).`,
            actorId: userId,
            relatedCattleId: log.cattleId,
        });
        this.log.info('Treatment voided', { farmId, treatmentLogId: log.id });
        return { id: log.id, voided: true };
    }
    async reverseAqrNear(farmId, cattleId, eventTitle, since, userId, actionDetails) {
        const source = await this.prisma.activityLog.findFirst({
            where: {
                farmId,
                relatedCattleId: cattleId,
                eventTitle,
                aqrImpact: { not: null },
                timestamp: { gte: since, lte: new Date(since.getTime() + 60_000) },
            },
            orderBy: { timestamp: 'asc' },
            select: { id: true },
        });
        if (!source)
            return;
        await this.aqrService.reverseEvent(farmId, cattleId, source.id, {
            actorId: userId,
            actionDetails,
            relative: true,
        });
    }
    async cancelPlanTasks(farmId, userId, taskWhere, reason) {
        const tasks = await this.prisma.healthTask.findMany({
            where: { farmId, deletedAt: null, ...taskWhere },
            select: { id: true },
        });
        const taskIds = tasks.map((t) => t.id);
        const logs = taskIds.length
            ? await this.prisma.treatmentLog.findMany({
                where: { farmId, healthTaskId: { in: taskIds }, voidedAt: null },
                select: { id: true },
            })
            : [];
        for (const log of logs) {
            await this.voidTreatmentLog(farmId, userId, log.id, reason ?? 'Protocol cancelled', {
                resetTask: false,
                skipProgress: true,
            });
        }
        if (taskIds.length) {
            await this.prisma.healthTask.updateMany({
                where: { id: { in: taskIds } },
                data: {
                    deletedAt: new Date(),
                    notes: reason
                        ? `Protocol cancelled: ${reason}`
                        : 'Protocol cancelled',
                },
            });
        }
        return { stepsRemoved: taskIds.length, dosesReversed: logs.length };
    }
    async cancelEnrollment(farmId, userId, enrollmentId, reason) {
        const enrollment = await this.prisma.planEnrollment.findFirst({
            where: { id: enrollmentId, farmId, deletedAt: null },
            select: { id: true, planApplicationId: true },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('That animal is not on this protocol');
        }
        const result = await this.cancelPlanTasks(farmId, userId, { planEnrollmentId: enrollment.id }, reason);
        await this.prisma.planEnrollment.update({
            where: { id: enrollment.id },
            data: {
                deletedAt: new Date(),
                cancelledAt: new Date(),
                cancelReason: reason,
            },
        });
        const live = await this.prisma.planEnrollment.count({
            where: {
                planApplicationId: enrollment.planApplicationId,
                deletedAt: null,
            },
        });
        await this.prisma.planApplication.update({
            where: { id: enrollment.planApplicationId },
            data: live === 0
                ? { deletedAt: new Date(), animalCount: 0 }
                : { animalCount: live },
        });
        this.log.info('Protocol cancelled on enrollment', {
            farmId,
            enrollmentId,
            ...result,
        });
        return {
            planEnrollmentId: enrollment.id,
            healthCaseId: null,
            ...result,
            caseRemoved: false,
        };
    }
    async cancelCaseProtocol(farmId, userId, caseId, reason) {
        const healthCase = await this.prisma.healthCase.findFirst({
            where: {
                id: caseId,
                farmId,
                deletedAt: null,
                healthPlanId: { not: null },
            },
            select: { id: true },
        });
        if (!healthCase) {
            throw new common_1.NotFoundException('That animal is not on this protocol');
        }
        const result = await this.cancelPlanTasks(farmId, userId, { healthCaseId: healthCase.id, healthPlanId: { not: null } }, reason);
        const [otherSteps, otherDoses] = await Promise.all([
            this.prisma.healthTask.count({
                where: { farmId, healthCaseId: healthCase.id, deletedAt: null },
            }),
            this.prisma.treatmentLog.count({
                where: { farmId, healthCaseId: healthCase.id, voidedAt: null },
            }),
        ]);
        const caseRemoved = otherSteps === 0 && otherDoses === 0;
        await this.prisma.healthCase.update({
            where: { id: healthCase.id },
            data: caseRemoved
                ? {
                    deletedAt: new Date(),
                    healthPlanId: null,
                    totalSteps: 0,
                    currentStep: 0,
                    progressPercentage: 0,
                }
                : {
                    healthPlanId: null,
                    totalSteps: 0,
                    currentStep: 0,
                    progressPercentage: 0,
                },
        });
        this.log.info('Protocol cancelled on case', {
            farmId,
            caseId,
            caseRemoved,
            ...result,
        });
        return {
            planEnrollmentId: null,
            healthCaseId: healthCase.id,
            ...result,
            caseRemoved,
        };
    }
    async cancelAnimalProtocol(farmId, userId, cattleId, dto) {
        if (Boolean(dto.healthCaseId) === Boolean(dto.planEnrollmentId)) {
            throw new common_1.BadRequestException('Send exactly one of healthCaseId or planEnrollmentId');
        }
        await this.assertCattleInFarm(farmId, cattleId);
        if (dto.healthCaseId) {
            const owns = await this.prisma.healthCase.count({
                where: { id: dto.healthCaseId, farmId, cattleId },
            });
            if (!owns)
                throw new common_1.NotFoundException('That animal is not on this protocol');
            return this.cancelCaseProtocol(farmId, userId, dto.healthCaseId, dto.reason);
        }
        const owns = await this.prisma.planEnrollment.count({
            where: { id: dto.planEnrollmentId, farmId, cattleId },
        });
        if (!owns)
            throw new common_1.NotFoundException('That animal is not on this protocol');
        return this.cancelEnrollment(farmId, userId, dto.planEnrollmentId, dto.reason);
    }
    async stockCheck(farmId, planId, animals) {
        const plan = await this.getPlan(farmId, planId);
        const shortfalls = (await this.protocolStock?.check(farmId, plan.steps, Math.max(1, animals))) ?? [];
        return { ok: shortfalls.length === 0, shortfalls };
    }
    async applyCycleRepeat(farmId, userId, plan, cattle, startDate, cycle) {
        return this.applyPreventivePlanToAnimals(farmId, userId, plan, [cattle], startDate, undefined, cycle);
    }
    async logTreatment(farmId, userId, id, dto) {
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const task = dto.healthTaskId
            ? await this.prisma.healthTask.findFirst({
                where: { id: dto.healthTaskId, healthCaseId: id, deletedAt: null },
            })
            : null;
        if (dto.healthTaskId && !task)
            throw new common_1.BadRequestException('Health task must belong to case');
        if (dto.outsideInventory && !dto.medicineName?.trim()) {
            throw new common_1.BadRequestException('medicineName is required when the medicine is not in inventory');
        }
        const vetCost = dto.vetCost && dto.vetCost > 0 ? dto.vetCost : undefined;
        const medicineId = dto.outsideInventory
            ? undefined
            : (dto.medicineId ?? task?.medicineId ?? undefined);
        const medicineName = dto.medicineName ?? task?.medicineName ?? undefined;
        const typedQuantity = dto.stockDeductionQuantity ?? dto.doseAmount;
        const quantity = typedQuantity ??
            (!dto.medicineId && task?.doseAmount
                ? Number(task.doseAmount)
                : undefined);
        const doseUnitId = typedQuantity === undefined
            ? (task?.doseUnitId ?? undefined)
            : dto.stockDeductionQuantity === undefined
                ? dto.doseUnitId
                : undefined;
        const deduction = !dto.outsideInventory &&
            quantity &&
            quantity > 0 &&
            (medicineId || medicineName)
            ? await this.medicineService.decrementForTreatment(farmId, userId, {
                medicineId,
                medicineName,
                quantity,
                doseUnitId,
                notes: `Treatment for case ${healthCase.caseCode}`,
            })
            : null;
        const resolvedCost = deduction?.totalCost ?? 0;
        let pendingNotices = null;
        const log = await this.prisma.$transaction(async (tx) => {
            const treatmentLog = await tx.treatmentLog.create({
                data: {
                    farmId: healthCase.farmId,
                    cattleId: healthCase.cattleId,
                    healthCaseId: id,
                    healthTaskId: dto.healthTaskId,
                    medicineId: deduction?.medicineId ?? medicineId,
                    medicineName: dto.medicineName ?? task?.medicineName,
                    doseAmount: dto.doseAmount ?? task?.doseAmount,
                    doseUnit: dto.doseUnit ?? task?.doseUnit,
                    route: dto.route ?? task?.route,
                    administeredAt: dto.administeredAt
                        ? new Date(dto.administeredAt)
                        : new Date(),
                    administeredBy: dto.administeredBy ?? userId,
                    stockDeducted: Boolean(deduction),
                    stockDeductionQuantity: deduction
                        ? quantity
                        : dto.stockDeductionQuantity,
                    batchNo: deduction?.batchId ?? dto.batchNo,
                    notes: dto.notes,
                    vetCost,
                },
            });
            if (task) {
                await tx.healthTask.update({
                    where: { id: task.id },
                    data: {
                        status: client_1.HealthTaskStatus.COMPLETED,
                        completedAt: treatmentLog.administeredAt,
                        completedBy: dto.administeredBy ?? userId,
                    },
                });
            }
            await this.stampMovements(tx, deduction?.movementIds, treatmentLog.id);
            const withdrawal = await this.createSafetyWithdrawalIfNeeded(tx, healthCase, treatmentLog, dto);
            const autoClosed = await this.updateCaseProgress(tx, id);
            if (task) {
                pendingNotices =
                    (await this.stepNotices?.syncTasks(tx, farmId, [task.id])) ?? null;
            }
            return { treatmentLog, withdrawal, autoClosed };
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        if (resolvedCost > 0) {
            const posted = await this.expenseService.recordInventoryConsumption(farmId, userId, {
                category: client_1.ExpenseCategory.HEALTH,
                description: `Medicine — Case ${healthCase.caseCode}`,
                amount: resolvedCost,
                expenseDate: log.treatmentLog.administeredAt.toISOString(),
                cattleId: healthCase.cattleId,
            });
            log.treatmentLog = await this.prisma.treatmentLog.update({
                where: { id: log.treatmentLog.id },
                data: { financeTransactionId: posted.id },
            });
        }
        if (vetCost) {
            const vetExpense = await this.expenseService.recordExpense(farmId, userId, {
                category: client_1.ExpenseCategory.HEALTH,
                description: `Vet fee — Case ${healthCase.caseCode}`,
                amount: vetCost,
                expenseDate: log.treatmentLog.administeredAt.toISOString(),
                financialAccountId: await this.expenseService.resolveAccountId(farmId, userId, dto.financialAccountId),
                cattleId: healthCase.cattleId,
            });
            log.treatmentLog = await this.prisma.treatmentLog.update({
                where: { id: log.treatmentLog.id },
                data: { vetExpenseId: vetExpense.id },
            });
        }
        await this.notifyCaseAutoClosed(log.autoClosed, userId);
        if (task) {
            await this.aqrService.applyEvent(farmId, healthCase.cattleId, 'treatment_completed', {
                actorId: userId,
                actionDetails: `Treatment administered for case [${healthCase.caseCode}].`,
            });
        }
        if (log.withdrawal) {
            const cattle = await this.prisma.cattle.findUnique({
                where: { id: healthCase.cattleId },
                select: { name: true, tagNumber: true },
            });
            const label = cattle?.name ?? cattle?.tagNumber ?? 'Animal';
            const milkUntil = log.withdrawal.milkWithdrawalUntil
                ?.toISOString()
                .slice(0, 10);
            const meatUntil = log.withdrawal.meatWithdrawalUntil
                ?.toISOString()
                .slice(0, 10);
            await this.notificationService.notifyOwnersAndManagers({
                farmId,
                eventKey: 'withholding_active',
                title: 'Withholding Period Active',
                message: `${label}${cattle?.tagNumber ? ` (${cattle.tagNumber})` : ''} is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
                params: {
                    name: label,
                    tagNumber: cattle?.tagNumber ?? '',
                    milkUntil: milkUntil ?? '',
                    meatUntil: meatUntil ?? '',
                },
                link: `/healthcare/cases/${id}`,
                dedupeKey: `withholding_active:${log.withdrawal.id}`,
            });
        }
        this.log.info('Treatment logged', {
            healthCaseId: id,
            treatmentLogId: log.treatmentLog.id,
        });
        return log;
    }
    async recordTreatment(farmId, userId, dto) {
        const cattleIds = dto.cattleIds;
        if (cattleIds.length === 0) {
            throw new common_1.BadRequestException('cattleIds must not be empty');
        }
        const manual = Boolean(dto.outsideInventory);
        if (manual && !dto.medicineName?.trim()) {
            throw new common_1.BadRequestException('medicineName is required when the medicine is not in inventory');
        }
        if (!manual && !dto.medicineId) {
            throw new common_1.BadRequestException('medicineId is required');
        }
        const vetCost = dto.vetCost && dto.vetCost > 0 ? dto.vetCost : undefined;
        const medicine = manual
            ? null
            : await this.prisma.medicine.findFirst({
                where: { id: dto.medicineId, farmId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    costPerUnit: true,
                    milkWithdrawalDays: true,
                    meatWithdrawalDays: true,
                },
            });
        if (!manual && !medicine)
            throw new common_1.NotFoundException('Medicine not found');
        const medicineLabel = manual ? dto.medicineName.trim() : medicine.name;
        let vetPosted = false;
        const cattleRows = await this.prisma.cattle.findMany({
            where: { id: { in: cattleIds }, farmId, deletedAt: null },
            select: { id: true, tagNumber: true, name: true, shedId: true },
        });
        const foundIds = new Set(cattleRows.map((c) => c.id));
        const missing = cattleIds.filter((cattleId) => !foundIds.has(cattleId));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Cattle not found in this farm: ${missing.join(', ')}`);
        }
        const treatedAt = new Date(dto.treatedAt);
        const careType = dto.careType ?? client_1.HealthCareType.CURATIVE;
        const isPreventive = careType === client_1.HealthCareType.PREVENTIVE;
        const results = [];
        for (const cattle of cattleRows) {
            const openCase = isPreventive
                ? null
                : await this.prisma.healthCase.findFirst({
                    where: {
                        farmId,
                        cattleId: cattle.id,
                        status: { in: ACTIVE_CASE_STATUSES },
                    },
                    orderBy: { startDate: 'desc' },
                });
            const reusedExistingCase = Boolean(openCase);
            const deduction = manual
                ? null
                : await this.medicineService.decrementForTreatment(farmId, userId, {
                    medicineId: dto.medicineId,
                    quantity: dto.doseAmount,
                    doseUnitId: dto.doseUnitId,
                    notes: `Quick treatment for ${cattle.tagNumber}`,
                });
            const resolvedCost = deduction?.totalCost ?? 0;
            const { healthCaseId, treatmentLog, withdrawal, autoClosed } = await this.prisma.$transaction(async (tx) => {
                const targetCase = openCase ??
                    (await tx.healthCase.create({
                        data: {
                            farmId,
                            cattleId: cattle.id,
                            caseCode: await this.nextCaseCode(farmId, tx),
                            note: dto.reason?.trim() ||
                                (isPreventive
                                    ? `Preventive / Wellness — ${medicineLabel}`
                                    : `Quick treatment — ${medicineLabel}`),
                            careType,
                            ...(dto.condition ? { condition: dto.condition } : {}),
                            priority: client_1.HealthPriority.LOW,
                            status: isPreventive
                                ? client_1.HealthCaseStatus.CLOSED
                                : client_1.HealthCaseStatus.ACTIVE,
                            closedDate: isPreventive ? treatedAt : undefined,
                            closeReason: isPreventive ? 'preventive_routine' : undefined,
                            totalSteps: isPreventive ? 1 : 0,
                            currentStep: isPreventive ? 1 : 0,
                            progressPercentage: isPreventive ? 100 : 0,
                            shedId: cattle.shedId,
                            startDate: treatedAt,
                        },
                    }));
                const treatmentLog = await tx.treatmentLog.create({
                    data: {
                        farmId,
                        cattleId: cattle.id,
                        healthCaseId: targetCase.id,
                        medicineId: deduction?.medicineId,
                        medicineName: medicineLabel,
                        doseAmount: dto.doseAmount,
                        doseUnit: dto.doseUnit,
                        route: dto.route,
                        administeredAt: treatedAt,
                        administeredBy: userId,
                        stockDeducted: Boolean(deduction),
                        stockDeductionQuantity: deduction ? dto.doseAmount : undefined,
                        batchNo: deduction?.batchId,
                        notes: dto.notes,
                        vetCost: vetCost && !vetPosted ? vetCost : undefined,
                    },
                });
                await this.stampMovements(tx, deduction?.movementIds, treatmentLog.id);
                const withdrawal = await this.createSafetyWithdrawalIfNeeded(tx, targetCase, treatmentLog, {
                    milkWithdrawalDays: medicine?.milkWithdrawalDays || undefined,
                    meatWithdrawalDays: medicine?.meatWithdrawalDays || undefined,
                });
                const autoClosed = isPreventive
                    ? null
                    : await this.updateCaseProgress(tx, targetCase.id);
                return {
                    healthCaseId: targetCase.id,
                    treatmentLog,
                    withdrawal,
                    autoClosed,
                };
            });
            if (resolvedCost > 0) {
                const posted = await this.expenseService.recordInventoryConsumption(farmId, userId, {
                    category: client_1.ExpenseCategory.HEALTH,
                    description: `${medicineLabel} — Quick treatment for [${cattle.tagNumber}]`,
                    amount: resolvedCost,
                    expenseDate: treatedAt.toISOString(),
                    cattleId: cattle.id,
                });
                await this.prisma.treatmentLog.update({
                    where: { id: treatmentLog.id },
                    data: { financeTransactionId: posted.id },
                });
            }
            if (vetCost && !vetPosted) {
                vetPosted = true;
                const vetExpense = await this.expenseService.recordExpense(farmId, userId, {
                    category: client_1.ExpenseCategory.HEALTH,
                    description: `Vet fee — Quick treatment (${medicineLabel})`,
                    amount: vetCost,
                    expenseDate: treatedAt.toISOString(),
                    financialAccountId: await this.expenseService.resolveAccountId(farmId, userId, dto.financialAccountId),
                    cattleId: cattle.id,
                });
                await this.prisma.treatmentLog.update({
                    where: { id: treatmentLog.id },
                    data: { vetExpenseId: vetExpense.id },
                });
            }
            await this.notifyCaseAutoClosed(autoClosed, userId);
            await this.aqrService.applyEvent(farmId, cattle.id, 'treatment_completed', {
                actorId: userId,
                actionDetails: `${isPreventive ? 'Preventive / Wellness' : 'Quick treatment'} administered for [${cattle.tagNumber}] — ${medicineLabel}.`,
            });
            if (withdrawal) {
                const label = cattle.name ?? cattle.tagNumber;
                const milkUntil = withdrawal.milkWithdrawalUntil
                    ?.toISOString()
                    .slice(0, 10);
                const meatUntil = withdrawal.meatWithdrawalUntil
                    ?.toISOString()
                    .slice(0, 10);
                await this.notificationService.notifyOwnersAndManagers({
                    farmId,
                    eventKey: 'withholding_active',
                    title: 'Withholding Period Active',
                    message: `${label} (${cattle.tagNumber}) is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
                    params: {
                        name: label,
                        tagNumber: cattle.tagNumber,
                        milkUntil: milkUntil ?? '',
                        meatUntil: meatUntil ?? '',
                    },
                    link: `/healthcare/cases/${healthCaseId}`,
                    dedupeKey: `withholding_active:${withdrawal.id}`,
                });
            }
            results.push({
                cattleId: cattle.id,
                healthCaseId,
                treatmentLogId: treatmentLog.id,
                safetyWithdrawalId: withdrawal?.id ?? null,
                reusedExistingCase,
            });
        }
        this.log.info('Quick treatment recorded', {
            farmId,
            medicineId: dto.medicineId,
            animalCount: results.length,
        });
        return {
            medicineId: dto.medicineId,
            appliedCount: results.length,
            results,
        };
    }
    async createHealthUpdate(farmId, userId, id, dto) {
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const statusMap = {
            [client_1.ClinicalProgress.IMPROVING]: client_1.HealthCaseStatus.IMPROVING,
            [client_1.ClinicalProgress.WORSENING]: client_1.HealthCaseStatus.WORSENING,
            [client_1.ClinicalProgress.STABLE]: client_1.HealthCaseStatus.STABLE,
        };
        const update = await this.prisma.$transaction(async (tx) => {
            const created = await tx.healthUpdate.create({
                data: {
                    farmId: healthCase.farmId,
                    cattleId: healthCase.cattleId,
                    healthCaseId: id,
                    clinicalProgress: dto.clinicalProgress,
                    symptoms: dto.symptoms ?? [],
                    temperature: dto.temperature,
                    appetite: dto.appetite,
                    appearance: dto.appearance,
                    observation: dto.observation,
                    recordedBy: dto.recordedBy ?? userId,
                    recordedAt: new Date(),
                },
            });
            await tx.healthCase.update({
                where: { id },
                data: {
                    status: statusMap[dto.clinicalProgress],
                    symptoms: dto.symptoms ?? healthCase.symptoms,
                },
            });
            return created;
        });
        return update;
    }
    async closeCase(farmId, userId, id, dto) {
        if (dto.outcome === client_1.HealthCloseOutcome.MORTALITY) {
            if (!dto.mortality)
                throw new common_1.BadRequestException('Mortality details are required');
            return this.logMortality(farmId, userId, id, dto.mortality);
        }
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const closed = await this.prisma.healthCase.update({
            where: { id },
            data: {
                status: client_1.HealthCaseStatus.RECOVERED,
                closedDate: new Date(),
                closeReason: dto.observation ?? 'Recovered',
                deletedAt: new Date(),
            },
        });
        await this.stepNotices?.enqueueAfterCommit(await this.stepNotices.syncCases(null, farmId, [id]));
        await this.aqrService.applyEvent(farmId, healthCase.cattleId, 'recovered', {
            actorId: userId,
            actionDetails: `Case [${healthCase.caseCode}] closed — animal recovered.`,
        });
        this.log.info('Health case closed as recovered', {
            healthCaseId: id,
            farmId,
        });
        return closed;
    }
    async logMortality(farmId, userId, id, dto) {
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const disposalCost = dto.disposalCost && dto.disposalCost > 0 ? dto.disposalCost : undefined;
        let pendingNotices = null;
        const result = await this.prisma.$transaction(async (tx) => {
            const mortality = await tx.mortalityRecord.create({
                data: {
                    farmId: healthCase.farmId,
                    cattleId: healthCase.cattleId,
                    healthCaseId: id,
                    deathDate: new Date(dto.deathDate),
                    primaryCauseOfDeath: dto.primaryCauseOfDeath,
                    vetSignOff: dto.vetSignOff,
                    symptoms: dto.symptoms ?? [],
                    postMortemPerformed: dto.postMortemPerformed ?? false,
                    disposalMethod: dto.disposalMethod,
                    disposalCost: dto.disposalCost,
                    disposalLocation: dto.disposalLocation,
                    additionalNotes: dto.additionalNotes,
                    recordedBy: dto.recordedBy ?? userId,
                },
            });
            const closedCase = await tx.healthCase.update({
                where: { id },
                data: {
                    status: client_1.HealthCaseStatus.MORTALITY,
                    closedDate: new Date(dto.deathDate),
                    closeReason: dto.primaryCauseOfDeath,
                    mortalityId: mortality.id,
                    deletedAt: new Date(),
                },
            });
            await this.cattleService.recordDispositionWithClient(tx, healthCase.farmId, userId, healthCase.cattleId, {
                type: client_1.CattleDispositionType.DEATH,
                date: new Date(dto.deathDate),
                reason: dto.primaryCauseOfDeath,
            });
            pendingNotices =
                (await this.stepNotices?.syncCases(tx, farmId, [id])) ?? null;
            return { mortality, healthCase: closedCase };
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        await this.cattleService.cleanupOnDisposition(farmId, healthCase.cattleId, userId, client_1.CattleDispositionType.DEATH);
        if (disposalCost) {
            await this.expenseService.recordExpense(farmId, userId, {
                category: client_1.ExpenseCategory.HEALTH,
                description: `Carcass disposal — Case ${healthCase.caseCode}`,
                amount: disposalCost,
                expenseDate: new Date(dto.deathDate).toISOString(),
                financialAccountId: await this.expenseService.resolveAccountId(farmId, userId, dto.financialAccountId),
                cattleId: healthCase.cattleId,
            });
        }
        await this.aqrService.applyEvent(farmId, healthCase.cattleId, 'mortality', {
            actorId: userId,
            actionDetails: `Mortality recorded for case [${healthCase.caseCode}] — ${dto.primaryCauseOfDeath}.`,
        });
        this.log.info('Mortality logged', {
            healthCaseId: id,
            cattleId: healthCase.cattleId,
        });
        return result;
    }
    async getPlans(farmId, query) {
        const runningNow = [
            {
                cases: {
                    some: { status: { in: ACTIVE_CASE_STATUSES }, deletedAt: null },
                },
            },
            {
                planEnrollments: {
                    some: { status: client_1.PlanEnrollmentStatus.ACTIVE, deletedAt: null },
                },
            },
        ];
        const where = {
            farmId,
            OR: query.inUse ? runningNow : [{ deletedAt: null }, ...runningNow],
            ...(query.search
                ? { name: { contains: query.search, mode: 'insensitive' } }
                : {}),
            ...(query.category ? { category: query.category } : {}),
            ...(query.kind
                ? {
                    AND: [
                        query.kind === 'PREVENTION'
                            ? {
                                category: {
                                    notIn: [
                                        client_1.HealthPlanCategory.TREATMENT,
                                        client_1.HealthPlanCategory.BREEDING,
                                    ],
                                },
                            }
                            : { category: client_1.HealthPlanCategory[query.kind] },
                    ],
                }
                : {}),
            ...(query.planType ? { planType: query.planType } : {}),
            ...(query.condition ? { condition: query.condition } : {}),
        };
        const rows = await this.prisma.healthPlan.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async getPlanApplications(farmId, query) {
        const where = {
            farmId,
            deletedAt: null,
            ...(query.healthPlanId ? { healthPlanId: query.healthPlanId } : {}),
        };
        const rows = await this.prisma.planApplication.findMany({
            where,
            orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                healthPlan: { select: { id: true, name: true, category: true } },
                enrollments: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        status: true,
                        currentStep: true,
                        totalSteps: true,
                        progressPercentage: true,
                        cattle: {
                            select: { id: true, name: true, tagNumber: true, image: true },
                        },
                    },
                },
            },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async createPlan(farmId, userId, dto) {
        const steps = (await this.protocolStock?.validateAndNormalizeSteps(farmId, dto.steps)) ?? dto.steps;
        return this.prisma.healthPlan.create({
            data: {
                farmId,
                name: dto.name,
                category: dto.category,
                planType: dto.planType,
                description: dto.description,
                diagnosis: dto.diagnosis,
                condition: dto.condition,
                cycleLengthDays: dto.cycleLengthDays,
                totalActionSteps: steps.length,
                isTemplate: dto.isTemplate ?? false,
                createdBy: userId,
                steps: { create: steps },
            },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
    }
    async getPlanForView(farmId, id) {
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id, farmId },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Health plan not found');
        return plan;
    }
    async getPlan(farmId, id) {
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id, farmId, deletedAt: null },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Health plan not found');
        return plan;
    }
    async updatePlan(farmId, id, dto) {
        await this.getPlan(farmId, id);
        const steps = dto.steps
            ? ((await this.protocolStock?.validateAndNormalizeSteps(farmId, dto.steps)) ?? dto.steps)
            : undefined;
        const updated = await this.prisma.$transaction(async (tx) => {
            if (steps) {
                await tx.healthPlanStep.deleteMany({ where: { healthPlanId: id } });
            }
            return tx.healthPlan.update({
                where: { id },
                data: {
                    name: dto.name,
                    category: dto.category,
                    planType: dto.planType,
                    description: dto.description,
                    diagnosis: dto.diagnosis,
                    condition: dto.condition,
                    cycleLengthDays: dto.cycleLengthDays,
                    isTemplate: dto.isTemplate,
                    totalActionSteps: steps?.length,
                    ...(steps ? { steps: { create: steps } } : {}),
                },
                include: { steps: { orderBy: { dayNumber: 'asc' } } },
            });
        });
        this.log.info('Health plan updated', { healthPlanId: id, farmId });
        return updated;
    }
    async deletePlan(farmId, id) {
        await this.getPlan(farmId, id);
        const deleted = await this.prisma.healthPlan.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Health plan archived', { healthPlanId: id, farmId });
        return deleted;
    }
    async deleteCase(farmId, userId, id) {
        const healthCase = await this.getCaseOrThrow(farmId, id);
        const logs = await this.prisma.treatmentLog.findMany({
            where: { farmId, healthCaseId: id, voidedAt: null },
            select: { id: true },
        });
        for (const log of logs) {
            await this.voidTreatmentLog(farmId, userId, log.id, 'Case deleted', {
                resetTask: false,
                skipProgress: true,
            });
        }
        await this.prisma.healthTask.updateMany({
            where: { farmId, healthCaseId: id, deletedAt: null },
            data: { deletedAt: new Date(), notes: 'Case deleted' },
        });
        const deleted = await this.prisma.healthCase.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        if (healthCase.careType === client_1.HealthCareType.CURATIVE) {
            await this.reverseAqrNear(farmId, healthCase.cattleId, 'Animal Sickness Reported', healthCase.createdAt, userId, `Case [${healthCase.caseCode}] deleted.`);
        }
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.HEALTH_SAFETY,
            eventTitle: 'Deleted: Health case',
            actionDetails: `Case [${healthCase.caseCode}] deleted (${logs.length} dose(s) reversed).`,
            actorId: userId,
            relatedCattleId: healthCase.cattleId,
        });
        this.log.info('Health case archived', {
            healthCaseId: id,
            farmId,
            dosesReversed: logs.length,
        });
        return deleted;
    }
    async farmTimezone(farmId) {
        const farm = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { timezone: true },
        });
        return farm?.timezone ?? farm_time_1.DEFAULT_FARM_TIMEZONE;
    }
    async getTasks(farmId, query) {
        const dueBefore = query.dueTo
            ? (0, health_farm_day_1.farmDayEnd)(query.dueTo, await this.farmTimezone(farmId))
            : undefined;
        const where = {
            farmId,
            deletedAt: null,
            ...(query.cattleId ? { cattleId: query.cattleId } : {}),
            ...(query.healthCaseId ? { healthCaseId: query.healthCaseId } : {}),
            ...(query.statuses?.length
                ? { status: { in: query.statuses } }
                : query.status
                    ? { status: query.status }
                    : {}),
            ...(query.healthPlanId
                ? { healthPlanId: query.healthPlanId }
                : query.noPlan
                    ? { healthPlanId: null }
                    : {}),
            ...(dueBefore ? { AND: [{ dueDateTime: { lt: dueBefore } }] } : {}),
            ...(query.type ? { taskType: query.type } : {}),
            ...(query.date
                ? {
                    dueDateTime: {
                        gte: new Date(`${query.date}T00:00:00.000Z`),
                        lte: new Date(`${query.date}T23:59:59.999Z`),
                    },
                }
                : {}),
        };
        const rows = await this.prisma.healthTask.findMany({
            where,
            orderBy: query.sortBy === 'due'
                ? [{ dueDateTime: query.sortOrder }, { id: query.sortOrder }]
                : [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                cattle: { select: { id: true, tagNumber: true, name: true } },
                healthPlan: { select: { id: true, name: true } },
                healthCase: { select: { id: true, caseCode: true } },
            },
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async getPlanRuns(farmId, planId, query) {
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id: planId, farmId },
            select: { id: true, category: true },
        });
        if (!plan)
            throw new common_1.NotFoundException('Health plan not found');
        const animalMatch = query.search
            ? {
                OR: [
                    { tagNumber: { contains: query.search, mode: 'insensitive' } },
                    { name: { contains: query.search, mode: 'insensitive' } },
                ],
            }
            : undefined;
        const nextStep = {
            where: {
                deletedAt: null,
                status: {
                    in: [
                        client_1.HealthTaskStatus.PENDING,
                        client_1.HealthTaskStatus.RESCHEDULED,
                        client_1.HealthTaskStatus.OVERDUE,
                    ],
                },
            },
            orderBy: { dueDateTime: 'asc' },
            take: 1,
            select: { id: true, title: true, dueDateTime: true, status: true },
        };
        const cattle = {
            select: { id: true, name: true, tagNumber: true, image: true },
        };
        const orderBy = [{ createdAt: query.sortOrder }, { id: query.sortOrder }];
        if (plan.category === client_1.HealthPlanCategory.TREATMENT) {
            const rows = await this.prisma.healthCase.findMany({
                where: {
                    farmId,
                    healthPlanId: planId,
                    deletedAt: null,
                    ...(query.status === 'active'
                        ? { status: { in: ACTIVE_CASE_STATUSES } }
                        : {}),
                    ...(animalMatch ? { cattle: animalMatch } : {}),
                },
                orderBy,
                ...(0, pagination_1.getCursorArgs)(query),
                select: {
                    id: true,
                    caseCode: true,
                    status: true,
                    startDate: true,
                    currentStep: true,
                    totalSteps: true,
                    progressPercentage: true,
                    cattle,
                    tasks: nextStep,
                },
            });
            return (0, pagination_1.toCursorPage)(rows.map(({ tasks, ...row }) => ({
                ...row,
                kind: 'CASE',
                healthCaseId: row.id,
                planEnrollmentId: null,
                nextStep: tasks[0] ?? null,
            })), query);
        }
        const rows = await this.prisma.planEnrollment.findMany({
            where: {
                farmId,
                healthPlanId: planId,
                deletedAt: null,
                ...(query.status === 'active'
                    ? { status: client_1.PlanEnrollmentStatus.ACTIVE }
                    : {}),
                ...(animalMatch ? { cattle: animalMatch } : {}),
            },
            orderBy,
            ...(0, pagination_1.getCursorArgs)(query),
            select: {
                id: true,
                status: true,
                startDate: true,
                currentStep: true,
                totalSteps: true,
                progressPercentage: true,
                cattle,
                tasks: nextStep,
            },
        });
        return (0, pagination_1.toCursorPage)(rows.map(({ tasks, ...row }) => ({
            ...row,
            kind: 'ENROLLMENT',
            caseCode: null,
            healthCaseId: null,
            planEnrollmentId: row.id,
            nextStep: tasks[0] ?? null,
        })), query);
    }
    async getTaskCalendar(farmId, query) {
        const start = new Date(Date.UTC(query.year, query.month - 1, 1));
        const end = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
        const tasks = await this.prisma.healthTask.findMany({
            where: { farmId, deletedAt: null, dueDateTime: { gte: start, lte: end } },
            select: { dueDateTime: true, status: true },
        });
        return this.groupTasksByDate(tasks);
    }
    async completeTask(farmId, userId, id) {
        const task = await this.getTaskOrThrow(farmId, id);
        if (task.taskType === client_1.HealthActionType.MEDICINE &&
            task.medicineId &&
            Number(task.doseAmount) > 0 &&
            task.status !== client_1.HealthTaskStatus.COMPLETED &&
            (await this.prisma.treatmentLog.count({
                where: { healthTaskId: id, voidedAt: null },
            })) === 0) {
            if (task.healthCaseId) {
                await this.logTreatment(farmId, userId, task.healthCaseId, {
                    healthTaskId: id,
                });
            }
            else {
                await this.logTaskTreatment(farmId, userId, id, {});
            }
            return this.getTaskOrThrow(farmId, id);
        }
        const updated = await this.prisma.healthTask.update({
            where: { id },
            data: {
                status: client_1.HealthTaskStatus.COMPLETED,
                completedAt: new Date(),
                completedBy: userId,
            },
        });
        if (task.healthCaseId) {
            const autoClosed = await this.updateCaseProgress(this.prisma, task.healthCaseId);
            await this.notifyCaseAutoClosed(autoClosed, userId);
        }
        else if (task.planEnrollmentId) {
            await this.updateEnrollmentProgress(this.prisma, task.planEnrollmentId);
        }
        await this.stepNotices?.enqueueAfterCommit(await this.stepNotices.syncTasks(null, farmId, [id]));
        return updated;
    }
    async logTaskTreatment(farmId, userId, taskId, dto) {
        const task = await this.getTaskOrThrow(farmId, taskId);
        if (task.healthCaseId) {
            throw new common_1.BadRequestException('This task belongs to a case — use POST /health/cases/:id/log-treatment instead');
        }
        if (!task.planEnrollmentId) {
            throw new common_1.BadRequestException('Task has neither a case nor a plan enrollment to log a treatment against');
        }
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: task.cattleId, farmId, deletedAt: null },
            select: { id: true, tagNumber: true, name: true, shedId: true },
        });
        if (!cattle)
            throw new common_1.NotFoundException('Cattle not found');
        const medicineId = dto.medicineId ?? task.medicineId ?? undefined;
        const medicineName = dto.medicineName ?? task.medicineName ?? undefined;
        const typedQuantity = dto.stockDeductionQuantity ?? dto.doseAmount;
        const quantity = typedQuantity ??
            (!dto.medicineId && task.doseAmount
                ? Number(task.doseAmount)
                : undefined);
        const doseUnitId = typedQuantity === undefined ? (task.doseUnitId ?? undefined) : undefined;
        let milkWithdrawalDays;
        let meatWithdrawalDays;
        if (medicineId) {
            const medicine = await this.prisma.medicine.findFirst({
                where: { id: medicineId, farmId, deletedAt: null },
                select: { milkWithdrawalDays: true, meatWithdrawalDays: true },
            });
            milkWithdrawalDays = medicine?.milkWithdrawalDays || undefined;
            meatWithdrawalDays = medicine?.meatWithdrawalDays || undefined;
        }
        const deduction = quantity && quantity > 0 && (medicineId || medicineName)
            ? await this.medicineService.decrementForTreatment(farmId, userId, {
                medicineId,
                medicineName,
                quantity,
                doseUnitId,
                notes: `Preventive-round treatment for task ${task.taskCode}`,
            })
            : null;
        const resolvedCost = deduction?.totalCost ?? 0;
        if (!medicineId && deduction) {
            const medicine = await this.prisma.medicine.findUnique({
                where: { id: deduction.medicineId },
                select: { milkWithdrawalDays: true, meatWithdrawalDays: true },
            });
            milkWithdrawalDays = medicine?.milkWithdrawalDays || undefined;
            meatWithdrawalDays = medicine?.meatWithdrawalDays || undefined;
        }
        const administeredAt = dto.administeredAt
            ? new Date(dto.administeredAt)
            : new Date();
        let pendingNotices = null;
        const { treatmentLog, withdrawal } = await this.prisma.$transaction(async (tx) => {
            const backingCase = (await tx.healthCase.findFirst({
                where: {
                    farmId,
                    cattleId: task.cattleId,
                    careType: client_1.HealthCareType.PREVENTIVE,
                    status: { in: ACTIVE_CASE_STATUSES },
                },
                orderBy: { startDate: 'desc' },
            })) ??
                (await tx.healthCase.create({
                    data: {
                        farmId,
                        cattleId: task.cattleId,
                        caseCode: await this.nextCaseCode(farmId, tx),
                        note: task.title || 'Preventive round treatment',
                        careType: client_1.HealthCareType.PREVENTIVE,
                        priority: client_1.HealthPriority.LOW,
                        shedId: cattle.shedId,
                        startDate: administeredAt,
                    },
                }));
            const treatmentLog = await tx.treatmentLog.create({
                data: {
                    farmId,
                    cattleId: task.cattleId,
                    healthCaseId: backingCase.id,
                    healthTaskId: task.id,
                    medicineId: deduction?.medicineId ?? medicineId,
                    medicineName: dto.medicineName ?? task.medicineName,
                    doseAmount: dto.doseAmount ?? task.doseAmount ?? undefined,
                    doseUnit: dto.doseUnit ?? task.doseUnit ?? undefined,
                    route: dto.route ?? task.route ?? undefined,
                    administeredAt,
                    administeredBy: dto.administeredBy ?? userId,
                    stockDeducted: Boolean(deduction),
                    stockDeductionQuantity: deduction
                        ? quantity
                        : dto.stockDeductionQuantity,
                    batchNo: deduction?.batchId ?? dto.batchNo,
                    notes: dto.notes,
                },
            });
            await this.stampMovements(tx, deduction?.movementIds, treatmentLog.id);
            await tx.healthTask.update({
                where: { id: task.id },
                data: {
                    status: client_1.HealthTaskStatus.COMPLETED,
                    completedAt: treatmentLog.administeredAt,
                    completedBy: dto.administeredBy ?? userId,
                },
            });
            await this.updateEnrollmentProgress(tx, task.planEnrollmentId);
            const withdrawal = await this.createSafetyWithdrawalIfNeeded(tx, backingCase, treatmentLog, {
                milkWithdrawalDays: dto.milkWithdrawalDays ?? milkWithdrawalDays,
                meatWithdrawalDays: dto.meatWithdrawalDays ?? meatWithdrawalDays,
            });
            pendingNotices =
                (await this.stepNotices?.syncTasks(tx, farmId, [task.id])) ?? null;
            return { treatmentLog, withdrawal };
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        if (resolvedCost > 0) {
            const posted = await this.expenseService.recordInventoryConsumption(farmId, userId, {
                category: client_1.ExpenseCategory.HEALTH,
                description: `Medicine — Task ${task.taskCode}`,
                amount: resolvedCost,
                expenseDate: treatmentLog.administeredAt.toISOString(),
                cattleId: task.cattleId,
            });
            await this.prisma.treatmentLog.update({
                where: { id: treatmentLog.id },
                data: { financeTransactionId: posted.id },
            });
        }
        await this.aqrService.applyEvent(farmId, task.cattleId, 'treatment_completed', {
            actorId: userId,
            actionDetails: `Preventive-round treatment administered for task [${task.taskCode}].`,
        });
        if (withdrawal) {
            const label = cattle.name ?? cattle.tagNumber;
            const milkUntil = withdrawal.milkWithdrawalUntil
                ?.toISOString()
                .slice(0, 10);
            const meatUntil = withdrawal.meatWithdrawalUntil
                ?.toISOString()
                .slice(0, 10);
            await this.notificationService.notifyOwnersAndManagers({
                farmId,
                eventKey: 'withholding_active',
                title: 'Withholding Period Active',
                message: `${label}${cattle.tagNumber ? ` (${cattle.tagNumber})` : ''} is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
                params: {
                    name: label,
                    tagNumber: cattle.tagNumber,
                    milkUntil: milkUntil ?? '',
                    meatUntil: meatUntil ?? '',
                },
                link: `/healthcare/cases/${treatmentLog.healthCaseId}`,
                dedupeKey: `withholding_active:${withdrawal.id}`,
            });
        }
        this.log.info('Preventive-round task treatment logged', {
            farmId,
            taskId: task.id,
            treatmentLogId: treatmentLog.id,
        });
        return { treatmentLog, withdrawal };
    }
    async rescheduleTask(farmId, id, dto) {
        const task = await this.getTaskOrThrow(farmId, id);
        let pendingNotices = null;
        const updated = await this.prisma.$transaction(async (tx) => {
            const oldKeys = (await this.stepNotices?.keysOfTasks(tx, farmId, [id])) ?? [];
            const row = await tx.healthTask.update({
                where: { id },
                data: {
                    status: client_1.HealthTaskStatus.RESCHEDULED,
                    rescheduledFrom: task.dueDateTime,
                    rescheduledTo: new Date(dto.newDueDateTime),
                    dueDateTime: new Date(dto.newDueDateTime),
                    taskDate: new Date(dto.newDueDateTime),
                    notes: dto.reason,
                },
            });
            pendingNotices =
                (await this.stepNotices?.syncTasks(tx, farmId, [id], oldKeys)) ?? null;
            return row;
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        return updated;
    }
    async skipTask(farmId, id, dto) {
        await this.getTaskOrThrow(farmId, id);
        let pendingNotices = null;
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.healthTask.update({
                where: { id },
                data: { status: client_1.HealthTaskStatus.SKIPPED, notes: dto.reason },
            });
            pendingNotices =
                (await this.stepNotices?.syncTasks(tx, farmId, [id])) ?? null;
            return row;
        });
        await this.stepNotices?.enqueueAfterCommit(pendingNotices);
        return updated;
    }
    async getCattleProtocols(farmId, cattleId) {
        await this.assertCattleInFarm(farmId, cattleId);
        const openSteps = {
            where: {
                deletedAt: null,
                status: {
                    in: [
                        client_1.HealthTaskStatus.PENDING,
                        client_1.HealthTaskStatus.RESCHEDULED,
                        client_1.HealthTaskStatus.OVERDUE,
                    ],
                },
            },
            orderBy: { dueDateTime: 'asc' },
            take: 1,
            select: { id: true, title: true, dueDateTime: true, status: true },
        };
        const plan = { select: { id: true, name: true, category: true } };
        const [cases, enrollments] = await Promise.all([
            this.prisma.healthCase.findMany({
                where: {
                    farmId,
                    cattleId,
                    deletedAt: null,
                    healthPlanId: { not: null },
                    status: { in: ACTIVE_CASE_STATUSES },
                },
                select: {
                    id: true,
                    caseCode: true,
                    startDate: true,
                    currentStep: true,
                    totalSteps: true,
                    progressPercentage: true,
                    healthPlan: plan,
                    tasks: openSteps,
                },
            }),
            this.prisma.planEnrollment.findMany({
                where: {
                    farmId,
                    cattleId,
                    deletedAt: null,
                    status: client_1.PlanEnrollmentStatus.ACTIVE,
                },
                select: {
                    id: true,
                    startDate: true,
                    currentStep: true,
                    totalSteps: true,
                    progressPercentage: true,
                    healthPlan: plan,
                    tasks: openSteps,
                },
            }),
        ]);
        const items = [
            ...cases.map((c) => ({
                runType: 'CASE',
                id: c.id,
                healthCaseId: c.id,
                planEnrollmentId: null,
                caseCode: c.caseCode,
                healthPlan: c.healthPlan,
                startDate: c.startDate,
                currentStep: c.currentStep,
                totalSteps: c.totalSteps,
                progressPercentage: c.progressPercentage,
                nextStep: c.tasks[0] ?? null,
            })),
            ...enrollments.map((e) => ({
                runType: 'ENROLLMENT',
                id: e.id,
                healthCaseId: null,
                planEnrollmentId: e.id,
                caseCode: null,
                healthPlan: e.healthPlan,
                startDate: e.startDate,
                currentStep: e.currentStep,
                totalSteps: e.totalSteps,
                progressPercentage: e.progressPercentage,
                nextStep: e.tasks[0] ?? null,
            })),
        ].filter((r) => r.healthPlan !== null);
        items.sort((a, b) => {
            if (!a.nextStep && !b.nextStep)
                return 0;
            if (!a.nextStep)
                return 1;
            if (!b.nextStep)
                return -1;
            return (a.nextStep.dueDateTime.getTime() - b.nextStep.dueDateTime.getTime());
        });
        return { items };
    }
    async stopCattleProtocol(farmId, cattleId, dto) {
        if (Boolean(dto.healthCaseId) === Boolean(dto.planEnrollmentId)) {
            throw new common_1.BadRequestException('Send exactly one of healthCaseId or planEnrollmentId');
        }
        await this.assertCattleInFarm(farmId, cattleId);
        const note = dto.reason
            ? `Protocol stopped: ${dto.reason}`
            : 'Protocol stopped';
        const openStatuses = [
            client_1.HealthTaskStatus.PENDING,
            client_1.HealthTaskStatus.RESCHEDULED,
            client_1.HealthTaskStatus.OVERDUE,
        ];
        if (dto.healthCaseId) {
            const healthCase = await this.prisma.healthCase.findFirst({
                where: {
                    id: dto.healthCaseId,
                    farmId,
                    cattleId,
                    deletedAt: null,
                    healthPlanId: { not: null },
                },
                select: { id: true },
            });
            if (!healthCase) {
                throw new common_1.NotFoundException('That animal is not on this protocol');
            }
            await this.prisma.$transaction([
                this.prisma.healthTask.updateMany({
                    where: {
                        farmId,
                        healthCaseId: healthCase.id,
                        healthPlanId: { not: null },
                        deletedAt: null,
                        status: { in: openStatuses },
                    },
                    data: { status: client_1.HealthTaskStatus.SKIPPED, notes: note },
                }),
                this.prisma.healthCase.update({
                    where: { id: healthCase.id },
                    data: {
                        healthPlanId: null,
                        currentStep: 0,
                        totalSteps: 0,
                        progressPercentage: 0,
                    },
                }),
            ]);
            this.log.info('Protocol stopped on case', {
                cattleId,
                healthCaseId: healthCase.id,
            });
            return { healthCaseId: healthCase.id, planEnrollmentId: null };
        }
        const enrollment = await this.prisma.planEnrollment.findFirst({
            where: {
                id: dto.planEnrollmentId,
                farmId,
                cattleId,
                deletedAt: null,
                status: client_1.PlanEnrollmentStatus.ACTIVE,
            },
            select: { id: true },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('That animal is not on this protocol');
        }
        await this.prisma.$transaction([
            this.prisma.healthTask.updateMany({
                where: {
                    farmId,
                    planEnrollmentId: enrollment.id,
                    deletedAt: null,
                    status: { in: openStatuses },
                },
                data: { status: client_1.HealthTaskStatus.SKIPPED, notes: note },
            }),
            this.prisma.planEnrollment.update({
                where: { id: enrollment.id },
                data: { deletedAt: new Date() },
            }),
        ]);
        this.log.info('Protocol stopped on enrollment', {
            cattleId,
            planEnrollmentId: enrollment.id,
        });
        return { healthCaseId: null, planEnrollmentId: enrollment.id };
    }
    async getCattleHealthSummary(farmId, cattleId) {
        await this.assertCattleInFarm(farmId, cattleId);
        const [activeCases, treatmentHistory, activeWithdrawals, mortality] = await Promise.all([
            this.prisma.healthCase.findMany({
                where: {
                    cattleId,
                    farmId,
                    deletedAt: null,
                    status: { in: ACTIVE_CASE_STATUSES },
                },
                include: {
                    healthPlan: { select: { id: true, name: true } },
                    tasks: {
                        where: { status: client_1.HealthTaskStatus.PENDING },
                        orderBy: { dueDateTime: 'asc' },
                        take: 1,
                    },
                },
            }),
            this.prisma.treatmentLog.findMany({
                where: { cattleId, farmId, voidedAt: null },
                orderBy: { administeredAt: 'desc' },
                take: 20,
            }),
            this.prisma.safetyWithdrawal.findMany({
                where: {
                    cattleId,
                    farmId,
                    status: {
                        in: [
                            client_1.SafetyWithdrawalStatus.ACTIVE,
                            client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE,
                        ],
                    },
                },
            }),
            this.prisma.mortalityRecord.findFirst({
                where: { cattleId, farmId },
                orderBy: { deathDate: 'desc' },
            }),
        ]);
        return {
            activeCases,
            ongoingTreatment: activeCases.some((c) => c.careType === client_1.HealthCareType.CURATIVE),
            treatmentProgress: activeCases.map((healthCase) => ({
                healthCaseId: healthCase.id,
                progressPercentage: healthCase.progressPercentage,
            })),
            treatmentHistory,
            safetyWithdrawalWarning: activeWithdrawals.length > 0,
            activeWithdrawals,
            vaccinationHistory: treatmentHistory.filter((log) => log.notes?.toLowerCase().includes('vaccin')),
            dewormingHistory: treatmentHistory.filter((log) => log.notes?.toLowerCase().includes('deworm')),
            mortalityStatus: mortality,
        };
    }
    async activeMilkWithholdingCattleIds(farmId, cattleIds) {
        if (cattleIds.length === 0)
            return new Set();
        const now = new Date();
        const rows = await this.prisma.safetyWithdrawal.findMany({
            where: {
                farmId,
                cattleId: { in: cattleIds },
                milkWithdrawalUntil: { not: null },
                OR: [
                    {
                        status: {
                            in: [
                                client_1.SafetyWithdrawalStatus.ACTIVE,
                                client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE,
                            ],
                        },
                    },
                    {
                        status: client_1.SafetyWithdrawalStatus.ACTIVE,
                        milkWithdrawalUntil: { lte: now },
                    },
                ],
            },
            select: { cattleId: true },
        });
        return new Set(rows.map((r) => r.cattleId));
    }
    daysRemaining(until) {
        if (!until)
            return null;
        const ms = until.getTime() - Date.now();
        return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
    async getSafetyWithdrawals(farmId, query) {
        const where = {
            farmId,
            ...(query.cattleId ? { cattleId: query.cattleId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.activeOnly
                ? {
                    status: {
                        in: [
                            client_1.SafetyWithdrawalStatus.ACTIVE,
                            client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE,
                        ],
                    },
                }
                : {}),
        };
        const rows = await this.prisma.safetyWithdrawal.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                cattle: {
                    select: { id: true, name: true, tagNumber: true, image: true },
                },
                healthCase: { select: { caseCode: true } },
                treatmentLog: { select: { medicineName: true } },
            },
        });
        const projected = rows.map((row) => ({
            ...row,
            medicineName: row.treatmentLog?.medicineName ?? null,
            caseCode: row.healthCase.caseCode,
            milkDaysRemaining: this.daysRemaining(row.milkWithdrawalUntil),
            meatDaysRemaining: this.daysRemaining(row.meatWithdrawalUntil),
        }));
        return (0, pagination_1.toCursorPage)(projected, query);
    }
    async refreshSafetyWithdrawals(farmId) {
        return this.sweepWithdrawalsReadyForRelease(farmId);
    }
    async sweepWithdrawalsReadyForRelease(farmId) {
        const now = new Date();
        const result = await this.prisma.safetyWithdrawal.updateMany({
            where: {
                ...(farmId ? { farmId } : {}),
                status: client_1.SafetyWithdrawalStatus.ACTIVE,
                OR: [
                    { milkWithdrawalUntil: { lte: now } },
                    { meatWithdrawalUntil: { lte: now } },
                ],
            },
            data: { status: client_1.SafetyWithdrawalStatus.READY_FOR_RELEASE },
        });
        return { updated: result.count };
    }
    async releaseWithdrawal(farmId, id, releasedBy) {
        const withdrawal = await this.prisma.safetyWithdrawal.findFirst({
            where: { id, farmId },
        });
        if (!withdrawal) {
            throw new common_1.NotFoundException('Safety withdrawal not found');
        }
        if (withdrawal.status === client_1.SafetyWithdrawalStatus.RELEASED) {
            return withdrawal;
        }
        if (withdrawal.status === client_1.SafetyWithdrawalStatus.CANCELLED) {
            throw new common_1.BadRequestException('Cannot release a cancelled safety withdrawal');
        }
        const updated = await this.prisma.safetyWithdrawal.update({
            where: { id },
            data: { status: client_1.SafetyWithdrawalStatus.RELEASED },
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.HEALTH_SAFETY,
            eventTitle: 'Safety withdrawal released',
            actionDetails: `Milk/meat withholding released for safety withdrawal ${id} (was ${withdrawal.status}).`,
            actorId: releasedBy,
            relatedCattleId: withdrawal.cattleId,
        });
        return updated;
    }
    async createSafetyWithdrawalIfNeeded(tx, healthCase, treatmentLog, dto) {
        if (!dto.milkWithdrawalDays && !dto.meatWithdrawalDays)
            return null;
        const milkWithdrawalUntil = dto.milkWithdrawalDays
            ? this.addDays(treatmentLog.administeredAt, dto.milkWithdrawalDays)
            : undefined;
        const meatWithdrawalUntil = dto.meatWithdrawalDays
            ? this.addDays(treatmentLog.administeredAt, dto.meatWithdrawalDays)
            : undefined;
        const withdrawal = await tx.safetyWithdrawal.create({
            data: {
                farmId: healthCase.farmId,
                cattleId: healthCase.cattleId,
                healthCaseId: healthCase.id,
                treatmentLogId: treatmentLog.id,
                medicineId: treatmentLog.medicineId,
                milkWithdrawalUntil,
                meatWithdrawalUntil,
                safeMilkDate: milkWithdrawalUntil,
                safeMeatDate: meatWithdrawalUntil,
            },
        });
        await tx.healthCase.update({
            where: { id: healthCase.id },
            data: {
                isSafetyWithholdingActive: true,
                milkWithdrawalUntil,
                meatWithdrawalUntil,
            },
        });
        return withdrawal;
    }
    async updateCaseProgress(tx, healthCaseId) {
        const [healthCase, total, completed] = await Promise.all([
            tx.healthCase.findUniqueOrThrow({
                where: { id: healthCaseId },
                select: {
                    farmId: true,
                    cattleId: true,
                    caseCode: true,
                    healthPlanId: true,
                    status: true,
                },
            }),
            tx.healthTask.count({
                where: {
                    healthCaseId,
                    deletedAt: null,
                    status: { not: client_1.HealthTaskStatus.SKIPPED },
                },
            }),
            tx.healthTask.count({
                where: {
                    healthCaseId,
                    status: client_1.HealthTaskStatus.COMPLETED,
                    deletedAt: null,
                },
            }),
        ]);
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const shouldAutoClose = total > 0 &&
            completed === total &&
            healthCase.healthPlanId !== null &&
            ACTIVE_CASE_STATUSES.includes(healthCase.status);
        await tx.healthCase.update({
            where: { id: healthCaseId },
            data: shouldAutoClose
                ? {
                    totalSteps: total,
                    currentStep: completed,
                    progressPercentage: 100,
                    status: client_1.HealthCaseStatus.CLOSED,
                    closedDate: new Date(),
                    closeReason: 'protocol_completed',
                    deletedAt: new Date(),
                }
                : {
                    totalSteps: total,
                    currentStep: completed,
                    progressPercentage: progress,
                },
        });
        return shouldAutoClose
            ? {
                farmId: healthCase.farmId,
                cattleId: healthCase.cattleId,
                caseCode: healthCase.caseCode,
            }
            : null;
    }
    async updateEnrollmentProgress(tx, planEnrollmentId) {
        const [total, completed] = await Promise.all([
            tx.healthTask.count({
                where: {
                    planEnrollmentId,
                    deletedAt: null,
                    status: { not: client_1.HealthTaskStatus.SKIPPED },
                },
            }),
            tx.healthTask.count({
                where: {
                    planEnrollmentId,
                    status: client_1.HealthTaskStatus.COMPLETED,
                    deletedAt: null,
                },
            }),
        ]);
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        await tx.planEnrollment.update({
            where: { id: planEnrollmentId },
            data: {
                totalSteps: total,
                currentStep: completed,
                progressPercentage: progress,
                status: total > 0 && completed === total
                    ? client_1.PlanEnrollmentStatus.COMPLETED
                    : client_1.PlanEnrollmentStatus.ACTIVE,
            },
        });
    }
    async notifyCaseAutoClosed(autoClosed, actorId) {
        if (!autoClosed)
            return;
        await this.aqrService.applyEvent(autoClosed.farmId, autoClosed.cattleId, 'recovered', {
            actorId,
            actionDetails: `Case [${autoClosed.caseCode}] auto-closed — protocol completed.`,
        });
        this.log.info('Health case auto-closed on protocol completion', {
            caseCode: autoClosed.caseCode,
            farmId: autoClosed.farmId,
        });
    }
    async getCaseOrThrow(farmId, id) {
        const healthCase = await this.prisma.healthCase.findFirst({
            where: { id, farmId, deletedAt: null },
        });
        if (!healthCase)
            throw new common_1.NotFoundException('Health case not found');
        return healthCase;
    }
    async getTaskOrThrow(farmId, id) {
        const task = await this.prisma.healthTask.findFirst({
            where: { id, farmId, deletedAt: null },
        });
        if (!task)
            throw new common_1.NotFoundException('Health task not found');
        return task;
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
        });
        if (!cattle)
            throw new common_1.BadRequestException('Cattle must belong to Farm');
        return cattle;
    }
    async assertShedInFarm(farmId, shedId) {
        const shed = await this.prisma.shed.findFirst({
            where: { id: shedId, farmId, deletedAt: null },
        });
        if (!shed)
            throw new common_1.BadRequestException('Shed must belong to Farm');
        return shed;
    }
    caseInclude() {
        return {
            cattle: {
                select: {
                    id: true,
                    name: true,
                    tagNumber: true,
                    image: true,
                    herdStatus: true,
                },
            },
            healthPlan: { select: { id: true, name: true } },
        };
    }
    calculateHerdHealthScore(healthy, total) {
        if (total === 0)
            return 100;
        return Math.round((healthy / total) * 100);
    }
    async sumHealthExpense(farmId) {
        const rows = await this.prisma.expense.findMany({
            where: { farmId, category: client_1.ExpenseCategory.HEALTH },
            select: { id: true, amount: true },
        });
        if (rows.length === 0)
            return 0;
        const journalTxns = await this.prisma.journalTransaction.findMany({
            where: {
                farmId,
                sourceType: 'EXPENSE',
                sourceId: { in: rows.map((r) => r.id) },
                reversalOfId: null,
            },
            select: { id: true, sourceId: true },
        });
        const journalIdByExpenseId = new Map(journalTxns.map((j) => [j.sourceId, j.id]));
        const reversals = await this.prisma.journalTransaction.findMany({
            where: { farmId, reversalOfId: { in: journalTxns.map((j) => j.id) } },
            select: { reversalOfId: true },
        });
        const reversedJournalIds = new Set(reversals.map((r) => r.reversalOfId));
        const unreversed = rows.filter((r) => {
            const journalId = journalIdByExpenseId.get(r.id);
            return !journalId || !reversedJournalIds.has(journalId);
        });
        return unreversed.reduce((sum, r) => sum + Number(r.amount), 0);
    }
    groupByDay(dates) {
        const grouped = new Map();
        for (const date of dates) {
            const key = date.toISOString().slice(0, 10);
            grouped.set(key, (grouped.get(key) ?? 0) + 1);
        }
        return [...grouped.entries()].map(([date, count]) => ({ date, count }));
    }
    groupTasksByDate(tasks) {
        const grouped = new Map();
        for (const task of tasks) {
            const key = task.dueDateTime.toISOString().slice(0, 10);
            const row = grouped.get(key) ?? {};
            row[task.status] = (row[task.status] ?? 0) + 1;
            grouped.set(key, row);
        }
        return [...grouped.entries()].map(([date, counts]) => ({ date, counts }));
    }
    dueNoEarlierThan(due, floor) {
        return floor && due < floor ? floor : due;
    }
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = HealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(10, (0, common_1.Optional)()),
    __param(11, (0, common_1.Optional)()),
    __param(12, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aqr_service_1.AqrService,
        activity_log_service_1.ActivityLogService,
        medicine_service_1.MedicineService,
        task_service_1.TaskService,
        notification_service_1.NotificationService,
        cattle_service_1.CattleService,
        expense_service_1.ExpenseService,
        logger_service_1.LoggerService,
        health_outcomes_service_1.HealthOutcomesService,
        protocol_stock_service_1.ProtocolStockService,
        farm_clock_service_1.FarmClockService,
        health_step_notification_producer_1.HealthStepNotificationProducer])
], HealthService);
//# sourceMappingURL=health.service.js.map