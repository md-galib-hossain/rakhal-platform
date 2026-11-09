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
var ReportScheduleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportScheduleService = exports.SCHEDULED_MAX_AUTO_RETRIES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const subscription_access_service_1 = require("../../../subscription/application/services/subscription-access.service");
const subscription_features_1 = require("../../../subscription/domain/subscription-features");
const report_lifecycle_service_1 = require("../pipeline/report-lifecycle.service");
const report_ports_1 = require("../ports/report-ports");
const decide_scheduled_runs_1 = require("./decide-scheduled-runs");
const scheduling_constants_1 = require("./scheduling.constants");
exports.SCHEDULED_MAX_AUTO_RETRIES = 2;
const emptyResult = () => ({
    farms: 0,
    created: 0,
    alreadyExists: 0,
    deferred: 0,
    skippedNotEntitled: 0,
    missed: 0,
    retriedFailed: 0,
    failedExhausted: 0,
    errors: 0,
});
let ReportScheduleService = ReportScheduleService_1 = class ReportScheduleService {
    prisma;
    access;
    queue;
    lifecycle;
    log;
    constructor(prisma, access, queue, lifecycle, logger) {
        this.prisma = prisma;
        this.access = access;
        this.queue = queue;
        this.lifecycle = lifecycle;
        this.log = logger.setContext(ReportScheduleService_1.name);
    }
    async sweep(now, options = {}) {
        const result = emptyResult();
        const templates = await this.loadTemplates(now);
        if (decide_scheduled_runs_1.SCHEDULED_TYPES.every((t) => !templates[t])) {
            this.log.warn('Scheduled reports sweep: no template published', {});
            return result;
        }
        let cursor;
        for (;;) {
            const idFilter = {};
            if (options.farmIds)
                idFilter.in = options.farmIds;
            if (cursor)
                idFilter.gt = cursor;
            const farms = await this.prisma.farm.findMany({
                where: { status: 'ACTIVE', deletedAt: null, id: idFilter },
                select: { id: true, timezone: true, createdAt: true },
                orderBy: { id: 'asc' },
                take: scheduling_constants_1.SCHEDULE_FARM_BATCH,
            });
            if (farms.length === 0)
                break;
            cursor = farms[farms.length - 1].id;
            for (const farm of farms) {
                result.farms += 1;
                try {
                    await this.sweepFarm(farm, now, templates, result);
                }
                catch (err) {
                    result.errors += 1;
                    this.log.error('Scheduled reports: farm evaluation failed', err, {
                        farmId: farm.id,
                    });
                }
            }
            if (farms.length < scheduling_constants_1.SCHEDULE_FARM_BATCH)
                break;
        }
        this.log.info('Scheduled reports sweep complete', { ...result });
        return result;
    }
    async sweepFarm(farm, now, templates, result) {
        const entitlement = await this.access.resolveEntitlement(farm.id);
        if (!entitlement.features.includes(subscription_features_1.FEATURES.REPORTS_SCHEDULED)) {
            result.skippedNotEntitled += 1;
            return;
        }
        const { due, missedCandidates } = (0, decide_scheduled_runs_1.decideScheduledRuns)({
            farmId: farm.id,
            now,
            farmTimezone: farm.timezone,
            farmCreatedAt: farm.createdAt,
            templates,
        });
        if (due.length === 0 && missedCandidates.length === 0)
            return;
        const existing = await this.prisma.report.findMany({
            where: {
                farmId: farm.id,
                origin: 'SCHEDULED',
                periodStartDate: {
                    in: [
                        ...due.map((d) => d.period.startDate),
                        ...missedCandidates.map((m) => m.periodStartDate),
                    ],
                },
            },
            select: {
                id: true,
                type: true,
                periodStartDate: true,
                status: true,
                manualRetries: true,
                deletedAt: true,
            },
        });
        const have = new Set(existing.map((r) => `${r.type}:${r.periodStartDate}`));
        for (const r of existing) {
            if (r.status !== 'FAILED')
                continue;
            if (r.deletedAt)
                continue;
            if (r.manualRetries >= exports.SCHEDULED_MAX_AUTO_RETRIES) {
                result.failedExhausted += 1;
                this.log.warn('Scheduled report failed and retries are exhausted', {
                    reportId: r.id,
                    manualRetries: r.manualRetries,
                });
                continue;
            }
            const reset = await this.lifecycle.resetForRetry(r.id, farm.id, exports.SCHEDULED_MAX_AUTO_RETRIES);
            if (!reset)
                continue;
            result.retriedFailed += 1;
            try {
                await this.queue.enqueue(r.id);
            }
            catch {
                this.log.warn('Scheduled report retry enqueue failed; reconcile will retry', {
                    reportId: r.id,
                });
            }
        }
        for (const m of missedCandidates) {
            if (!have.has(`${m.type}:${m.periodStartDate}`))
                result.missed += 1;
        }
        for (const run of due) {
            if (have.has(`${run.type}:${run.period.startDate}`)) {
                result.alreadyExists += 1;
                continue;
            }
            const template = templates[run.type];
            if (!template)
                continue;
            if ((0, decide_scheduled_runs_1.withinFinalizationWindow)(now, run.runInstant, template.finalizationMaxWaitHours) &&
                (await this.hasUnsubmittedMilk(farm.id, run.period.startDate, run.period.endDate))) {
                result.deferred += 1;
                continue;
            }
            const reportId = await this.createRow(farm.id, run, template);
            if (reportId === null) {
                result.alreadyExists += 1;
                continue;
            }
            result.created += 1;
            try {
                await this.queue.enqueue(reportId);
            }
            catch {
                this.log.warn('Scheduled report enqueue failed; reconcile will retry', {
                    reportId,
                });
            }
        }
    }
    async hasUnsubmittedMilk(farmId, startDate, endDate) {
        const count = await this.prisma.milkLogEntry.count({
            where: {
                farmId,
                submitted: false,
                logDate: {
                    gte: new Date(`${startDate}T00:00:00.000Z`),
                    lte: new Date(`${endDate}T00:00:00.000Z`),
                },
            },
        });
        return count > 0;
    }
    async createRow(farmId, run, template) {
        try {
            const row = await this.prisma.report.create({
                data: {
                    farmId,
                    origin: 'SCHEDULED',
                    type: run.type,
                    templateVersionId: template.id,
                    periodStart: new Date(run.period.start),
                    periodEnd: new Date(run.period.end),
                    periodStartDate: run.period.startDate,
                    periodEndDate: run.period.endDate,
                    timezone: run.period.timezone,
                    scope: { kind: 'ALL_ELIGIBLE' },
                    selectedMetricIds: template.metricIds,
                    includesFinance: true,
                    status: 'QUEUED',
                    requestedBy: null,
                    scheduledKey: run.scheduledKey,
                    expiresAt: null,
                },
                select: { id: true },
            });
            return row.id;
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                return null;
            }
            throw err;
        }
    }
    async loadTemplates(now) {
        const out = {};
        for (const type of decide_scheduled_runs_1.SCHEDULED_TYPES) {
            const row = await this.prisma.reportTemplateVersion.findFirst({
                where: { type, effectiveFrom: { lte: now } },
                orderBy: { version: 'desc' },
                select: { id: true, version: true, definition: true },
            });
            if (!row)
                continue;
            const def = row.definition;
            const ids = [
                ...new Set((def.sections ?? []).flatMap((s) => s.metricIds ?? [])),
            ];
            out[type] = {
                id: row.id,
                version: row.version,
                finalizationMaxWaitHours: def.thresholds?.finalizationMaxWaitHours,
                metricIds: ids,
            };
        }
        return out;
    }
};
exports.ReportScheduleService = ReportScheduleService;
exports.ReportScheduleService = ReportScheduleService = ReportScheduleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(report_ports_1.REPORT_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        subscription_access_service_1.SubscriptionAccessService, Object, report_lifecycle_service_1.ReportLifecycleService,
        logger_service_1.LoggerService])
], ReportScheduleService);
//# sourceMappingURL=report-schedule.service.js.map