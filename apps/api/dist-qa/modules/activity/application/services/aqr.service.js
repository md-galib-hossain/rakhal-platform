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
var AqrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AqrService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const aqr_config_service_1 = require("./aqr-config.service");
const activity_log_service_1 = require("./activity-log.service");
const event_api_context_1 = require("src/modules/animal-events/application/event-api-context");
let AqrService = AqrService_1 = class AqrService {
    prisma;
    activityLog;
    config;
    log;
    constructor(prisma, activityLog, config, logger) {
        this.prisma = prisma;
        this.activityLog = activityLog;
        this.config = config;
        this.log = logger.setContext(AqrService_1.name);
    }
    async applyEvent(farmId, cattleId, eventKey, options = {}) {
        if ((0, event_api_context_1.eventApiContext)()?.historical) {
            return { cattleId, eventKey, delta: null, aqrScore: null };
        }
        const def = await this.config.resolveEvent(farmId, eventKey);
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true, name: true, tagNumber: true, aqrScore: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
        const bounds = await this.config.resolveBounds(farmId);
        const newScore = def.nullify
            ? null
            : this.clamp((cattle.aqrScore ?? 0) + def.delta, bounds.min, bounds.max);
        await this.prisma.cattle.update({
            where: { id: cattleId },
            data: { aqrScore: newScore },
        });
        const label = cattle.name ?? cattle.tagNumber;
        await this.activityLog.record({
            farmId,
            module: def.module,
            eventTitle: def.title,
            actionDetails: options.actionDetails ?? `${def.title} for [${label}].`,
            aqrImpact: def.nullify ? null : def.delta,
            previousAqrScore: cattle.aqrScore,
            actorId: options.actorId ?? null,
            relatedCattleId: cattleId,
            taggedValues: options.taggedValues ?? [
                { key: 'cattle', value: label },
                { key: 'tag', value: cattle.tagNumber },
            ],
        });
        this.log.info('AQR event applied', {
            cattleId,
            farmId,
            eventKey,
            delta: def.delta,
            newScore,
        });
        return {
            cattleId,
            eventKey,
            delta: def.nullify ? null : def.delta,
            aqrScore: newScore,
        };
    }
    async reverseEvent(farmId, cattleId, activityLogId, options = {}) {
        const source = await this.prisma.activityLog.findFirst({
            where: { id: activityLogId, farmId, relatedCattleId: cattleId },
        });
        if (!source) {
            throw new common_1.NotFoundException('Activity log entry not found');
        }
        if (source.aqrImpact === null) {
            throw new common_1.BadRequestException('Activity log entry has no AQR impact to reverse');
        }
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true, name: true, tagNumber: true, aqrScore: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
        let newScore;
        if (source.previousAqrScore !== null && !options.relative) {
            newScore = source.previousAqrScore;
        }
        else if (options.relative) {
            const bounds = await this.config.resolveBounds(farmId);
            newScore = this.clamp((cattle.aqrScore ?? 0) - source.aqrImpact, bounds.min, bounds.max);
        }
        else {
            const bounds = await this.config.resolveBounds(farmId);
            newScore = this.clamp((cattle.aqrScore ?? 0) - source.aqrImpact, bounds.min, bounds.max);
            this.log.warn('Reversing pre-RAKHAL-304 AQR event with no previousAqrScore — using clamp(score - delta) approximation, may not restore the true prior value', { cattleId, farmId, activityLogId });
        }
        await this.prisma.cattle.update({
            where: { id: cattleId },
            data: { aqrScore: newScore },
        });
        const label = cattle.name ?? cattle.tagNumber;
        await this.activityLog.record({
            farmId,
            module: source.module,
            eventTitle: `Reversal: ${source.eventTitle}`,
            actionDetails: options.actionDetails ?? `Reversed AQR event for [${label}].`,
            aqrImpact: -source.aqrImpact,
            previousAqrScore: cattle.aqrScore,
            actorId: options.actorId ?? null,
            relatedCattleId: cattleId,
            taggedValues: [
                { key: 'cattle', value: label },
                { key: 'tag', value: cattle.tagNumber },
            ],
        });
        this.log.info('AQR event reversed', {
            cattleId,
            farmId,
            activityLogId,
            delta: -source.aqrImpact,
            newScore,
        });
        return {
            cattleId,
            sourceEventTitle: source.eventTitle,
            delta: -source.aqrImpact,
            aqrScore: newScore,
        };
    }
    async herdAqr(farmId) {
        const agg = await this.prisma.cattle.aggregate({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                aqrScore: { not: null },
            },
            _avg: { aqrScore: true },
        });
        return Math.round((agg._avg.aqrScore ?? 0) * 10) / 10;
    }
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
};
exports.AqrService = AqrService;
exports.AqrService = AqrService = AqrService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_log_service_1.ActivityLogService,
        aqr_config_service_1.AqrConfigService,
        logger_service_1.LoggerService])
], AqrService);
//# sourceMappingURL=aqr.service.js.map