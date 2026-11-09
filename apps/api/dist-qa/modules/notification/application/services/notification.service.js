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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_events_1 = require("../../domain/notification-events");
const QUIET_HOURS_SUPPRESSED = new Set([
    'push',
    'sms',
    'whatsapp',
    'telegram',
]);
const notification_delivery_service_1 = require("./notification-delivery.service");
const channel_router_service_1 = require("./channel-router.service");
const i18n_service_1 = require("src/common/i18n/i18n.service");
const language_1 = require("src/common/i18n/language");
let NotificationService = NotificationService_1 = class NotificationService {
    prisma;
    delivery;
    router;
    i18n;
    log;
    constructor(prisma, delivery, router, i18n, logger) {
        this.prisma = prisma;
        this.delivery = delivery;
        this.router = router;
        this.i18n = i18n;
        this.log = logger.setContext(NotificationService_1.name);
    }
    async notifyFarmRoles(input) {
        const members = await this.prisma.farmMember.findMany({
            where: { farmId: input.farmId, role: { name: { in: input.roleNames } } },
            select: { userId: true },
        });
        return this.notifyUsers({
            farmId: input.farmId,
            userIds: members.map((m) => m.userId),
            eventKey: input.eventKey,
            title: input.title,
            message: input.message,
            link: input.link,
            params: input.params,
            dedupeKey: input.dedupeKey,
        });
    }
    notifyOwnersAndManagers(input) {
        return this.notifyFarmRoles({ ...input, roleNames: ['Owner', 'Manager'] });
    }
    async notifyUsers(input) {
        const event = (0, notification_events_1.getEvent)(input.eventKey);
        if (!event) {
            throw new Error(`Unknown notification event: ${input.eventKey}`);
        }
        let userIds = [...new Set(input.userIds)];
        if (userIds.length === 0)
            return [];
        if (input.dedupeKey) {
            const existing = await this.prisma.notification.findMany({
                where: { userId: { in: userIds }, dedupeKey: input.dedupeKey },
                select: { userId: true },
            });
            const seen = new Set(existing.map((e) => e.userId));
            userIds = userIds.filter((id) => !seen.has(id));
            if (userIds.length === 0)
                return [];
        }
        const [overrides, settings, languages] = await Promise.all([
            this.prisma.notificationPreference.findMany({
                where: { userId: { in: userIds }, eventKey: event.key },
            }),
            this.prisma.notificationSetting.findMany({
                where: { userId: { in: userIds } },
            }),
            this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, preferredLanguage: true },
            }),
        ]);
        const overrideByUser = new Map(overrides.map((o) => [o.userId, o]));
        const settingByUser = new Map(settings.map((s) => [s.userId, s]));
        const languageByUser = new Map(languages.map((u) => [
            u.id,
            u.preferredLanguage.toLowerCase(),
        ]));
        const nowHm = this.nowHm();
        const routed = await this.router.resolveChannels(event.key, event.category, input.farmId);
        const created = [];
        for (const userId of userIds) {
            const override = overrideByUser.get(userId);
            const enabled = event.canDisable ? (override?.enabled ?? true) : true;
            if (!enabled)
                continue;
            const channels = event.canDisable && override
                ? {
                    in_app: override.inApp,
                    push: override.push,
                    sms: override.sms,
                    whatsapp: override.whatsapp,
                    telegram: override.telegram,
                    email: override.email,
                }
                : routed;
            const setting = settingByUser.get(userId);
            const quiet = this.inQuietHours(nowHm, setting?.quietHoursStart ?? null, setting?.quietHoursEnd ?? null);
            const sent = [];
            const dispatch = [];
            if (channels.in_app)
                sent.push('in_app');
            for (const ch of (0, notification_events_1.externalChannels)(channels)) {
                if (quiet && QUIET_HOURS_SUPPRESSED.has(ch))
                    continue;
                sent.push(ch);
                dispatch.push(ch);
            }
            const lang = languageByUser.get(userId) ?? language_1.DEFAULT_LANGUAGE;
            const title = input.params
                ? this.i18n.translate(lang, `notification.${event.key}.title`, input.params)
                : input.title;
            const message = input.params
                ? this.i18n.translate(lang, `notification.${event.key}.message`, input.params)
                : input.message;
            const notification = await this.prisma.notification.create({
                data: {
                    farmId: input.farmId,
                    userId,
                    eventKey: event.key,
                    category: event.category,
                    priority: event.priority,
                    title,
                    message,
                    link: input.link,
                    params: input.params,
                    data: input.data,
                    channelsSent: sent,
                    dedupeKey: input.dedupeKey,
                },
            });
            created.push(notification);
            for (const ch of dispatch) {
                try {
                    await this.delivery.deliver(ch, {
                        userId,
                        eventKey: event.key,
                        category: event.category,
                        priority: event.priority,
                        title,
                        message,
                        link: input.link,
                    });
                }
                catch (err) {
                    this.log.warn('Channel dispatch threw', {
                        channel: ch,
                        err: err.message,
                    });
                }
            }
        }
        this.log.info('Notifications emitted', {
            eventKey: event.key,
            recipients: created.length,
        });
        return created;
    }
    async list(farmId, userId, query, lang = language_1.DEFAULT_LANGUAGE) {
        const baseWhere = { farmId, userId };
        const where = query.status === 'unread' ? { ...baseWhere, isRead: false } : baseWhere;
        const perPage = query.per_page;
        const offset = (query.page - 1) * perPage;
        const [unreadCount, total, rows] = await Promise.all([
            this.prisma.notification.count({
                where: { ...baseWhere, isRead: false },
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: perPage,
            }),
        ]);
        return {
            unread_count: unreadCount,
            notifications: rows.map((n) => {
                const params = this.asParams(n.params);
                return {
                    id: n.id,
                    type: n.category,
                    priority: n.priority,
                    title: params
                        ? this.i18n.translate(lang, `notification.${n.eventKey}.title`, params)
                        : n.title,
                    message: params
                        ? this.i18n.translate(lang, `notification.${n.eventKey}.message`, params)
                        : n.message,
                    link: n.link,
                    data: n.data ?? null,
                    read: n.isRead,
                    created_at: n.createdAt,
                };
            }),
            meta: { page: query.page, per_page: perPage, total },
        };
    }
    async markRead(farmId, userId, id) {
        const res = await this.prisma.notification.updateMany({
            where: { id, farmId, userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        if (res.count === 0) {
            const exists = await this.prisma.notification.findFirst({
                where: { id, farmId, userId },
                select: { id: true },
            });
            if (!exists)
                throw new common_1.NotFoundException('Notification not found');
        }
        return { id, read: true };
    }
    async markAllRead(farmId, userId) {
        const res = await this.prisma.notification.updateMany({
            where: { farmId, userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { updated: res.count };
    }
    async getPreferences(farmId, userId) {
        const [overrides, setting] = await Promise.all([
            this.prisma.notificationPreference.findMany({ where: { userId } }),
            this.prisma.notificationSetting.findFirst({ where: { userId } }),
        ]);
        const byKey = new Map(overrides.map((o) => [o.eventKey, o]));
        return {
            quiet_hours: {
                start: setting?.quietHoursStart ?? null,
                end: setting?.quietHoursEnd ?? null,
            },
            preferences: notification_events_1.NOTIFICATION_EVENTS.map((e) => {
                const o = byKey.get(e.key);
                const channels = o
                    ? {
                        in_app: o.inApp,
                        push: o.push,
                        sms: o.sms,
                        whatsapp: o.whatsapp,
                        telegram: o.telegram,
                        email: o.email,
                    }
                    : e.defaultChannels;
                return {
                    event_key: e.key,
                    label: e.label,
                    category: e.category,
                    can_disable: e.canDisable,
                    enabled: e.canDisable ? (o?.enabled ?? true) : true,
                    channels,
                };
            }),
        };
    }
    async updatePreferences(farmId, userId, dto) {
        if (dto.quiet_hours) {
            await this.prisma.notificationSetting.upsert({
                where: { userId },
                create: {
                    farmId,
                    userId,
                    quietHoursStart: dto.quiet_hours.start,
                    quietHoursEnd: dto.quiet_hours.end,
                },
                update: {
                    quietHoursStart: dto.quiet_hours.start,
                    quietHoursEnd: dto.quiet_hours.end,
                },
            });
        }
        for (const pref of dto.preferences ?? []) {
            const event = (0, notification_events_1.getEvent)(pref.event_key);
            if (!event || !(0, notification_events_1.isKnownEvent)(pref.event_key)) {
                throw new common_1.BadRequestException(`Unknown notification event: ${pref.event_key}`);
            }
            if (!event.canDisable && pref.enabled === false) {
                throw new common_1.BadRequestException(`"${event.label}" is a mandatory health & safety alert and cannot be disabled`);
            }
            const channels = pref.channels ?? event.defaultChannels;
            await this.prisma.notificationPreference.upsert({
                where: { userId_eventKey: { userId, eventKey: event.key } },
                create: {
                    farmId,
                    userId,
                    eventKey: event.key,
                    enabled: pref.enabled ?? true,
                    inApp: channels.in_app,
                    push: channels.push,
                    sms: channels.sms,
                    whatsapp: channels.whatsapp,
                    telegram: channels.telegram,
                    email: channels.email,
                },
                update: {
                    ...(pref.enabled !== undefined ? { enabled: pref.enabled } : {}),
                    ...(pref.channels
                        ? {
                            inApp: channels.in_app,
                            push: channels.push,
                            sms: channels.sms,
                            whatsapp: channels.whatsapp,
                            telegram: channels.telegram,
                            email: channels.email,
                        }
                        : {}),
                },
            });
        }
        return this.getPreferences(farmId, userId);
    }
    asParams(value) {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : null;
    }
    nowHm() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    inQuietHours(hm, start, end) {
        if (!start || !end)
            return false;
        if (start === end)
            return false;
        return start < end ? hm >= start && hm < end : hm >= start || hm < end;
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_delivery_service_1.NotificationDeliveryService,
        channel_router_service_1.ChannelRouterService,
        i18n_service_1.I18nService,
        logger_service_1.LoggerService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map