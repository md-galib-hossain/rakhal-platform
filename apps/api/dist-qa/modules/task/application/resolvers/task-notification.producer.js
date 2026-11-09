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
var TaskNotificationProducer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskNotificationProducer = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_scheduler_service_1 = require("src/modules/notification/application/services/notification-scheduler.service");
const audience_1 = require("src/modules/notification/domain/audience");
const schedule_math_1 = require("src/modules/notification/domain/schedule-math");
const task_source_resolver_1 = require("./task-source.resolver");
const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const ONE_DAY = 1440;
const IN_TX_ENQUEUE_DELAY_MS = 3000;
let TaskNotificationProducer = TaskNotificationProducer_1 = class TaskNotificationProducer {
    scheduler;
    prisma;
    farmClock;
    log;
    constructor(scheduler, prisma, farmClock, logger) {
        this.scheduler = scheduler;
        this.prisma = prisma;
        this.farmClock = farmClock;
        this.log = logger.setContext(TaskNotificationProducer_1.name);
    }
    get enabled() {
        return this.scheduler.enabled;
    }
    async keyOf(farmId, task) {
        if (!this.enabled || task.kind !== client_1.TaskKind.TASK)
            return null;
        return this.keyWith(await this.farmClock.timezone(farmId), task);
    }
    async sync(farmId, tasks, staleKeys = []) {
        if (!this.enabled)
            return;
        try {
            const timezone = await this.farmClock.timezone(farmId);
            const groups = new Map();
            const refresh = new Set(staleKeys.filter((k) => k !== null));
            for (const t of tasks) {
                if (t.kind !== client_1.TaskKind.TASK)
                    continue;
                const key = this.keyWith(timezone, t);
                if (OPEN.includes(t.status)) {
                    groups.set(key, [...(groups.get(key) ?? []), t]);
                }
                else {
                    refresh.add(key);
                }
            }
            const toEnqueue = [];
            for (const [sourceKey, members] of groups) {
                const result = await this.scheduler.upsertForSource(this.inputFor(farmId, timezone, sourceKey, members));
                if (result)
                    toEnqueue.push(...result.toEnqueue);
            }
            for (const key of groups.keys())
                refresh.delete(key);
            if (refresh.size > 0) {
                await this.scheduler.refreshSource(farmId, 'TASK', [...refresh]);
            }
            this.enqueue(toEnqueue);
        }
        catch (err) {
            this.warn('sync', err);
        }
    }
    async cancelKeys(farmId, keys) {
        const real = keys.filter((k) => k !== null);
        if (!this.enabled || real.length === 0)
            return;
        try {
            await this.scheduler.refreshSource(farmId, 'TASK', real);
        }
        catch (err) {
            this.warn('cancelKeys', err);
        }
    }
    async syncByIds(farmId, taskIds) {
        if (!this.enabled || taskIds.length === 0)
            return;
        const rows = await this.prisma.task.findMany({
            where: { id: { in: taskIds }, farmId },
            select: {
                id: true,
                kind: true,
                status: true,
                priority: true,
                safetyCritical: true,
                ruleKey: true,
                dueAt: true,
                assignedToId: true,
            },
        });
        await this.sync(farmId, rows);
    }
    keyWith(timezone, t) {
        return t.ruleKey
            ? (0, task_source_resolver_1.ruleTaskKey)(t.ruleKey, (0, farm_time_1.localDateIso)(timezone, t.dueAt))
            : (0, task_source_resolver_1.plainTaskKey)(t.id);
    }
    inputFor(farmId, timezone, sourceKey, members) {
        const first = members[0];
        const isRule = Boolean(first.ruleKey);
        const urgent = members.some((m) => m.priority === 'HIGH' || m.safetyCritical);
        const assignees = [
            ...new Set(members.flatMap((m) => (m.assignedToId ? [m.assignedToId] : []))),
        ];
        return {
            farmId,
            sourceType: 'TASK',
            sourceKey,
            anchorAt: (0, schedule_math_1.allDayAnchorFromYmd)((0, farm_time_1.localDateIso)(timezone, first.dueAt)),
            allDay: true,
            leadMinutes: isRule || urgent ? [ONE_DAY, 0] : [ONE_DAY],
            eventKey: 'scheduled_upcoming',
            category: 'operational',
            priority: urgent ? 'high' : 'medium',
            audienceHint: {
                userIds: assignees,
                roles: isRule || assignees.length === 0 ? [...audience_1.DEFAULT_SOURCE_ROLES] : [],
            },
        };
    }
    enqueue(ids) {
        if (ids.length === 0)
            return;
        const run = () => this.scheduler
            .enqueueAfterCommit(ids)
            .catch((err) => this.warn('enqueue', err));
        if (tx_context_1.txStore.getStore()) {
            setTimeout(() => tx_context_1.txStore.exit(() => void run()), IN_TX_ENQUEUE_DELAY_MS).unref();
        }
        else {
            void run();
        }
    }
    warn(where, err) {
        this.log.warn('Task notification hook failed', {
            where,
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
exports.TaskNotificationProducer = TaskNotificationProducer;
exports.TaskNotificationProducer = TaskNotificationProducer = TaskNotificationProducer_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notification_scheduler_service_1.NotificationScheduler,
        prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService,
        logger_service_1.LoggerService])
], TaskNotificationProducer);
//# sourceMappingURL=task-notification.producer.js.map