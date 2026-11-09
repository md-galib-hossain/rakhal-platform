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
var ReportQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportQueueService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const report_error_1 = require("../../domain/report-error");
const report_pipeline_constants_1 = require("../../application/pipeline/report-pipeline.constants");
let ReportQueueService = ReportQueueService_1 = class ReportQueueService {
    queue;
    prisma;
    log;
    constructor(queue, prisma, logger) {
        this.queue = queue;
        this.prisma = prisma;
        this.log = logger.setContext(ReportQueueService_1.name);
    }
    static jobIdFor(reportId, manualRetries) {
        return manualRetries > 0 ? `${reportId}-r${manualRetries}` : reportId;
    }
    async enqueue(reportId) {
        await this.ensureJob(reportId);
    }
    async ensureJob(reportId) {
        try {
            const row = await this.prisma.report.findUnique({
                where: { id: reportId },
                select: { manualRetries: true },
            });
            const jobId = ReportQueueService_1.jobIdFor(reportId, row?.manualRetries ?? 0);
            const existing = await this.queue.getJob(jobId);
            if (existing) {
                const state = await existing.getState();
                if (state !== 'failed' && state !== 'completed')
                    return false;
                await existing.remove();
            }
            await this.queue.add(report_pipeline_constants_1.REPORT_GENERATE_JOB, { reportId }, {
                jobId,
                attempts: report_pipeline_constants_1.REPORT_JOB_ATTEMPTS,
                backoff: { type: 'exponential', delay: report_pipeline_constants_1.REPORT_JOB_BACKOFF_MS },
                removeOnComplete: { age: 24 * 3600, count: 1000 },
                removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
            });
            this.log.info('Report enqueued', { reportId });
            return true;
        }
        catch (e) {
            this.log.error('Report enqueue failed', e, { reportId });
            throw new report_error_1.ReportError('QUEUE_UNAVAILABLE', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.QUEUE_UNAVAILABLE);
        }
    }
};
exports.ReportQueueService = ReportQueueService;
exports.ReportQueueService = ReportQueueService = ReportQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(report_pipeline_constants_1.REPORTS_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ReportQueueService);
//# sourceMappingURL=report-queue.service.js.map