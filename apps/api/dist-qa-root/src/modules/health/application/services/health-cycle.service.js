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
var HealthCycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const health_service_1 = require("./health.service");
const protocol_stock_service_1 = require("./protocol-stock.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_BLOCKED_EVENT_KEY = 'health_cycle_blocked';
let HealthCycleService = HealthCycleService_1 = class HealthCycleService {
    prisma;
    health;
    farmClock;
    notifications;
    log;
    constructor(prisma, health, farmClock, notifications, logger) {
        this.prisma = prisma;
        this.health = health;
        this.farmClock = farmClock;
        this.notifications = notifications;
        this.log = logger.setContext(HealthCycleService_1.name);
    }
    async sweepAll() {
        const farms = await this.prisma.planEnrollment.findMany({
            where: {
                status: client_1.PlanEnrollmentStatus.COMPLETED,
                deletedAt: null,
                nextCycleCreatedAt: null,
                healthPlan: { deletedAt: null, cycleLengthDays: { gt: 0 } },
            },
            distinct: ['farmId'],
            select: { farmId: true },
        });
        let spawned = 0;
        for (const { farmId } of farms) {
            try {
                spawned += await this.sweepFarm(farmId);
            }
            catch (err) {
                this.log.error('Health cycle sweep failed for farm', { farmId, err });
            }
        }
        return spawned;
    }
    async sweepFarm(farmId) {
        const today = await this.farmClock.todayStart(farmId);
        const finished = await this.prisma.planEnrollment.findMany({
            where: {
                farmId,
                status: client_1.PlanEnrollmentStatus.COMPLETED,
                deletedAt: null,
                nextCycleCreatedAt: null,
                healthPlan: { deletedAt: null, cycleLengthDays: { gt: 0 } },
                cattle: { herdStatus: 'ACTIVE', deletedAt: null },
            },
            include: {
                healthPlan: { include: { steps: { orderBy: { dayNumber: 'asc' } } } },
                cattle: { select: { id: true, tagNumber: true, shedId: true } },
                planApplication: { select: { appliedBy: true } },
            },
            orderBy: { id: 'asc' },
        });
        let spawned = 0;
        for (const e of finished) {
            const length = e.healthPlan.cycleLengthDays;
            const nextStart = new Date(e.startDate.getTime() + length * DAY_MS);
            if (nextStart > today)
                continue;
            if (e.healthPlan.steps.length === 0)
                continue;
            try {
                const result = await this.health.applyCycleRepeat(farmId, e.planApplication.appliedBy, e.healthPlan, e.cattle, nextStart < today ? today : nextStart, { cycleNumber: e.cycleNumber + 1, repeatedFromId: e.id });
                await this.prisma.planEnrollment.update({
                    where: { id: e.id },
                    data: { nextCycleCreatedAt: new Date() },
                });
                if (result.appliedCount > 0)
                    spawned += 1;
            }
            catch (err) {
                if (err instanceof common_1.ConflictException &&
                    err.getResponse()?.details
                        ?.reason === protocol_stock_service_1.PROTOCOL_OUT_OF_STOCK) {
                    await this.notifyBlocked(farmId, e, today);
                    continue;
                }
                this.log.error('Cycle repeat failed', { enrollmentId: e.id, err });
            }
        }
        return spawned;
    }
    async notifyBlocked(farmId, e, today) {
        const ymd = today.toISOString().slice(0, 10);
        await this.notifications.notifyOwnersAndManagers({
            farmId,
            eventKey: CYCLE_BLOCKED_EVENT_KEY,
            title: 'Protocol Repeat Blocked',
            message: `${e.healthPlan.name} was due to repeat for ${e.cattle.tagNumber} but a medicine is out of stock. It retries daily once restocked.`,
            params: { label: e.healthPlan.name, tag: e.cattle.tagNumber },
            link: '/healthcare?healthTab=protocols',
            dedupeKey: `${CYCLE_BLOCKED_EVENT_KEY}:${e.id}:${ymd}`,
        });
    }
};
exports.HealthCycleService = HealthCycleService;
exports.HealthCycleService = HealthCycleService = HealthCycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        health_service_1.HealthService,
        farm_clock_service_1.FarmClockService,
        notification_service_1.NotificationService,
        logger_service_1.LoggerService])
], HealthCycleService);
//# sourceMappingURL=health-cycle.service.js.map