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
var ReportReconcileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportReconcileService = exports.REPORT_JOB_ENSURER = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const report_pipeline_constants_1 = require("./report-pipeline.constants");
exports.REPORT_JOB_ENSURER = Symbol('REPORT_JOB_ENSURER');
let ReportReconcileService = ReportReconcileService_1 = class ReportReconcileService {
    prisma;
    jobs;
    log;
    constructor(prisma, jobs, logger) {
        this.prisma = prisma;
        this.jobs = jobs;
        this.log = logger.setContext(ReportReconcileService_1.name);
    }
    async reconcile(now) {
        let requeued = 0;
        let failed = 0;
        const stale = await this.prisma.report.findMany({
            where: {
                status: 'PROCESSING',
                deletedAt: null,
                startedAt: {
                    lt: new Date(now.getTime() - report_pipeline_constants_1.REPORT_PROCESSING_LEASE_MS),
                },
            },
            select: { id: true, attempts: true, startedAt: true },
            orderBy: { startedAt: 'asc' },
            take: report_pipeline_constants_1.REPORT_RECONCILE_BATCH,
        });
        for (const row of stale) {
            const same = {
                id: row.id,
                status: 'PROCESSING',
                startedAt: row.startedAt,
                deletedAt: null,
            };
            try {
                if (row.attempts >= report_pipeline_constants_1.REPORT_JOB_ATTEMPTS) {
                    const { count } = await this.prisma.report.updateMany({
                        where: same,
                        data: {
                            status: 'FAILED',
                            completedAt: now,
                            errorCategory: 'GENERATION_FAILED',
                            errorMessage: report_pipeline_constants_1.SAFE_ERROR_MESSAGE.GENERATION_FAILED,
                        },
                    });
                    failed += count;
                }
                else {
                    const { count } = await this.prisma.report.updateMany({
                        where: same,
                        data: { status: 'QUEUED' },
                    });
                    if (count === 1) {
                        await this.jobs.ensureJob(row.id);
                        requeued += 1;
                    }
                }
            }
            catch {
                this.log.warn('Report reconcile step failed', { reportId: row.id });
            }
        }
        const queued = await this.prisma.report.findMany({
            where: {
                status: 'QUEUED',
                deletedAt: null,
                updatedAt: { lt: new Date(now.getTime() - report_pipeline_constants_1.REPORT_QUEUED_STALE_MS) },
            },
            select: { id: true },
            orderBy: { updatedAt: 'asc' },
            take: report_pipeline_constants_1.REPORT_RECONCILE_BATCH,
        });
        for (const row of queued) {
            try {
                if (await this.jobs.ensureJob(row.id))
                    requeued += 1;
            }
            catch {
                this.log.warn('Report reconcile enqueue failed', { reportId: row.id });
            }
        }
        this.log.info('Reports reconciled', { requeued, failed });
        return { requeued, failed };
    }
};
exports.ReportReconcileService = ReportReconcileService;
exports.ReportReconcileService = ReportReconcileService = ReportReconcileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(exports.REPORT_JOB_ENSURER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], ReportReconcileService);
//# sourceMappingURL=report-reconcile.service.js.map