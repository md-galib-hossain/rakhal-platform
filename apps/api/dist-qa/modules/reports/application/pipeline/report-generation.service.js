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
var ReportGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerationService = void 0;
exports.periodFromRow = periodFromRow;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const object_storage_port_1 = require("src/modules/media/application/ports/object-storage.port");
const snapshot_1 = require("../../domain/contracts/snapshot");
const period_1 = require("../../domain/period");
const report_error_1 = require("../../domain/report-error");
const report_ports_1 = require("../ports/report-ports");
const report_error_mapper_1 = require("./report-error-mapper");
const report_lifecycle_service_1 = require("./report-lifecycle.service");
const report_pipeline_constants_1 = require("./report-pipeline.constants");
function periodFromRow(row) {
    const raw = {
        start: row.periodStart.toISOString(),
        end: row.periodEnd.toISOString(),
        startDate: row.periodStartDate,
        endDate: row.periodEndDate,
        timezone: row.timezone,
        label: row.periodStartDate === row.periodEndDate
            ? row.periodStartDate
            : `${row.periodStartDate} - ${row.periodEndDate}`,
    };
    try {
        const kind = (0, period_1.detectPeriodKind)(raw);
        const preset = kind === 'week'
            ? 'this_week'
            : kind === 'month'
                ? 'this_month'
                : kind === 'year'
                    ? 'this_year'
                    : null;
        if (!preset)
            return raw;
        const p = (0, period_1.resolvePreset)(preset, row.periodStart, row.timezone);
        return p.startDate === raw.startDate && p.endDate === raw.endDate
            ? { ...raw, label: p.label }
            : raw;
    }
    catch {
        return raw;
    }
}
function templateFrom(definition, version) {
    const d = definition;
    if (!d || !Array.isArray(d.sections) || !d.thresholds) {
        throw new report_error_1.ReportError('INVALID_CONFIG', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.INVALID_CONFIG);
    }
    return { ...d, version };
}
let ReportGenerationService = ReportGenerationService_1 = class ReportGenerationService {
    prisma;
    lifecycle;
    compute;
    renderer;
    storage;
    log;
    constructor(prisma, lifecycle, compute, renderer, storage, logger) {
        this.prisma = prisma;
        this.lifecycle = lifecycle;
        this.compute = compute;
        this.renderer = renderer;
        this.storage = storage;
        this.log = logger.setContext(ReportGenerationService_1.name);
    }
    async process(reportId, attempt) {
        const startedAt = new Date();
        const claim = await this.lifecycle.claim(reportId, startedAt);
        if (!claim.claimed) {
            if (claim.retryAfterMs !== null) {
                this.log.info('Report job delayed (lease held)', { reportId });
                return {
                    status: 'delayed',
                    delayMs: claim.retryAfterMs + report_pipeline_constants_1.REPORT_LEASE_RECHECK_BUFFER_MS,
                };
            }
            this.log.info('Report job skipped (not claimable)', { reportId });
            return { status: 'skipped' };
        }
        try {
            return (await this.run(reportId, startedAt))
                ? { status: 'completed' }
                : { status: 'skipped' };
        }
        catch (raw) {
            return this.handleFailure(reportId, startedAt, raw, attempt);
        }
    }
    async isDeleted(reportId) {
        const r = await this.prisma.report.findUnique({
            where: { id: reportId },
            select: { deletedAt: true },
        });
        return !r || r.deletedAt !== null;
    }
    async run(reportId, startedAt) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
            include: { templateVersion: true },
        });
        if (!report) {
            throw new report_error_1.ReportError('INVALID_CONFIG', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.INVALID_CONFIG);
        }
        if (report.deletedAt) {
            this.log.info('Report deleted before generation; skipped', { reportId });
            return false;
        }
        let payload;
        const existing = await this.prisma.reportSnapshot.findUnique({
            where: { reportId },
        });
        if (existing) {
            payload = existing.payload;
        }
        else {
            const template = templateFrom(report.templateVersion.definition, report.templateVersion.version);
            let computed;
            try {
                computed = await this.compute.compute({
                    farmId: report.farmId,
                    includeFinance: report.includesFinance,
                    type: report.type,
                    period: periodFromRow(report),
                    scope: report.scope,
                    selectedMetricIds: this.metricIds(report.selectedMetricIds),
                    template,
                    generatedAt: startedAt,
                });
            }
            catch (e) {
                throw (0, report_error_mapper_1.toReportError)(e, 'compute');
            }
            payload = await this.persistSnapshot(reportId, computed);
        }
        if (!report.includesFinance) {
            try {
                (0, snapshot_1.assertNoFinance)(payload);
            }
            catch {
                throw new report_error_1.ReportError('PERMISSION_DENIED', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.PERMISSION_DENIED);
            }
        }
        if (await this.isDeleted(reportId)) {
            this.log.info('Report deleted mid-run; skipped', { reportId });
            return false;
        }
        let rendered;
        try {
            rendered = await this.renderer.render(payload);
        }
        catch (e) {
            throw (0, report_error_mapper_1.toReportError)(e, 'render');
        }
        let artifact = null;
        if (rendered) {
            const key = `reports/${report.farmId}/${report.id}.pdf`;
            try {
                await this.storage.put({
                    key,
                    body: rendered.body,
                    contentType: rendered.contentType,
                });
            }
            catch (e) {
                throw (0, report_error_mapper_1.toReportError)(e, 'storage');
            }
            artifact = {
                key,
                bytes: rendered.body.length,
                contentType: rendered.contentType,
            };
        }
        const completedAt = new Date();
        const days = await this.lifecycle.retentionDays(report.farmId);
        const expiresAt = new Date(completedAt.getTime() + days * 86_400_000);
        const changed = await this.lifecycle.markCompleted(reportId, startedAt, completedAt, expiresAt, artifact);
        if (!changed) {
            if (artifact && (await this.isDeleted(reportId))) {
                await this.discardArtifact(reportId, artifact.key);
            }
            this.log.info('Report not completed (deleted or superseded)', {
                reportId,
            });
            return false;
        }
        this.log.info('Report generated', {
            reportId,
            farmId: report.farmId,
            hasArtifact: artifact !== null,
        });
        return true;
    }
    async discardArtifact(reportId, key) {
        try {
            await this.storage.delete(key);
        }
        catch {
            this.log.warn('Orphan report artifact could not be deleted', {
                reportId,
            });
        }
    }
    async persistSnapshot(reportId, payload) {
        try {
            await this.prisma.reportSnapshot.create({
                data: {
                    reportId,
                    payload: payload,
                    schemaVersion: payload.schemaVersion,
                    calcVersion: payload.calcVersion,
                    templateVersion: payload.templateVersion,
                    includesFinance: payload.includesFinance,
                },
            });
            return payload;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                const winner = await this.prisma.reportSnapshot.findUnique({
                    where: { reportId },
                });
                if (winner)
                    return winner.payload;
            }
            throw (0, report_error_mapper_1.toReportError)(e, 'persist');
        }
    }
    metricIds(raw) {
        if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
            throw new report_error_1.ReportError('INVALID_CONFIG', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.INVALID_CONFIG);
        }
        return raw;
    }
    async handleFailure(reportId, token, raw, attempt) {
        const err = (0, report_error_mapper_1.toReportError)(raw, 'persist');
        const isFinal = attempt.attemptsMade + 1 >= attempt.maxAttempts;
        this.log.warn('Report generation failed', {
            reportId,
            category: err.category,
            transient: err.transient,
            final: isFinal,
        });
        const retryOutcome = {
            status: 'retry',
            category: err.category,
        };
        try {
            if (err.transient && !isFinal) {
                await this.lifecycle.markRetryable(reportId, token, err.category);
                return retryOutcome;
            }
            await this.lifecycle.markFailed(reportId, token, err.category, new Date());
            return { status: 'failed', category: err.category };
        }
        catch {
            this.log.warn('Report state write failed; leaving to retry/reconcile', {
                reportId,
            });
            return retryOutcome;
        }
    }
};
exports.ReportGenerationService = ReportGenerationService;
exports.ReportGenerationService = ReportGenerationService = ReportGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(report_ports_1.REPORT_COMPUTE)),
    __param(3, (0, common_1.Inject)(report_ports_1.REPORT_RENDERER)),
    __param(4, (0, common_1.Inject)(object_storage_port_1.OBJECT_STORAGE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        report_lifecycle_service_1.ReportLifecycleService, Object, Object, Object, logger_service_1.LoggerService])
], ReportGenerationService);
//# sourceMappingURL=report-generation.service.js.map