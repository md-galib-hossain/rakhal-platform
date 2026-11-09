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
var CalfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalfService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const task_service_1 = require("src/modules/task/application/services/task.service");
const animal_category_1 = require("src/modules/cattle/domain/animal-category");
const calf_stage_1 = require("../../domain/calf-stage");
const calf_care_schedule_1 = require("../../domain/calf-care-schedule");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const ACTIVE_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const WEANING_WEIGHT_TARGET_KG = 80;
let CalfService = CalfService_1 = class CalfService {
    prisma;
    taskService;
    log;
    constructor(prisma, taskService, logger) {
        this.prisma = prisma;
        this.taskService = taskService;
        this.log = logger.setContext(CalfService_1.name);
    }
    async scheduleCareReminders(input) {
        const schedule = (0, calf_care_schedule_1.buildCalfCareSchedule)(input.birthDate, input.gender);
        for (const item of schedule) {
            await this.taskService.createInternal({
                farmId: input.farmId,
                createdBy: input.createdBy,
                name: item.name,
                details: item.details,
                category: client_1.TaskCategory.CALF_CARE,
                priority: client_1.TaskPriority.MEDIUM,
                dueAt: item.dueAt,
                source: client_1.TaskSource.SYSTEM_AUTO,
                relatedCattleId: input.calfId,
                sourceEventType: input.sourceEventId ? 'CALVING_EVENT' : undefined,
                sourceEventId: input.sourceEventId,
            });
        }
        this.log.info('Calf care schedule generated', {
            calfId: input.calfId,
            farmId: input.farmId,
            tasks: schedule.length,
        });
        return schedule.length;
    }
    async list(farmId, query) {
        const now = new Date();
        const where = {
            ...(0, herd_scope_1.activeHerd)(farmId),
            calfWeaningRecord: null,
            ...(0, animal_category_1.buildAnimalCategoryWhere)('CALF', now),
            ...(query.stage ? { dateOfBirth: (0, calf_stage_1.stageDobRange)(query.stage, now) } : {}),
        };
        const rows = await this.prisma.cattle.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { mother: { select: this.summarySelect() } },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const enriched = await this.enrichCalves(page.items, now);
        const items = query.healthStatus
            ? enriched.filter((calf) => calf.healthStatus === query.healthStatus)
            : enriched;
        const kpis = await this.dashboardKpis(farmId, now);
        return { items, meta: { ...page.meta, kpis } };
    }
    async profile(farmId, id) {
        const calf = await this.prisma.cattle.findFirst({
            where: { id, farmId },
            include: { mother: { select: this.summarySelect() } },
        });
        if (!calf) {
            throw new common_1.NotFoundException('Calf not found');
        }
        const now = new Date();
        const ageDays = calf.dateOfBirth ? (0, calf_stage_1.ageInDays)(calf.dateOfBirth, now) : null;
        const [birth, colostrum, milk, weights, starter, weaning, tasks] = await Promise.all([
            this.prisma.calfBirth.findFirst({
                where: { calfId: id },
                include: { calvingEvent: { select: { calvingEase: true } } },
            }),
            this.prisma.calfColostrumRecord.findMany({
                where: { calfId: id },
                orderBy: { feedNumber: 'asc' },
            }),
            this.prisma.calfMilkFeeding.findMany({
                where: { calfId: id },
                orderBy: { date: 'desc' },
            }),
            this.prisma.calfWeightRecord.findMany({
                where: { calfId: id },
                orderBy: { measuredDate: 'asc' },
            }),
            this.prisma.calfStarterFeedRecord.findMany({
                where: { calfId: id },
                orderBy: { date: 'asc' },
            }),
            this.prisma.calfWeaningRecord.findFirst({ where: { calfId: id } }),
            this.prisma.task.findMany({
                where: {
                    farmId,
                    relatedCattleId: id,
                    status: { not: 'COMPLETED' },
                },
                orderBy: { dueAt: 'asc' },
                select: { id: true, name: true, dueAt: true, category: true },
            }),
        ]);
        const birthWeightKg = birth?.birthWeight ? Number(birth.birthWeight) : null;
        const colostrum24h = colostrum
            .filter((c) => calf.dateOfBirth &&
            c.fedAt.getTime() - calf.dateOfBirth.getTime() <= calf_stage_1.DAY_MS)
            .reduce((sum, c) => sum + c.volumeMl, 0);
        return {
            id: calf.id,
            name: calf.name,
            tagNumber: calf.tagNumber,
            birthDate: calf.dateOfBirth,
            ageDays,
            gender: calf.gender,
            dam: calf.mother,
            birthWeightKg,
            birthEaseScore: birth?.calvingEvent?.calvingEase ?? null,
            colostrumRecords: colostrum,
            totalColostrum24hMl: colostrum24h,
            milkFeedingLog: milk.map((m) => ({
                ...m,
                totalMl: m.morningMl + m.eveningMl,
            })),
            weightRecords: weights.map((w) => ({
                date: w.measuredDate,
                weightKg: w.weightKg,
                adgToDate: calf.dateOfBirth && ageDays != null
                    ? (0, calf_stage_1.computeAdg)(birthWeightKg, w.weightKg, (0, calf_stage_1.ageInDays)(calf.dateOfBirth, w.measuredDate))
                    : null,
            })),
            starterFeed: {
                firstOfferedDate: starter.find((s) => s.eventType === client_1.CalfStarterEventType.FIRST_OFFERED)?.date ?? null,
                firstIntakeDate: starter.find((s) => s.eventType === client_1.CalfStarterEventType.FIRST_INTAKE)
                    ?.date ?? null,
                currentDailyIntakeG: [...starter]
                    .reverse()
                    .find((s) => s.eventType === client_1.CalfStarterEventType.DAILY_INTAKE)
                    ?.amountG ?? null,
            },
            weaningTargetDate: calf.dateOfBirth
                ? (0, calf_stage_1.weaningTargetDate)(calf.dateOfBirth)
                : null,
            weaningWeightTargetKg: WEANING_WEIGHT_TARGET_KG,
            weaningStatus: weaning ? 'weaned' : 'pending',
            weaningRecord: weaning,
            upcomingTasks: tasks,
        };
    }
    async recordColostrum(farmId, id, dto) {
        await this.assertCalf(farmId, id);
        const record = await this.prisma.calfColostrumRecord.create({
            data: {
                calfId: id,
                feedNumber: dto.feedNumber,
                fedAt: new Date(dto.fedAt),
                volumeMl: dto.volumeMl,
                quality: dto.quality,
                fedBy: dto.fedBy,
                notes: dto.notes,
            },
        });
        this.log.info('Colostrum recorded', { calfId: id, farmId });
        return record;
    }
    async recordMilkFeeding(farmId, id, dto) {
        await this.assertCalf(farmId, id);
        const morningMl = dto.morningMl ?? 0;
        const eveningMl = dto.eveningMl ?? 0;
        const record = await this.prisma.calfMilkFeeding.create({
            data: {
                calfId: id,
                date: new Date(dto.date),
                morningMl,
                eveningMl,
                type: dto.type ?? client_1.CalfMilkType.WHOLE_MILK,
                notes: dto.notes,
            },
        });
        this.log.info('Calf milk feeding recorded', { calfId: id, farmId });
        return { ...record, totalMl: morningMl + eveningMl };
    }
    async recordWeight(farmId, userId, id, dto) {
        const calf = await this.assertCalf(farmId, id);
        const record = await this.prisma.calfWeightRecord.create({
            data: {
                calfId: id,
                weightKg: dto.weightKg,
                measuredDate: new Date(dto.measuredDate),
                recordedBy: userId,
                notes: dto.notes,
            },
        });
        const birthWeightKg = await this.birthWeight(id);
        const adgToDate = calf.dateOfBirth
            ? (0, calf_stage_1.computeAdg)(birthWeightKg, dto.weightKg, (0, calf_stage_1.ageInDays)(calf.dateOfBirth, new Date(dto.measuredDate)))
            : null;
        this.log.info('Calf weight recorded', { calfId: id, farmId });
        return { ...record, adgToDate };
    }
    async recordStarterFeed(farmId, id, dto) {
        await this.assertCalf(farmId, id);
        const record = await this.prisma.calfStarterFeedRecord.create({
            data: {
                calfId: id,
                date: new Date(dto.date),
                eventType: dto.eventType,
                amountG: dto.amountG ?? 0,
                notes: dto.notes,
            },
        });
        this.log.info('Calf starter feed recorded', { calfId: id, farmId });
        return record;
    }
    async wean(farmId, id, dto) {
        const calf = await this.assertCalf(farmId, id);
        const existing = await this.prisma.calfWeaningRecord.findFirst({
            where: { calfId: id },
        });
        if (existing) {
            throw new common_1.BadRequestException('Calf is already weaned');
        }
        const weaningDate = new Date(dto.weaningDate);
        const birthWeightKg = await this.birthWeight(id);
        const adgAtWeaning = calf.dateOfBirth
            ? (0, calf_stage_1.computeAdg)(birthWeightKg, dto.weaningWeightKg ?? null, (0, calf_stage_1.ageInDays)(calf.dateOfBirth, weaningDate))
            : null;
        const record = await this.prisma.calfWeaningRecord.create({
            data: {
                calfId: id,
                weaningDate,
                weaningWeightKg: dto.weaningWeightKg,
                adgAtWeaning,
                notes: dto.notes,
            },
        });
        this.log.info('Calf weaned', { calfId: id, farmId });
        return {
            calfId: id,
            weaned: true,
            adgAtWeaning,
            productionStatusUpdatedTo: null,
            movedToCattleModule: true,
            removedFromCalfManagement: true,
            weaningRecord: record,
        };
    }
    async dashboardKpis(farmId, now) {
        const calfWhere = {
            ...(0, herd_scope_1.activeHerd)(farmId),
            calfWeaningRecord: null,
            ...(0, animal_category_1.buildAnimalCategoryWhere)('CALF', now),
        };
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + calf_stage_1.DAY_MS);
        const weaningFrom = new Date(now.getTime() - calf_stage_1.DEFAULT_WEANING_DAYS * calf_stage_1.DAY_MS);
        const weaningTo = new Date(now.getTime() - (calf_stage_1.DEFAULT_WEANING_DAYS - 7) * calf_stage_1.DAY_MS);
        const [totalCalves, fedTodayGroups, healthConcern, weaningDue] = await Promise.all([
            this.prisma.cattle.count({ where: calfWhere }),
            this.prisma.calfMilkFeeding.groupBy({
                by: ['calfId'],
                where: { calf: calfWhere, date: { gte: dayStart, lt: dayEnd } },
            }),
            this.prisma.cattle.count({
                where: {
                    ...calfWhere,
                    healthCases: {
                        some: { deletedAt: null, status: { in: ACTIVE_CASE_STATUSES } },
                    },
                },
            }),
            this.prisma.cattle.count({
                where: {
                    ...calfWhere,
                    dateOfBirth: { gte: weaningFrom, lte: weaningTo },
                },
            }),
        ]);
        return {
            totalCalves,
            fedToday: fedTodayGroups.length,
            healthConcern,
            weaningDueThisWeek: weaningDue,
        };
    }
    async enrichCalves(calves, now) {
        const ids = calves.map((c) => c.id);
        if (ids.length === 0)
            return [];
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + calf_stage_1.DAY_MS);
        const [births, weights, fedToday, concerns] = await Promise.all([
            this.prisma.calfBirth.findMany({
                where: { calfId: { in: ids } },
                select: { calfId: true, birthWeight: true },
            }),
            this.prisma.calfWeightRecord.findMany({
                where: { calfId: { in: ids } },
                orderBy: { measuredDate: 'desc' },
                select: { calfId: true, weightKg: true },
            }),
            this.prisma.calfMilkFeeding.groupBy({
                by: ['calfId'],
                where: { calfId: { in: ids }, date: { gte: dayStart, lt: dayEnd } },
            }),
            this.prisma.healthCase.groupBy({
                by: ['cattleId'],
                where: {
                    cattleId: { in: ids },
                    deletedAt: null,
                    status: { in: ACTIVE_CASE_STATUSES },
                },
            }),
        ]);
        const birthByCalf = new Map(births.map((b) => [
            b.calfId,
            b.birthWeight ? Number(b.birthWeight) : null,
        ]));
        const latestWeight = new Map();
        for (const w of weights) {
            if (!latestWeight.has(w.calfId))
                latestWeight.set(w.calfId, w.weightKg);
        }
        const fedSet = new Set(fedToday.map((f) => f.calfId));
        const concernSet = new Set(concerns.map((c) => c.cattleId));
        return calves.map((calf) => {
            const ageDays = calf.dateOfBirth
                ? (0, calf_stage_1.ageInDays)(calf.dateOfBirth, now)
                : null;
            const birthWeightKg = birthByCalf.get(calf.id) ?? null;
            const currentWeightKg = latestWeight.get(calf.id) ?? null;
            return {
                id: calf.id,
                name: calf.name,
                tagNumber: calf.tagNumber,
                ageDays,
                gender: calf.gender,
                stage: ageDays != null ? (0, calf_stage_1.stageForAge)(ageDays) : null,
                dam: calf.mother,
                birthWeightKg,
                currentWeightKg,
                adgKgDay: ageDays != null
                    ? (0, calf_stage_1.computeAdg)(birthWeightKg, currentWeightKg, ageDays)
                    : null,
                healthStatus: concernSet.has(calf.id) ? 'concern' : 'healthy',
                fedToday: fedSet.has(calf.id),
                weaningDueDate: calf.dateOfBirth
                    ? (0, calf_stage_1.weaningTargetDate)(calf.dateOfBirth)
                    : null,
            };
        });
    }
    async birthWeight(calfId) {
        const birth = await this.prisma.calfBirth.findFirst({
            where: { calfId },
            select: { birthWeight: true },
        });
        return birth?.birthWeight ? Number(birth.birthWeight) : null;
    }
    async assertCalf(farmId, id) {
        const calf = await this.prisma.cattle.findFirst({
            where: { id, ...(0, herd_scope_1.activeHerd)(farmId) },
            include: { calfWeaningRecord: true },
        });
        if (!calf) {
            throw new common_1.NotFoundException('Calf not found');
        }
        if (calf.calfWeaningRecord) {
            throw new common_1.BadRequestException('Animal is not an active calf (it has been weaned)');
        }
        return calf;
    }
    async getCattleOrThrow(farmId, id) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id, ...(0, herd_scope_1.activeHerd)(farmId) },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Calf not found');
        }
        return cattle;
    }
    summarySelect() {
        return {
            id: true,
            name: true,
            tagNumber: true,
        };
    }
};
exports.CalfService = CalfService;
exports.CalfService = CalfService = CalfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_service_1.TaskService,
        logger_service_1.LoggerService])
], CalfService);
//# sourceMappingURL=calf.service.js.map