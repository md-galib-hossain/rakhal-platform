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
var ChannelRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelRouterService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_events_1 = require("../../domain/notification-events");
const ALL_CHANNELS = [
    'in_app',
    'push',
    'sms',
    'whatsapp',
    'telegram',
    'email',
];
let ChannelRouterService = ChannelRouterService_1 = class ChannelRouterService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ChannelRouterService_1.name);
    }
    async resolveChannels(eventKey, category, farmId) {
        const rules = await this.prisma.notificationRoutingRule.findMany({
            where: {
                enabled: true,
                OR: [
                    { scope: client_1.RoutingScope.FARM, farmId, eventKey },
                    { scope: client_1.RoutingScope.FARM, farmId, eventKey: null, category },
                    { scope: client_1.RoutingScope.GLOBAL, eventKey },
                    { scope: client_1.RoutingScope.GLOBAL, eventKey: null, category },
                ],
            },
        });
        const pick = rules.find((r) => r.scope === 'FARM' && r.eventKey === eventKey) ??
            rules.find((r) => r.scope === 'FARM' && r.eventKey === null && r.category === category) ??
            rules.find((r) => r.scope === 'GLOBAL' && r.eventKey === eventKey) ??
            rules.find((r) => r.scope === 'GLOBAL' &&
                r.eventKey === null &&
                r.category === category);
        if (pick)
            return this.toChannels(pick.channels);
        return (0, notification_events_1.getEvent)(eventKey)?.defaultChannels ?? this.toChannels([]);
    }
    async getFarmRouting(farmId) {
        const farmRules = await this.prisma.notificationRoutingRule.findMany({
            where: { scope: client_1.RoutingScope.FARM, farmId },
            select: { eventKey: true },
        });
        const overridden = new Set(farmRules.map((r) => r.eventKey).filter((k) => Boolean(k)));
        const events = await Promise.all(notification_events_1.NOTIFICATION_EVENTS.map(async (e) => ({
            event_key: e.key,
            label: e.label,
            category: e.category,
            can_disable: e.canDisable,
            channels: await this.resolveChannels(e.key, e.category, farmId),
            farm_override: overridden.has(e.key),
        })));
        return { events };
    }
    async setFarmRule(farmId, eventKey, channels) {
        const event = (0, notification_events_1.getEvent)(eventKey);
        if (!event) {
            throw new common_1.BadRequestException(`Unknown notification event: ${eventKey}`);
        }
        const valid = [...new Set(channels)].filter((c) => ALL_CHANNELS.includes(c));
        const existing = await this.prisma.notificationRoutingRule.findFirst({
            where: { scope: client_1.RoutingScope.FARM, farmId, eventKey },
        });
        if (existing) {
            await this.prisma.notificationRoutingRule.update({
                where: { id: existing.id },
                data: { channels: valid, enabled: true },
            });
        }
        else {
            await this.prisma.notificationRoutingRule.create({
                data: { scope: client_1.RoutingScope.FARM, farmId, eventKey, channels: valid },
            });
        }
        this.log.info('Farm routing rule set', {
            farmId,
            eventKey,
            channels: valid,
        });
        return this.getFarmRouting(farmId);
    }
    async deleteFarmRule(farmId, eventKey) {
        await this.prisma.notificationRoutingRule.deleteMany({
            where: { scope: client_1.RoutingScope.FARM, farmId, eventKey },
        });
        return this.getFarmRouting(farmId);
    }
    toChannels(arr) {
        return {
            in_app: true,
            push: arr.includes('push'),
            sms: arr.includes('sms'),
            whatsapp: arr.includes('whatsapp'),
            telegram: arr.includes('telegram'),
            email: arr.includes('email'),
        };
    }
};
exports.ChannelRouterService = ChannelRouterService;
exports.ChannelRouterService = ChannelRouterService = ChannelRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ChannelRouterService);
//# sourceMappingURL=channel-router.service.js.map