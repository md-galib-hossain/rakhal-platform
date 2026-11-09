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
var ReportRetentionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRetentionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const object_storage_port_1 = require("../../../media/application/ports/object-storage.port");
const scheduling_constants_1 = require("./scheduling.constants");
let ReportRetentionService = ReportRetentionService_1 = class ReportRetentionService {
    prisma;
    storage;
    log;
    constructor(prisma, storage, logger) {
        this.prisma = prisma;
        this.storage = storage;
        this.log = logger.setContext(ReportRetentionService_1.name);
    }
    async cleanup(now, options = {}) {
        const batchSize = options.batchSize ?? scheduling_constants_1.RETENTION_BATCH;
        const maxBatches = options.maxBatches ?? scheduling_constants_1.RETENTION_MAX_BATCHES;
        const result = {
            considered: 0,
            deleted: 0,
            tombstoned: 0,
            storageFailures: 0,
            rowFailures: 0,
        };
        const graceCutoff = new Date(now.getTime() - scheduling_constants_1.RETENTION_SOFT_DELETE_GRACE_DAYS * scheduling_constants_1.DAY_MS);
        const failedCutoff = new Date(now.getTime() - scheduling_constants_1.RETENTION_FAILED_AGE_DAYS * scheduling_constants_1.DAY_MS);
        const tombstoneCutoff = new Date(now.getTime() - scheduling_constants_1.SCHEDULE_TOMBSTONE_DAYS * scheduling_constants_1.DAY_MS);
        let cursor;
        for (let batch = 0; batch < maxBatches; batch += 1) {
            const rows = await this.prisma.report.findMany({
                where: {
                    status: { not: 'PROCESSING' },
                    ...(options.farmIds ? { farmId: { in: options.farmIds } } : {}),
                    ...(cursor ? { id: { gt: cursor } } : {}),
                    OR: [
                        { deletedAt: null, expiresAt: { lt: now } },
                        { deletedAt: { lt: graceCutoff } },
                        { status: 'FAILED', createdAt: { lt: failedCutoff } },
                    ],
                    AND: [
                        {
                            OR: [
                                { origin: { not: 'SCHEDULED' } },
                                { periodEnd: { lt: tombstoneCutoff } },
                                { artifactKey: { not: null } },
                                { snapshot: { isNot: null } },
                            ],
                        },
                    ],
                },
                select: {
                    id: true,
                    artifactKey: true,
                    origin: true,
                    periodEnd: true,
                },
                orderBy: { id: 'asc' },
                take: batchSize,
            });
            if (rows.length === 0)
                break;
            cursor = rows[rows.length - 1].id;
            result.considered += rows.length;
            for (const row of rows) {
                if (row.artifactKey) {
                    try {
                        await this.storage.delete(row.artifactKey);
                    }
                    catch {
                        result.storageFailures += 1;
                        continue;
                    }
                }
                if (row.origin === 'SCHEDULED' && row.periodEnd >= tombstoneCutoff) {
                    try {
                        await this.prisma.reportSnapshot.deleteMany({
                            where: { reportId: row.id },
                        });
                        const { count } = await this.prisma.report.updateMany({
                            where: { id: row.id, status: { not: 'PROCESSING' } },
                            data: {
                                artifactKey: null,
                                artifactBytes: null,
                                artifactContentType: null,
                            },
                        });
                        result.tombstoned += count;
                    }
                    catch {
                        result.rowFailures += 1;
                    }
                    continue;
                }
                try {
                    const { count } = await this.prisma.report.deleteMany({
                        where: { id: row.id, status: { not: 'PROCESSING' } },
                    });
                    result.deleted += count;
                }
                catch {
                    result.rowFailures += 1;
                }
            }
            if (rows.length < batchSize)
                break;
        }
        if (result.storageFailures > 0 || result.rowFailures > 0) {
            this.log.warn('Report retention cleanup had failures', { ...result });
        }
        else {
            this.log.info('Report retention cleanup complete', { ...result });
        }
        return result;
    }
};
exports.ReportRetentionService = ReportRetentionService;
exports.ReportRetentionService = ReportRetentionService = ReportRetentionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(object_storage_port_1.OBJECT_STORAGE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], ReportRetentionService);
//# sourceMappingURL=report-retention.service.js.map