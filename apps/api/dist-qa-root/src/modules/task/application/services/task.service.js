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
var TaskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const task_status_1 = require("../../domain/task-status");
const reminder_cadence_1 = require("src/modules/animal-events/domain/reminder-cadence");
const task_notification_producer_1 = require("../resolvers/task-notification.producer");
const event_api_context_1 = require("src/modules/animal-events/application/event-api-context");
let TaskService = TaskService_1 = class TaskService {
    prisma;
    notifier;
    log;
    constructor(prisma, notifier, logger) {
        this.prisma = prisma;
        this.notifier = notifier;
        this.log = logger.setContext(TaskService_1.name);
    }
    async create(farmId, userId, dto) {
        await this.assertAssignee(farmId, dto.assignedToId);
        if (dto.relatedCattleId && dto.cattleIds?.length) {
            throw new common_1.BadRequestException('Provide either relatedCattleId or cattleIds, not both');
        }
        if (dto.cattleIds?.length) {
            await this.assertCattleIds(farmId, dto.cattleIds);
        }
        if (dto.kind === client_1.TaskKind.TASK && dto.category === client_1.TaskCategory.REMINDER) {
            throw new common_1.BadRequestException('kind TASK conflicts with the legacy category REMINDER');
        }
        const isReminder = dto.kind === client_1.TaskKind.REMINDER || dto.category === client_1.TaskCategory.REMINDER;
        const link = isReminder
            ? await this.resolveReminderLink(farmId, dto)
            : null;
        if (!isReminder && !dto.dueAt) {
            throw new common_1.BadRequestException('dueAt is required');
        }
        if (isReminder) {
            this.assertRepeat(dto, link.dueAt);
            await this.assertMembers(farmId, dto.recipientUserIds);
        }
        const relatedCattleId = dto.cattleIds?.length
            ? undefined
            : (dto.relatedCattleId ?? link?.cattleId);
        const created = await this.insert({
            farmId,
            createdBy: userId,
            name: dto.name,
            details: dto.details,
            category: this.topic(dto.category),
            kind: isReminder ? client_1.TaskKind.REMINDER : client_1.TaskKind.TASK,
            priority: dto.priority ?? client_1.TaskPriority.MEDIUM,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
            dueAt: link ? link.dueAt : new Date(dto.dueAt),
            recurring: dto.recurring ?? false,
            recurrenceType: dto.recurrenceType,
            recurrenceEndDate: dto.recurrenceEndDate
                ? new Date(dto.recurrenceEndDate)
                : null,
            safetyCritical: dto.safetyCritical ?? false,
            source: client_1.TaskSource.MANUAL,
            relatedCattleId,
            cattleIds: dto.cattleIds,
            assignedToId: dto.assignedToId,
            ...(isReminder
                ? {
                    remindDaysBefore: dto.remindDaysBefore,
                    notifyRoleNames: dto.notifyRoleNames,
                    recurrenceIntervalDays: dto.recurrenceIntervalDays,
                    recipientUserIds: dto.recipientUserIds,
                    ...(link?.sourceEventId
                        ? {
                            sourceEventType: 'ANIMAL_EVENT',
                            sourceEventId: link.sourceEventId,
                            reminderOffsetDays: dto.offsetDays,
                        }
                        : {}),
                }
                : {}),
        });
        await this.notifier.sync(farmId, [created]);
        return this.present(created);
    }
    async resolveReminderLink(farmId, dto) {
        if (dto.sourceEventId) {
            if (dto.dueAt) {
                throw new common_1.BadRequestException('Give either dueAt or sourceEventId with offsetDays, not both');
            }
            if (dto.offsetDays === undefined) {
                throw new common_1.BadRequestException('offsetDays is required with sourceEventId');
            }
            const ev = await this.prisma.animalEvent.findFirst({
                where: { id: dto.sourceEventId, farmId },
                select: { id: true, cattleId: true, eventAt: true, status: true },
            });
            if (!ev)
                throw new common_1.NotFoundException('Source event not found');
            if (ev.status === 'VOIDED') {
                throw new common_1.BadRequestException('The source event is voided');
            }
            return {
                dueAt: new Date(ev.eventAt.getTime() + dto.offsetDays * 86_400_000),
                sourceEventId: ev.id,
                cattleId: ev.cattleId,
            };
        }
        if (!dto.dueAt) {
            throw new common_1.BadRequestException('A reminder needs dueAt, or sourceEventId with offsetDays');
        }
        return { dueAt: new Date(dto.dueAt) };
    }
    assertRepeat(dto, firstDue) {
        if (!dto.recurring)
            return;
        if (!dto.recurrenceType) {
            throw new common_1.BadRequestException('recurrenceType is required when repeating');
        }
        if (dto.recurrenceType === client_1.TaskRecurrence.EVERY_N_DAYS &&
            !dto.recurrenceIntervalDays) {
            throw new common_1.BadRequestException('recurrenceIntervalDays is required for EVERY_N_DAYS');
        }
        if (dto.recurrenceEndDate &&
            new Date(dto.recurrenceEndDate).getTime() < firstDue.getTime()) {
            throw new common_1.BadRequestException('recurrenceEndDate must not be before the first due date');
        }
    }
    async assertMembers(farmId, userIds) {
        const unique = Array.from(new Set(userIds ?? []));
        if (!unique.length)
            return;
        const found = await this.prisma.farmMember.count({
            where: { farmId, userId: { in: unique } },
        });
        if (found !== unique.length) {
            throw new common_1.BadRequestException('Every recipient must be a member of this farm');
        }
    }
    async spawnNextReminder(taskId, now = new Date()) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: this.assigneeInclude(),
        });
        if (!task ||
            task.kind !== client_1.TaskKind.REMINDER ||
            !task.recurring ||
            !task.recurrenceType) {
            return null;
        }
        const claim = await this.prisma.task.updateMany({
            where: { id: taskId, spawnedNextAt: null },
            data: { spawnedNextAt: now },
        });
        if (claim.count === 0)
            return null;
        let nextDue = (0, reminder_cadence_1.nextOccurrence)(task.dueAt, task.recurrenceType, task.recurrenceIntervalDays);
        for (let i = 0; i < 400 && nextDue.getTime() < now.getTime() - 86_400_000; i++) {
            nextDue = (0, reminder_cadence_1.nextOccurrence)(nextDue, task.recurrenceType, task.recurrenceIntervalDays);
        }
        if (task.recurrenceEndDate &&
            nextDue.getTime() > task.recurrenceEndDate.getTime()) {
            return null;
        }
        return this.insert({
            farmId: task.farmId,
            createdBy: task.createdBy,
            name: task.name,
            details: task.details ?? undefined,
            category: task.category,
            kind: client_1.TaskKind.REMINDER,
            priority: task.priority,
            dueAt: nextDue,
            recurring: true,
            recurrenceType: task.recurrenceType,
            recurrenceEndDate: task.recurrenceEndDate,
            recurrenceIntervalDays: task.recurrenceIntervalDays ?? undefined,
            safetyCritical: task.safetyCritical,
            source: task.source,
            relatedCattleId: task.relatedCattleId ?? undefined,
            cattleIds: task.cattles.length
                ? task.cattles.map((c) => c.cattleId)
                : undefined,
            assignedToId: task.assignedToId ?? undefined,
            remindDaysBefore: task.remindDaysBefore ?? undefined,
            notifyRoleNames: task.notifyRoleNames,
            recipientUserIds: task.recipients.map((r) => r.userId),
        });
    }
    async createInternal(input) {
        if ((0, event_api_context_1.eventApiContext)()?.historical)
            return { id: 'historical-skipped' };
        await this.assertAssignee(input.farmId, input.assignedToId);
        const created = await this.insert({
            farmId: input.farmId,
            createdBy: input.createdBy,
            name: input.name,
            details: input.details,
            category: input.category,
            priority: input.priority ?? client_1.TaskPriority.MEDIUM,
            dueAt: input.dueAt,
            recurring: false,
            recurrenceType: null,
            recurrenceEndDate: null,
            safetyCritical: input.safetyCritical ?? false,
            source: input.source,
            relatedCattleId: input.relatedCattleId,
            assignedToId: input.assignedToId,
            sourceEventType: input.sourceEventType,
            sourceEventId: input.sourceEventId,
            followUpKey: input.followUpKey,
            ruleKey: input.ruleKey,
        });
        if (!input.skipNotify)
            await this.notifier.sync(input.farmId, [created]);
        return created;
    }
    async rescheduleBySourceEvent(farmId, sourceEventType, sourceEventId, newDueAt) {
        const tasks = await this.prisma.task.findMany({
            where: { farmId, sourceEventType, sourceEventId },
            select: { id: true, status: true },
        });
        const closedStatuses = [
            client_1.TaskStatus.COMPLETED,
            client_1.TaskStatus.CANCELLED,
        ];
        const pending = tasks.filter((t) => !closedStatuses.includes(t.status));
        const alreadyCompleted = tasks.filter((t) => closedStatuses.includes(t.status));
        if (pending.length > 0) {
            await this.prisma.task.updateMany({
                where: { id: { in: pending.map((t) => t.id) } },
                data: { dueAt: newDueAt },
            });
        }
        this.log.info('Tasks rescheduled by source event', {
            farmId,
            sourceEventType,
            sourceEventId,
            rescheduled: pending.length,
            alreadyCompleted: alreadyCompleted.length,
        });
        return {
            rescheduledTaskIds: pending.map((t) => t.id),
            alreadyCompletedTaskIds: alreadyCompleted.map((t) => t.id),
        };
    }
    async completeBySourceEvent(farmId, sourceEventType, sourceEventId, userId, note) {
        const tasks = await this.prisma.task.findMany({
            where: {
                farmId,
                sourceEventType,
                sourceEventId,
                status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
            },
            select: { id: true, details: true },
        });
        await Promise.all(tasks.map((t) => this.prisma.task.update({
            where: { id: t.id },
            data: {
                status: client_1.TaskStatus.COMPLETED,
                completedAt: new Date(),
                completedById: userId,
                details: note ? `${t.details ?? ''}\n${note}`.trim() : t.details,
            },
        })));
        this.log.info('Tasks completed by source event', {
            farmId,
            sourceEventType,
            sourceEventId,
            completed: tasks.length,
        });
        return { completedTaskIds: tasks.map((t) => t.id) };
    }
    async completeForCattle(farmId, cattleId, userId, note) {
        const tasks = await this.prisma.task.findMany({
            where: {
                farmId,
                relatedCattleId: cattleId,
                status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
            },
            select: { id: true, details: true },
        });
        await Promise.all(tasks.map((t) => this.prisma.task.update({
            where: { id: t.id },
            data: {
                status: client_1.TaskStatus.COMPLETED,
                completedAt: new Date(),
                completedById: userId,
                details: `${t.details ?? ''}\n${note}`.trim(),
            },
        })));
        this.log.info('Tasks closed on animal disposition', {
            farmId,
            cattleId,
            completed: tasks.length,
        });
        return { completedTaskIds: tasks.map((t) => t.id) };
    }
    async update(farmId, userId, id, dto) {
        const existing = await this.getOrThrow(farmId, id);
        if (dto.category === client_1.TaskCategory.REMINDER) {
            throw new common_1.BadRequestException('category REMINDER is deprecated and cannot be set on update; kind is not changeable');
        }
        await this.assertAssignee(farmId, dto.assignedToId);
        await this.assertMembers(farmId, dto.recipientUserIds);
        let dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
        let reminderOffsetDays;
        if (dto.offsetDays !== undefined) {
            if (existing.sourceEventType !== 'ANIMAL_EVENT' ||
                !existing.sourceEventId) {
                throw new common_1.BadRequestException('This reminder is not linked to an event');
            }
            const ev = await this.prisma.animalEvent.findFirst({
                where: { id: existing.sourceEventId, farmId },
                select: { eventAt: true },
            });
            if (!ev)
                throw new common_1.NotFoundException('Source event not found');
            dueAt = new Date(ev.eventAt.getTime() + dto.offsetDays * 86_400_000);
            reminderOffsetDays = dto.offsetDays;
        }
        else if (dueAt && existing.reminderOffsetDays !== null) {
            reminderOffsetDays = null;
        }
        const recurring = dto.recurring ?? existing.recurring;
        if (existing.kind === client_1.TaskKind.REMINDER && recurring) {
            this.assertRepeat({
                recurring,
                recurrenceType: dto.recurrenceType ?? existing.recurrenceType ?? undefined,
                recurrenceIntervalDays: dto.recurrenceIntervalDays ??
                    existing.recurrenceIntervalDays ??
                    undefined,
                recurrenceEndDate: dto.recurrenceEndDate,
            }, dueAt ?? existing.dueAt);
        }
        const oldKey = await this.notifier.keyOf(farmId, existing);
        const task = await this.prisma.task.update({
            where: { id },
            data: {
                name: dto.name,
                details: dto.details,
                category: dto.category ? this.topic(dto.category) : undefined,
                priority: dto.priority,
                status: dto.status,
                ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
                ...(dueAt ? { dueAt } : {}),
                ...(reminderOffsetDays !== undefined ? { reminderOffsetDays } : {}),
                assignedToId: dto.assignedToId,
                safetyCritical: dto.safetyCritical,
                remindDaysBefore: dto.remindDaysBefore,
                notifyRoleNames: dto.notifyRoleNames,
                recurring: dto.recurring,
                recurrenceType: dto.recurrenceType,
                recurrenceIntervalDays: dto.recurrenceIntervalDays,
                ...(dto.recurrenceEndDate
                    ? { recurrenceEndDate: new Date(dto.recurrenceEndDate) }
                    : {}),
                ...(dto.recipientUserIds
                    ? {
                        recipients: {
                            deleteMany: {},
                            create: [...new Set(dto.recipientUserIds)].map((userId) => ({
                                userId,
                            })),
                        },
                    }
                    : {}),
            },
            include: this.assigneeInclude(),
        });
        await this.recordAudit(id, client_1.TaskAuditAction.UPDATED, userId);
        await this.notifier.sync(farmId, [task], [oldKey]);
        this.log.info('Task updated', { taskId: id, farmId });
        return this.present(task);
    }
    async complete(farmId, userId, id, dto) {
        const existing = await this.getOrThrow(farmId, id);
        if (existing.status === client_1.TaskStatus.COMPLETED) {
            throw new common_1.BadRequestException('Task is already completed');
        }
        const task = await this.prisma.task.update({
            where: { id },
            data: {
                status: client_1.TaskStatus.COMPLETED,
                completedAt: new Date(),
                completedById: userId,
                completionPhotoUrl: dto.completionPhotoUrl,
                completionNote: dto.notes,
            },
            include: this.assigneeInclude(),
        });
        await this.recordAudit(id, client_1.TaskAuditAction.COMPLETED, userId, dto.notes ?? null);
        const next = await this.maybeCreateNextRecurrence(existing, userId);
        await this.notifier.sync(farmId, next ? [task, next] : [task]);
        this.log.info('Task completed', {
            taskId: id,
            farmId,
            nextRecurrenceCreated: Boolean(next),
        });
        const presented = await this.present(task);
        return {
            ...presented,
            nextRecurrenceCreated: Boolean(next),
            nextTaskId: next?.id ?? null,
        };
    }
    async reopen(farmId, userId, id) {
        const existing = await this.getOrThrow(farmId, id);
        if (existing.status !== client_1.TaskStatus.COMPLETED) {
            throw new common_1.BadRequestException('Task is not completed');
        }
        const task = await this.prisma.task.update({
            where: { id },
            data: {
                status: client_1.TaskStatus.PENDING,
                completedAt: null,
                completedById: null,
                completionPhotoUrl: null,
            },
            include: this.assigneeInclude(),
        });
        await this.recordAudit(id, client_1.TaskAuditAction.REOPENED, userId);
        await this.notifier.sync(farmId, [task]);
        this.log.info('Task reopened', { taskId: id, farmId });
        return this.present(task);
    }
    async cancel(farmId, userId, id, dto) {
        const existing = await this.getOrThrow(farmId, id);
        if (existing.status === client_1.TaskStatus.COMPLETED) {
            throw new common_1.BadRequestException('Cannot cancel a task that is already completed');
        }
        if (existing.status === client_1.TaskStatus.CANCELLED) {
            throw new common_1.BadRequestException('Task is already cancelled');
        }
        const task = await this.prisma.task.update({
            where: { id },
            data: {
                status: client_1.TaskStatus.CANCELLED,
                cancelledAt: new Date(),
                cancelledById: userId,
                completionNote: dto.notes,
            },
            include: this.assigneeInclude(),
        });
        await this.recordAudit(id, client_1.TaskAuditAction.CANCELLED, userId, dto.notes ?? null);
        await this.notifier.sync(farmId, [task]);
        this.log.info('Task cancelled', { taskId: id, farmId });
        return this.present(task);
    }
    async remove(farmId, id) {
        const existing = await this.getOrThrow(farmId, id);
        const key = await this.notifier.keyOf(farmId, existing);
        await this.prisma.task.delete({ where: { id } });
        await this.notifier.cancelKeys(farmId, [key]);
        this.log.info('Task deleted', { taskId: id, farmId });
        return { deleted: true };
    }
    async findAll(farmId, userId, query) {
        const now = new Date();
        const andClauses = [];
        if (query.cattleId) {
            andClauses.push({
                OR: [
                    { relatedCattleId: query.cattleId },
                    { cattles: { some: { cattleId: query.cattleId } } },
                ],
            });
        }
        if (query.status?.length) {
            andClauses.push({ status: { in: query.status } });
        }
        if (query.dueFrom || query.dueTo) {
            andClauses.push({
                dueAt: {
                    ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
                    ...(query.dueTo ? { lt: new Date(query.dueTo) } : {}),
                },
            });
        }
        if (query.search) {
            andClauses.push({
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { reference: { contains: query.search, mode: 'insensitive' } },
                ],
            });
        }
        const where = {
            farmId,
            ...this.filterClause(query.filter, userId, now),
            ...(query.kind ? { kind: this.kindOf(query.kind) } : {}),
            ...(query.recurring !== undefined ? { recurring: query.recurring } : {}),
            ...(query.category ? { category: query.category } : {}),
            ...(query.priority ? { priority: query.priority } : {}),
            ...(andClauses.length ? { AND: andClauses } : {}),
        };
        const rows = await this.prisma.task.findMany({
            where,
            orderBy: [{ dueAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: this.assigneeInclude(),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const [highlights, reminderHighlights] = query.cursor
            ? [undefined, undefined]
            : await Promise.all([
                this.highlights(farmId, now),
                this.reminderHighlights(farmId, now),
            ]);
        const cattleIds = page.items
            .flatMap((task) => [
            task.relatedCattleId,
            ...(task.cattles ?? []).map((c) => c.cattleId),
        ])
            .filter((id) => !!id);
        const actorIds = page.items
            .flatMap((task) => [
            task.createdBy,
            ...(task.history ?? []).map((h) => h.actorId),
        ])
            .filter((id) => !!id);
        const [cattleMap, actorMap] = await Promise.all([
            this.buildCattleLabelMap(farmId, cattleIds),
            this.buildUserNameMap(actorIds),
        ]);
        const items = await Promise.all(page.items.map((task) => this.present(task, cattleMap, actorMap)));
        return {
            items,
            meta: { ...page.meta, highlights, reminderHighlights },
        };
    }
    async findOne(farmId, id) {
        return this.present(await this.getOrThrow(farmId, id, true));
    }
    filterClause(filter, userId, now) {
        switch (filter) {
            case 'my_tasks':
                return { assignedToId: userId };
            case 'overdue':
                return {
                    status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
                    dueAt: { lt: now },
                };
            case 'upcoming':
                return {
                    status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
                    dueAt: { gte: now },
                };
            case 'blocked':
                return { status: client_1.TaskStatus.BLOCKED };
            default:
                return {};
        }
    }
    topic(category) {
        return !category || category === client_1.TaskCategory.REMINDER
            ? client_1.TaskCategory.GENERAL
            : category;
    }
    kindOf(kind) {
        return kind === 'reminder' ? client_1.TaskKind.REMINDER : client_1.TaskKind.TASK;
    }
    async reminderHighlights(farmId, now) {
        const open = {
            farmId,
            kind: client_1.TaskKind.REMINDER,
            status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
        };
        const [upcoming, overdue, repeating] = await Promise.all([
            this.prisma.task.count({ where: { ...open, dueAt: { gte: now } } }),
            this.prisma.task.count({ where: { ...open, dueAt: { lt: now } } }),
            this.prisma.task.count({ where: { ...open, recurring: true } }),
        ]);
        return { upcoming, overdue, repeating };
    }
    async highlights(farmId, now) {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [dueToday, overdue, blocked, completedThisMonth] = await Promise.all([
            this.prisma.task.count({
                where: {
                    farmId,
                    kind: client_1.TaskKind.TASK,
                    status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
                    dueAt: { gte: dayStart, lt: dayEnd },
                },
            }),
            this.prisma.task.count({
                where: {
                    farmId,
                    kind: client_1.TaskKind.TASK,
                    status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
                    dueAt: { lt: now },
                },
            }),
            this.prisma.task.count({
                where: { farmId, kind: client_1.TaskKind.TASK, status: client_1.TaskStatus.BLOCKED },
            }),
            this.prisma.task.findMany({
                where: {
                    farmId,
                    kind: client_1.TaskKind.TASK,
                    status: client_1.TaskStatus.COMPLETED,
                    completedAt: { gte: monthStart },
                },
                select: { dueAt: true, completedAt: true },
            }),
        ]);
        const late = completedThisMonth.filter((t) => t.completedAt && t.completedAt.getTime() > t.dueAt.getTime()).length;
        const lateRate = completedThisMonth.length > 0
            ? Math.round((late / completedThisMonth.length) * 1000) / 10
            : 0;
        return {
            dueToday,
            overdue,
            blocked,
            lateCompletionRatePct: lateRate,
        };
    }
    async insert(data) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const [{ max }] = await this.prisma.$queryRaw `
        SELECT max(cast(substring(reference from 5) as int))::int AS max
        FROM "Task"
        WHERE "farmId" = ${data.farmId} AND reference ~ '^TSK-[0-9]+$'`;
            const reference = `TSK-${String((max ?? 0) + 1 + attempt).padStart(3, '0')}`;
            try {
                const task = await this.prisma.task.create({
                    data: {
                        farmId: data.farmId,
                        reference,
                        name: data.name,
                        details: data.details,
                        category: data.category,
                        kind: data.kind ?? client_1.TaskKind.TASK,
                        priority: data.priority,
                        scheduledAt: data.scheduledAt,
                        dueAt: data.dueAt,
                        recurring: data.recurring,
                        recurrenceType: data.recurrenceType ?? null,
                        recurrenceEndDate: data.recurrenceEndDate ?? null,
                        safetyCritical: data.safetyCritical,
                        source: data.source,
                        relatedCattleId: data.relatedCattleId,
                        assignedToId: data.assignedToId,
                        sourceEventType: data.sourceEventType,
                        sourceEventId: data.sourceEventId,
                        followUpKey: data.followUpKey,
                        ruleKey: data.ruleKey,
                        remindDaysBefore: data.remindDaysBefore,
                        notifyRoleNames: data.notifyRoleNames ?? [],
                        reminderOffsetDays: data.reminderOffsetDays,
                        recurrenceIntervalDays: data.recurrenceIntervalDays,
                        createdBy: data.createdBy,
                    },
                });
                if (data.cattleIds?.length) {
                    await this.prisma.taskCattle.createMany({
                        data: data.cattleIds.map((cattleId) => ({
                            taskId: task.id,
                            cattleId,
                        })),
                    });
                }
                const recipientUserIds = [...new Set(data.recipientUserIds ?? [])];
                if (recipientUserIds.length) {
                    await this.prisma.taskRecipient.createMany({
                        data: recipientUserIds.map((userId) => ({
                            taskId: task.id,
                            userId,
                        })),
                    });
                }
                return {
                    ...task,
                    cattles: (data.cattleIds ?? []).map((cattleId) => ({ cattleId })),
                    recipients: recipientUserIds.map((userId) => ({ userId })),
                };
            }
            catch (error) {
                if (data.followUpKey && JSON.stringify(error).includes('followUpKey'))
                    throw error;
                if (this.isUniqueError(error))
                    continue;
                throw error;
            }
        }
        throw new common_1.BadRequestException('Could not allocate a task reference');
    }
    async maybeCreateNextRecurrence(task, userId) {
        if (!task.recurring || !task.recurrenceType)
            return null;
        if (task.kind === client_1.TaskKind.REMINDER) {
            return this.spawnNextReminder(task.id);
        }
        const nextDue = this.addInterval(task.dueAt, task.recurrenceType, task.recurrenceIntervalDays);
        if (task.recurrenceEndDate &&
            nextDue.getTime() > task.recurrenceEndDate.getTime()) {
            return null;
        }
        return this.insert({
            farmId: task.farmId,
            createdBy: userId,
            name: task.name,
            details: task.details ?? undefined,
            category: task.category,
            priority: task.priority,
            dueAt: nextDue,
            recurring: true,
            recurrenceType: task.recurrenceType,
            recurrenceEndDate: task.recurrenceEndDate,
            safetyCritical: task.safetyCritical,
            source: task.source,
            relatedCattleId: task.relatedCattleId ?? undefined,
            cattleIds: task.cattles.length
                ? task.cattles.map((c) => c.cattleId)
                : undefined,
            assignedToId: task.assignedToId ?? undefined,
        });
    }
    addInterval(date, type, intervalDays) {
        const next = new Date(date);
        if (type === client_1.TaskRecurrence.EVERY_N_DAYS) {
            next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
        }
        else if (type === client_1.TaskRecurrence.DAILY)
            next.setDate(next.getDate() + 1);
        else if (type === client_1.TaskRecurrence.WEEKLY)
            next.setDate(next.getDate() + 7);
        else
            next.setMonth(next.getMonth() + 1);
        return next;
    }
    async assertAssignee(farmId, assignedToId) {
        if (!assignedToId)
            return;
        const member = await this.prisma.farmMember.findUnique({
            where: { farmId_userId: { farmId, userId: assignedToId } },
            select: { id: true },
        });
        if (!member) {
            throw new common_1.BadRequestException('Assignee must be a member of this farm');
        }
    }
    async getOrThrow(farmId, id, withAssignee = false) {
        const task = await this.prisma.task.findFirst({
            where: { id, farmId },
            include: withAssignee ? this.assigneeInclude() : this.assigneeInclude(),
        });
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        return task;
    }
    assigneeInclude() {
        return {
            assignedTo: { select: { id: true, name: true } },
            cattles: { select: { cattleId: true } },
            recipients: { select: { userId: true } },
            history: {
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    action: true,
                    actorId: true,
                    note: true,
                    createdAt: true,
                },
            },
        };
    }
    async recordAudit(taskId, action, actorId, note) {
        await this.prisma.taskAuditLog.create({
            data: { taskId, action, actorId, note: note ?? null },
        });
    }
    async present(task, cattleMap, actorMap) {
        const now = new Date();
        const display = (0, task_status_1.displayStatus)(task.status, task.dueAt, now);
        const { cattles, recipients, history: historyRows, ...rest } = task;
        const cattleIds = [
            task.relatedCattleId,
            ...(cattles ?? []).map((c) => c.cattleId),
        ].filter((id) => !!id);
        const cMap = cattleMap ?? (await this.buildCattleLabelMap(task.farmId, cattleIds));
        const relatedCattle = task.relatedCattleId && cMap.has(task.relatedCattleId)
            ? { id: task.relatedCattleId, ...cMap.get(task.relatedCattleId) }
            : null;
        const cattleTags = (cattles ?? [])
            .filter((c) => cMap.has(c.cattleId))
            .map((c) => ({ id: c.cattleId, ...cMap.get(c.cattleId) }));
        const actorIds = [
            task.createdBy,
            ...(historyRows ?? []).map((h) => h.actorId),
        ].filter((id) => !!id);
        const aMap = actorMap ?? (await this.buildUserNameMap(actorIds));
        const history = [
            {
                id: 'created',
                action: 'CREATED',
                actorId: task.createdBy,
                actorName: aMap.get(task.createdBy) ?? null,
                note: null,
                createdAt: task.createdAt,
            },
            ...(historyRows ?? []).map((h) => ({
                id: h.id,
                action: h.action,
                actorId: h.actorId,
                actorName: h.actorId ? (aMap.get(h.actorId) ?? null) : null,
                note: h.note,
                createdAt: h.createdAt,
            })),
        ];
        return {
            ...rest,
            cattleIds: (cattles ?? []).map((c) => c.cattleId),
            recipientUserIds: (recipients ?? []).map((r) => r.userId),
            relatedCattle,
            cattleTags,
            history,
            displayStatus: display,
            overdueByHours: display === 'overdue'
                ? Math.floor((now.getTime() - task.dueAt.getTime()) / 3_600_000)
                : null,
        };
    }
    async buildCattleLabelMap(farmId, ids) {
        const unique = Array.from(new Set(ids));
        if (!unique.length) {
            return new Map();
        }
        const rows = await this.prisma.cattle.findMany({
            where: { id: { in: unique }, farmId },
            select: { id: true, tagNumber: true, name: true },
        });
        return new Map(rows.map((r) => [r.id, { tagNumber: r.tagNumber, name: r.name }]));
    }
    async buildUserNameMap(ids) {
        const unique = Array.from(new Set(ids));
        if (!unique.length)
            return new Map();
        const rows = await this.prisma.user.findMany({
            where: { id: { in: unique } },
            select: { id: true, name: true },
        });
        return new Map(rows.map((r) => [r.id, r.name]));
    }
    async assertCattleIds(farmId, cattleIds) {
        const unique = Array.from(new Set(cattleIds));
        const found = await this.prisma.cattle.findMany({
            where: {
                id: { in: unique },
                farmId,
                deletedAt: null,
                herdStatus: 'ACTIVE',
            },
            select: { id: true },
        });
        if (found.length !== unique.length) {
            throw new common_1.BadRequestException('One or more selected cows are not in this farm’s active herd');
        }
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.TaskService = TaskService;
exports.TaskService = TaskService = TaskService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_notification_producer_1.TaskNotificationProducer,
        logger_service_1.LoggerService])
], TaskService);
//# sourceMappingURL=task.service.js.map