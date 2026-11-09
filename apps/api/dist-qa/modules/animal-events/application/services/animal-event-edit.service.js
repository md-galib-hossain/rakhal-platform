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
var AnimalEventEditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalEventEditService = exports.AUTHOR_WINDOW_MS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const notification_scheduler_service_1 = require("src/modules/notification/application/services/notification-scheduler.service");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const event_registry_1 = require("../../domain/event-registry");
const event_handler_1 = require("../event-handler");
const parse_payload_1 = require("../parse-payload");
const animal_event_types_service_1 = require("./animal-event-types.service");
const follow_up_service_1 = require("./follow-up.service");
exports.AUTHOR_WINDOW_MS = 24 * 60 * 60 * 1000;
const DATE_FIELD = {
    HEAT: { model: 'heatEvent', field: 'heatDateTime' },
    BREEDING: { model: 'breedingEvent', field: 'breedingDate' },
    PREG_CHECK: { model: 'pregnancyDiagnosis', field: 'diagnosisDate' },
    CALVING: { model: 'calvingEvent', field: 'calvingDate' },
    ABORTION: { model: 'abortionEvent', field: 'abortionDate' },
    DRY_OFF: { model: 'dryPeriod', field: 'startDate' },
    WEIGHT: { model: 'weightRecord', field: 'recordedDate' },
    BCS: { model: 'bodyConditionScore', field: 'recordedDate' },
    TREATMENT: { model: 'treatmentLog', field: 'administeredAt' },
    VACCINATION: { model: 'treatmentLog', field: 'administeredAt' },
    DEWORMING: { model: 'treatmentLog', field: 'administeredAt' },
    WEANING: { model: 'calfWeaningRecord', field: 'weaningDate' },
};
let AnimalEventEditService = AnimalEventEditService_1 = class AnimalEventEditService {
    prisma;
    handlers;
    followUps;
    permissions;
    activity;
    registry;
    scheduler;
    constructor(prisma, handlers, followUps, permissions, activity, registry, scheduler, logger) {
        this.prisma = prisma;
        this.handlers = handlers;
        this.followUps = followUps;
        this.permissions = permissions;
        this.activity = activity;
        this.registry = registry;
        this.scheduler = scheduler;
        this.log = logger.setContext(AnimalEventEditService_1.name);
    }
    log;
    async reanchor(eventId, newAt) {
        try {
            await this.scheduler.reanchor('ANIMAL_EVENT', eventId, newAt);
        }
        catch (err) {
            this.log.warn('Anchored schedule update failed', {
                eventId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async load(farmId, cattleId, eventId) {
        const ev = await this.prisma.animalEvent.findFirst({
            where: { id: eventId, farmId, cattleId },
        });
        if (!ev)
            throw new common_1.NotFoundException('Event not found');
        return ev;
    }
    async authorize(farmId, actor, ev) {
        const canVoid = await this.permissions.hasPermission(actor.userId, farmId, actor.permissionsVersion, ['cattle.event.void']);
        if (canVoid)
            return;
        const isAuthor = ev.recordedById === actor.userId;
        const inWindow = Date.now() - ev.createdAt.getTime() <= exports.AUTHOR_WINDOW_MS;
        if (!(isAuthor && inWindow)) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: 'Only the author within 24 hours, or a manager, can change this event',
                details: { eventCode: 'EVENT_EDIT_WINDOW_CLOSED' },
            });
        }
    }
    async void(farmId, actor, cattleId, eventId, reason) {
        const ev = await this.load(farmId, cattleId, eventId);
        if (ev.status === 'VOIDED') {
            throw (0, parse_payload_1.eventError)('EVENT_ALREADY_VOIDED', 'This event is already voided');
        }
        await this.authorize(farmId, actor, ev);
        const handler = this.handlers.get(ev.type);
        const detailReversed = await this.prisma.$transaction(async (tx) => tx_context_1.txStore.run({ tx }, async () => {
            const reversed = handler?.voidEvent
                ? await handler.voidEvent(ev.type, {
                    farmId,
                    userId: actor.userId,
                    cattleId,
                    animalEventId: ev.id,
                    reason,
                })
                : false;
            await tx.animalEvent.update({
                where: { id: ev.id },
                data: {
                    status: 'VOIDED',
                    voidedAt: ev.voidedAt ?? new Date(),
                    voidedById: actor.userId,
                    voidReason: reason,
                },
            });
            await this.followUps.cancelForEvent(ev.id);
            await this.handlers.recomputeAll(farmId, cattleId);
            return reversed;
        }), { timeout: 30_000, maxWait: 10_000 });
        await this.reanchor(ev.id, null);
        await this.audit(farmId, actor.userId, cattleId, 'Animal event voided', {
            before: { status: ev.status, eventAt: ev.eventAt, notes: ev.notes },
            after: { status: 'VOIDED', reason },
            type: ev.type,
        });
        return {
            event: await this.prisma.animalEvent.findUniqueOrThrow({
                where: { id: ev.id },
            }),
            detailReversed,
        };
    }
    async edit(farmId, actor, cattleId, eventId, input) {
        const ev = await this.load(farmId, cattleId, eventId);
        if (ev.status === 'VOIDED') {
            throw (0, parse_payload_1.eventError)('EVENT_ALREADY_VOIDED', 'A voided event cannot be edited');
        }
        await this.authorize(farmId, actor, ev);
        const newAt = input.eventAt ? new Date(input.eventAt) : null;
        if (newAt && newAt.getTime() > Date.now()) {
            throw (0, parse_payload_1.eventError)('EVENT_DATE_IN_FUTURE', 'eventAt cannot be in the future');
        }
        const moves = Boolean(newAt && newAt.getTime() !== ev.eventAt.getTime());
        const target = DATE_FIELD[ev.type];
        await this.prisma.$transaction(async (tx) => tx_context_1.txStore.run({ tx }, async () => {
            if (moves && newAt) {
                if (target) {
                    const delegate = tx[target.model];
                    await delegate.updateMany({
                        where: { animalEventId: ev.id },
                        data: { [target.field]: newAt },
                    });
                }
                await tx.animalEvent.update({
                    where: { id: ev.id },
                    data: { eventAt: newAt },
                });
            }
            if (input.notes !== undefined) {
                await tx.animalEvent.update({
                    where: { id: ev.id },
                    data: { notes: input.notes },
                });
            }
            if (moves && newAt) {
                await this.followUps.cancelForEvent(ev.id, {
                    keepReminders: true,
                });
                await this.followUps.moveReminders(ev.id, newAt);
                const rule = await this.ruleEventFor(ev.id, ev.type, newAt, ev.data);
                if (rule) {
                    await this.followUps.onEventSaved({
                        farmId,
                        userId: actor.userId,
                        cattleId,
                        eventId: ev.id,
                        event: rule,
                    });
                }
            }
            await this.handlers.recomputeAll(farmId, cattleId);
        }), { timeout: 30_000, maxWait: 10_000 });
        if (moves && newAt)
            await this.reanchor(ev.id, newAt);
        const after = await this.prisma.animalEvent.findUniqueOrThrow({
            where: { id: ev.id },
        });
        await this.audit(farmId, actor.userId, cattleId, 'Animal event edited', {
            before: { eventAt: ev.eventAt, notes: ev.notes },
            after: { eventAt: after.eventAt, notes: after.notes },
            type: ev.type,
        });
        return { event: after };
    }
    async ruleEventFor(eventId, type, eventAt, data) {
        const payload = (data && typeof data === 'object' && !Array.isArray(data) ? data : {});
        if (type === 'PREG_CHECK') {
            const d = await this.prisma.pregnancyDiagnosis.findFirst({
                where: { animalEventId: eventId },
                select: { result: true, expectedCalvingDate: true, gestationDay: true },
            });
            return {
                type: 'PREG_CHECK',
                eventAt,
                payload,
                result: d?.result,
                expectedCalvingDate: d?.expectedCalvingDate ??
                    (d?.gestationDay
                        ? new Date(eventAt.getTime() + (280 - d.gestationDay) * 86400000)
                        : null),
            };
        }
        if (['BREEDING', 'CALVING', 'HEAT', 'VACCINATION'].includes(type)) {
            return { type: type, eventAt, payload };
        }
        return null;
    }
    async audit(farmId, userId, cattleId, title, details) {
        await this.activity.record({
            farmId,
            module: client_1.ActivityLogModule.COW_MANAGEMENT,
            eventTitle: title,
            actionDetails: `${title} (${String(details.type)}).`,
            actorId: userId,
            relatedCattleId: cattleId,
            taggedValues: [
                { key: 'before', value: JSON.stringify(details.before) },
                { key: 'after', value: JSON.stringify(details.after) },
            ],
        });
    }
};
exports.AnimalEventEditService = AnimalEventEditService;
exports.AnimalEventEditService = AnimalEventEditService = AnimalEventEditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_handler_1.EventHandlerRegistry,
        follow_up_service_1.FollowUpService,
        permission_service_1.PermissionService,
        activity_log_service_1.ActivityLogService,
        event_registry_1.EventRegistry,
        notification_scheduler_service_1.NotificationScheduler,
        logger_service_1.LoggerService])
], AnimalEventEditService);
//# sourceMappingURL=animal-event-edit.service.js.map