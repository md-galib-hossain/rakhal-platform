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
var ReportLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const report_pipeline_constants_1 = require("./report-pipeline.constants");
let ReportLifecycleService = ReportLifecycleService_1 = class ReportLifecycleService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ReportLifecycleService_1.name);
    }
    async claim(reportId, now) {
        const leaseCutoff = new Date(now.getTime() - report_pipeline_constants_1.REPORT_PROCESSING_LEASE_MS);
        const { count } = await this.prisma.report.updateMany({
            where: {
                id: reportId,
                deletedAt: null,
                OR: [
                    { status: 'QUEUED' },
                    { status: 'PROCESSING', startedAt: { lt: leaseCutoff } },
                ],
            },
            data: {
                status: 'PROCESSING',
                startedAt: now,
                attempts: { increment: 1 },
            },
        });
        if (count === 1)
            return { claimed: true, token: now };
        const row = await this.prisma.report.findUnique({
            where: { id: reportId },
            select: { status: true, startedAt: true, deletedAt: true },
        });
        if (row && !row.deletedAt && row.status === 'PROCESSING' && row.startedAt) {
            const left = row.startedAt.getTime() + report_pipeline_constants_1.REPORT_PROCESSING_LEASE_MS - now.getTime();
            return { claimed: false, retryAfterMs: Math.max(left, 0) };
        }
        return { claimed: false, retryAfterMs: null };
    }
    async markCompleted(reportId, token, completedAt, expiresAt, artifact) {
        const { count } = await this.prisma.report.updateMany({
            where: {
                id: reportId,
                status: 'PROCESSING',
                startedAt: token,
                deletedAt: null,
            },
            data: {
                status: 'COMPLETED',
                completedAt,
                expiresAt,
                errorCategory: null,
                errorMessage: null,
                artifactKey: artifact?.key ?? null,
                artifactBytes: artifact?.bytes ?? null,
                artifactContentType: artifact?.contentType ?? null,
            },
        });
        return count === 1;
    }
    async markRetryable(reportId, token, category) {
        const { count } = await this.prisma.report.updateMany({
            where: { id: reportId, status: 'PROCESSING', startedAt: token },
            data: {
                status: 'QUEUED',
                errorCategory: category,
                errorMessage: report_pipeline_constants_1.SAFE_ERROR_MESSAGE[category],
            },
        });
        return count === 1;
    }
    async markFailed(reportId, token, category, now) {
        const { count } = await this.prisma.report.updateMany({
            where: { id: reportId, status: 'PROCESSING', startedAt: token },
            data: {
                status: 'FAILED',
                completedAt: now,
                errorCategory: category,
                errorMessage: report_pipeline_constants_1.SAFE_ERROR_MESSAGE[category],
            },
        });
        return count === 1;
    }
    async resetForRetry(reportId, farmId, maxManualRetries) {
        const { count } = await this.prisma.report.updateMany({
            where: {
                id: reportId,
                farmId,
                status: 'FAILED',
                deletedAt: null,
                ...(maxManualRetries !== undefined
                    ? { manualRetries: { lt: maxManualRetries } }
                    : {}),
            },
            data: {
                status: 'QUEUED',
                manualRetries: { increment: 1 },
                errorCategory: null,
                errorMessage: null,
                startedAt: null,
                completedAt: null,
            },
        });
        if (count === 1)
            this.log.info('Report reset for retry', { reportId });
        return count === 1;
    }
    async retentionDays(farmId) {
        const sub = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
            select: { subscriptionPlan: { select: { reportRetentionDays: true } } },
        });
        const days = sub?.subscriptionPlan.reportRetentionDays;
        return typeof days === 'number' && days > 0
            ? days
            : report_pipeline_constants_1.DEFAULT_REPORT_RETENTION_DAYS;
    }
};
exports.ReportLifecycleService = ReportLifecycleService;
exports.ReportLifecycleService = ReportLifecycleService = ReportLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ReportLifecycleService);
//# sourceMappingURL=report-lifecycle.service.js.map