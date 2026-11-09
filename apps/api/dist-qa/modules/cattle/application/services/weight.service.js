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
var WeightService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeightService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let WeightService = WeightService_1 = class WeightService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(WeightService_1.name);
    }
    async recordWeight(farmId, userId, cattleId, dto) {
        await this.assertCattleInFarm(farmId, cattleId);
        const recordedDate = dto.date ? new Date(dto.date) : new Date();
        const record = await this.prisma.weightRecord.create({
            data: {
                cattleId,
                weightKg: dto.weightKg,
                recordedDate,
                recordedBy: userId,
                notes: dto.notes,
            },
        });
        const latest = await this.prisma.weightRecord.findFirst({
            where: { cattleId },
            orderBy: [{ recordedDate: 'desc' }, { createdAt: 'desc' }],
            select: { weightKg: true },
        });
        const lastWeightKg = latest?.weightKg ?? dto.weightKg;
        await this.prisma.cattle.update({
            where: { id: cattleId },
            data: { lastWeightKg },
        });
        this.log.info('Weight recorded', {
            cattleId,
            farmId,
            weightKg: dto.weightKg,
        });
        return { record, lastWeightKg };
    }
    async history(farmId, cattleId, limit = 50) {
        await this.assertCattleInFarm(farmId, cattleId);
        return this.prisma.weightRecord.findMany({
            where: { cattleId },
            orderBy: { recordedDate: 'desc' },
            take: limit,
        });
    }
    async periodHistory(farmId, cattleId, period = 'month') {
        await this.assertCattleInFarm(farmId, cattleId);
        const windowStart = this.periodWindowStart(period);
        const records = await this.prisma.weightRecord.findMany({
            where: { cattleId, recordedDate: { gte: windowStart } },
            orderBy: { recordedDate: 'asc' },
        });
        const byBucket = new Map();
        for (const record of records) {
            byBucket.set(this.bucketKey(record.recordedDate, period), record);
        }
        const points = [...byBucket.values()]
            .sort((a, b) => a.recordedDate.getTime() - b.recordedDate.getTime())
            .map((r) => ({
            date: r.recordedDate.toISOString(),
            weightKg: r.weightKg,
        }));
        return { period, points };
    }
    periodWindowStart(period) {
        const now = new Date();
        const DAY_MS = 24 * 60 * 60 * 1000;
        switch (period) {
            case 'day':
                return new Date(now.getTime() - 30 * DAY_MS);
            case 'week':
                return new Date(now.getTime() - 26 * 7 * DAY_MS);
            case 'year':
                return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
            case 'month':
            default:
                return new Date(now.getFullYear(), now.getMonth() - 11, 1);
        }
    }
    bucketKey(date, period) {
        if (period === 'day')
            return date.toISOString().slice(0, 10);
        if (period === 'year')
            return String(date.getUTCFullYear());
        if (period === 'month') {
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        }
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() - day + 1);
        return d.toISOString().slice(0, 10);
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
    }
};
exports.WeightService = WeightService;
exports.WeightService = WeightService = WeightService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], WeightService);
//# sourceMappingURL=weight.service.js.map