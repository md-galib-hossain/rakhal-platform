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
var BcsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BcsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const cattle_constants_1 = require("../../domain/cattle.constants");
const herd_scope_1 = require("../../domain/herd-scope");
const bcs_alerts_1 = require("../../domain/bcs-alerts");
let BcsService = BcsService_1 = class BcsService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(BcsService_1.name);
    }
    async recordBcs(farmId, userId, cattleId, dto) {
        await this.assertCattleInFarm(farmId, cattleId);
        const recordedDate = dto.date ? new Date(dto.date) : new Date();
        const record = await this.prisma.bodyConditionScore.create({
            data: {
                cattleId,
                score: dto.score,
                recordedDate,
                recordedBy: userId,
                notes: dto.notes,
            },
        });
        const latest = await this.prisma.bodyConditionScore.findFirst({
            where: { cattleId },
            orderBy: [{ recordedDate: 'desc' }, { createdAt: 'desc' }],
            select: { score: true },
        });
        const lastBcs = latest?.score ?? dto.score;
        await this.prisma.cattle.update({
            where: { id: cattleId },
            data: { lastBcs },
        });
        const alerts = await this.computeAlerts(cattleId, dto.score, recordedDate);
        this.log.info('BCS recorded', {
            cattleId,
            farmId,
            score: dto.score,
            alerts: alerts.length,
        });
        return { record, lastBcs, alerts };
    }
    async history(farmId, cattleId, limit = 50) {
        await this.assertCattleInFarm(farmId, cattleId);
        return this.prisma.bodyConditionScore.findMany({
            where: { cattleId },
            orderBy: { recordedDate: 'desc' },
            take: limit,
        });
    }
    async computeAlerts(cattleId, score, recordedDate) {
        const windowStart = new Date(recordedDate);
        windowStart.setDate(windowStart.getDate() - cattle_constants_1.BCS_DROP_WINDOW_DAYS);
        const [pregnancy, prior] = await Promise.all([
            this.prisma.pregnancy.findFirst({
                where: { cattleId, status: client_1.PregnancyStatus.ACTIVE },
                orderBy: { conceptionDate: 'desc' },
                select: { expectedCalvingDate: true },
            }),
            this.prisma.bodyConditionScore.findFirst({
                where: {
                    cattleId,
                    recordedDate: { gte: windowStart, lt: recordedDate },
                },
                orderBy: { recordedDate: 'desc' },
                select: { score: true },
            }),
        ]);
        return (0, bcs_alerts_1.computeBcsAlerts)({
            score,
            recordedDate,
            expectedCalvingDate: pregnancy?.expectedCalvingDate,
            priorScore: prior?.score,
        });
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
    }
};
exports.BcsService = BcsService;
exports.BcsService = BcsService = BcsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], BcsService);
//# sourceMappingURL=bcs.service.js.map