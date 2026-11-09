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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const task_notification_producer_1 = require("src/modules/task/application/resolvers/task-notification.producer");
const task_service_1 = require("src/modules/task/application/services/task.service");
const follow_up_rules_1 = require("../../domain/follow-up-rules");
const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const NOTIFY_SELECT = {
    id: true,
    farmId: true,
    kind: true,
    status: true,
    priority: true,
    safetyCritical: true,
    ruleKey: true,
    dueAt: true,
    assignedToId: true,
};
let FollowUpService = class FollowUpService {
    prisma;
    settings;
    tasks;
    notifier;
    constructor(prisma, settings, tasks, notifier) {
        this.prisma = prisma;
        this.settings = settings;
        this.tasks = tasks;
        this.notifier = notifier;
    }
    async defaults(farmId) {
        const s = await this.settings.getEffective(farmId);
        return {
            pregnancyCheckDays: s.reproPregnancyCheckDays,
            vwpDays: s.reproVwpDays,
            dryPeriodDays: s.reproDryPeriodTargetDays,
            closeUpDays: s.reproCloseUpWindowDays,
        };
    }
    async overrides(farmId) {
        const rows = await this.prisma.followUpRuleSetting.findMany({
            where: { farmId },
        });
        return Object.fromEntries(rows.map((r) => [
            r.ruleKey,
            { enabled: r.enabled, offsetDays: r.offsetDays },
        ]));
    }
    async plan(farmId, event, toggles = [], now = new Date()) {
        const [defaults, overrides] = await Promise.all([
            this.defaults(farmId),
            this.overrides(farmId),
        ]);
        return (0, follow_up_rules_1.planFollowUps)(event, defaults, overrides, now).map((item) => ({
            item,
            enabled: toggles.find((t) => t.ruleKey === item.ruleKey)?.enabled ??
                (item.defaultOn && !item.pastDue),
        }));
    }
    async preview(farmId, event, toggles = []) {
        return (await this.plan(farmId, event, toggles)).map(({ item, enabled }) => ({
            ruleKey: item.ruleKey,
            title: item.title,
            dueDate: item.dueDate.toISOString(),
            defaultOn: item.defaultOn && !item.pastDue,
            enabled: enabled && !item.pastDue,
            kind: item.kind,
        }));
    }
    async onEventSaved(args) {
        const { farmId, cattleId, eventId, event } = args;
        const completed = await this.completeFor(cattleId, event.type, eventId);
        const tag = (await this.prisma.cattle.findUnique({
            where: { id: cattleId },
            select: { tagNumber: true },
        }))?.tagNumber;
        const created = [];
        const newTaskIds = [];
        for (const { item, enabled } of await this.plan(farmId, event, args.toggles)) {
            if (item.kind !== 'TASK' || item.pastDue || !enabled)
                continue;
            const followUpKey = `${item.ruleKey}:${eventId}`;
            try {
                const task = await this.tasks.createInternal({
                    skipNotify: true,
                    farmId,
                    createdBy: args.userId,
                    name: `${item.title}${tag ? ` — ${tag}` : ''}`,
                    category: event.type === 'VACCINATION'
                        ? client_1.TaskCategory.HEALTHCARE
                        : client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: item.dueDate,
                    source: client_1.TaskSource.SYSTEM_AUTO,
                    relatedCattleId: cattleId,
                    sourceEventType: 'ANIMAL_EVENT',
                    sourceEventId: eventId,
                    followUpKey,
                    ruleKey: item.ruleKey,
                });
                created.push(item.ruleKey);
                newTaskIds.push(task.id);
            }
            catch (error) {
                const existing = await this.prisma.task.findFirst({
                    where: { farmId, followUpKey, status: { in: [...OPEN] } },
                    select: { id: true },
                });
                if (!existing)
                    throw error;
            }
        }
        if (args.taskSink)
            args.taskSink.push(...newTaskIds);
        else
            await this.notifier.syncByIds(farmId, newTaskIds);
        return { created, completed };
    }
    async completeFor(cattleId, type, exceptEventId) {
        const keys = (0, follow_up_rules_1.rulesCompletedBy)(type);
        if (!keys.length)
            return 0;
        const rows = await this.prisma.task.findMany({
            where: {
                relatedCattleId: cattleId,
                ruleKey: { in: keys },
                status: { in: [...OPEN] },
                NOT: { sourceEventId: exceptEventId },
            },
            select: NOTIFY_SELECT,
        });
        if (!rows.length)
            return 0;
        const res = await this.prisma.task.updateMany({
            where: { id: { in: rows.map((r) => r.id) }, status: { in: [...OPEN] } },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await this.notifier.sync(rows[0].farmId, rows.map((r) => ({ ...r, status: 'COMPLETED' })));
        return res.count;
    }
    async cancelForEvent(eventId, opts = {}) {
        const where = {
            sourceEventType: 'ANIMAL_EVENT',
            sourceEventId: eventId,
            status: { in: [...OPEN] },
            ...(opts.keepReminders ? { kind: { not: client_1.TaskKind.REMINDER } } : {}),
        };
        const rows = await this.prisma.task.findMany({
            where,
            select: NOTIFY_SELECT,
        });
        if (!rows.length)
            return 0;
        const res = await this.prisma.task.updateMany({
            where: { id: { in: rows.map((r) => r.id) }, status: { in: [...OPEN] } },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await this.notifier.sync(rows[0].farmId, rows.map((r) => ({ ...r, status: 'CANCELLED' })));
        return res.count;
    }
    async moveReminders(eventId, newEventAt) {
        const reminders = await this.prisma.task.findMany({
            where: {
                sourceEventType: 'ANIMAL_EVENT',
                sourceEventId: eventId,
                kind: client_1.TaskKind.REMINDER,
                reminderOffsetDays: { not: null },
                status: { in: [...OPEN] },
            },
            select: { id: true, reminderOffsetDays: true },
        });
        for (const r of reminders) {
            await this.prisma.task.update({
                where: { id: r.id },
                data: {
                    dueAt: new Date(newEventAt.getTime() + (r.reminderOffsetDays ?? 0) * 86_400_000),
                },
            });
        }
        return reminders.length;
    }
    async listRules(farmId) {
        const [defaults, overrides] = await Promise.all([
            this.defaults(farmId),
            this.overrides(farmId),
        ]);
        return follow_up_rules_1.FOLLOW_UP_RULES.map((r) => {
            const o = overrides[r.key];
            return {
                ruleKey: r.key,
                title: r.title,
                kind: r.kind,
                trigger: r.trigger,
                enabled: o?.enabled ?? r.defaultOn,
                defaultOn: r.defaultOn,
                offsetDays: o?.offsetDays ?? r.defaultOffsetDays(defaults),
                defaultOffsetDays: r.defaultOffsetDays(defaults),
                completesOn: r.completesOn,
            };
        });
    }
    async updateRules(farmId, items) {
        for (const i of items) {
            if (!(0, follow_up_rules_1.ruleByKey)(i.ruleKey))
                continue;
            await this.prisma.followUpRuleSetting.upsert({
                where: { farmId_ruleKey: { farmId, ruleKey: i.ruleKey } },
                create: {
                    farmId,
                    ruleKey: i.ruleKey,
                    enabled: i.enabled ?? true,
                    offsetDays: i.offsetDays ?? null,
                },
                update: {
                    ...(i.enabled !== undefined ? { enabled: i.enabled } : {}),
                    ...(i.offsetDays !== undefined ? { offsetDays: i.offsetDays } : {}),
                },
            });
        }
        return this.listRules(farmId);
    }
};
exports.FollowUpService = FollowUpService;
exports.FollowUpService = FollowUpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_settings_service_1.FarmSettingsService,
        task_service_1.TaskService,
        task_notification_producer_1.TaskNotificationProducer])
], FollowUpService);
//# sourceMappingURL=follow-up.service.js.map