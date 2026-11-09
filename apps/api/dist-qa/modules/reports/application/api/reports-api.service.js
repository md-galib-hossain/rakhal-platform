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
var ReportsApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsApiService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const pagination_1 = require("src/common/pagination");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const object_storage_port_1 = require("src/modules/media/application/ports/object-storage.port");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const permission_catalogue_1 = require("src/modules/permission/domain/permission-catalogue");
const enums_1 = require("../../domain/contracts/enums");
const snapshot_1 = require("../../domain/contracts/snapshot");
const errors_1 = require("../../domain/period/errors");
const period_resolver_1 = require("../../domain/period/period-resolver");
const registry_1 = require("../metrics/registry");
const report_ports_1 = require("../ports/report-ports");
const report_selection_1 = require("./report-selection");
const reports_api_constants_1 = require("./reports-api.constants");
const preview_limiter_1 = require("./preview-limiter");
const reports_api_types_1 = require("./reports-api.types");
const SUMMARY_SELECT = {
    id: true,
    type: true,
    origin: true,
    status: true,
    periodStartDate: true,
    periodEndDate: true,
    timezone: true,
    scope: true,
    selectedMetricIds: true,
    includesFinance: true,
    attempts: true,
    errorCategory: true,
    errorMessage: true,
    artifactKey: true,
    artifactBytes: true,
    createdAt: true,
    startedAt: true,
    completedAt: true,
    expiresAt: true,
    templateVersion: { select: { version: true } },
};
const DUPLICATE_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED'];
const MINUTE_MS = 60_000;
let ReportsApiService = ReportsApiService_1 = class ReportsApiService {
    prisma;
    permissions;
    farmClock;
    audit;
    logger;
    storage;
    lifecycle;
    compute;
    queue;
    log;
    previewLimiter = new preview_limiter_1.PreviewLimiter(reports_api_constants_1.MAX_PREVIEWS_PER_FARM, reports_api_constants_1.MAX_PREVIEWS_GLOBAL);
    constructor(prisma, permissions, farmClock, audit, logger, storage, lifecycle, compute, queue) {
        this.prisma = prisma;
        this.permissions = permissions;
        this.farmClock = farmClock;
        this.audit = audit;
        this.logger = logger;
        this.storage = storage;
        this.lifecycle = lifecycle;
        this.compute = compute;
        this.queue = queue;
        this.log = this.logger.setContext(ReportsApiService_1.name);
    }
    async templates(caller) {
        const canFinance = await this.canFinance(caller);
        const onDemand = await this.latestTemplate('ON_DEMAND');
        const [weekly, monthly] = await Promise.all([
            this.latestTemplateRow('WEEKLY'),
            this.latestTemplateRow('MONTHLY'),
        ]);
        const sections = [];
        for (const section of onDemand.definition.sections ?? []) {
            const metrics = (section.metricIds ?? [])
                .map((id) => registry_1.METRIC_REGISTRY[id])
                .filter((def) => !!def && (canFinance || !(0, report_selection_1.isFinanceMetric)(def)))
                .map((def) => ({
                id: def.id,
                unit: def.unit,
                labelKey: `reports.metrics.${def.id}.label`,
                definitionKey: `reports.metrics.${def.id}.definition`,
                requiresFinance: (0, report_selection_1.isFinanceMetric)(def),
            }));
            if (metrics.length === 0)
                continue;
            sections.push({
                id: section.id,
                domain: section.domain,
                titleKey: section.titleKey,
                metrics,
            });
        }
        return {
            onDemand: {
                id: onDemand.id,
                alias: reports_api_constants_1.ON_DEMAND_TEMPLATE_ALIAS,
                version: onDemand.definition.version,
                domains: enums_1.REPORT_DOMAINS.filter((d) => sections.some((s) => s.domain === d)),
                sections,
            },
            scheduled: {
                weekly: weekly ? { version: weekly.version } : null,
                monthly: monthly ? { version: monthly.version } : null,
            },
            datePresets: [...enums_1.DATE_PRESETS],
            scopeKinds: [...enums_1.REPORT_SCOPE_KINDS],
            limits: {
                maxMetrics: reports_api_constants_1.MAX_SELECTED_METRICS,
                maxCustomRangeDays: period_resolver_1.MAX_CUSTOM_RANGE_DAYS,
            },
        };
    }
    async preview(caller, dto) {
        const release = this.previewLimiter.tryAcquire(caller.farmId);
        if (!release) {
            throw new common_1.HttpException({
                message: 'A preview is already running. Try again shortly.',
                details: { reason: reports_api_constants_1.ReportApiReason.PREVIEW_BUSY },
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        try {
            const canFinance = await this.canFinance(caller);
            const prepared = await this.prepare(caller, dto, canFinance);
            const payload = await this.compute.compute({
                farmId: caller.farmId,
                includeFinance: canFinance,
                type: 'ON_DEMAND',
                period: prepared.period,
                scope: prepared.scope,
                selectedMetricIds: prepared.selectedMetricIds,
                template: prepared.template.definition,
                generatedAt: new Date(),
            });
            if (!canFinance)
                (0, snapshot_1.assertNoFinance)(payload);
            await this.auditSafe(caller, client_1.AuditAction.REPORT_PREVIEWED, null, {
                type: 'ON_DEMAND',
                periodStart: prepared.period.startDate,
                periodEnd: prepared.period.endDate,
            });
            return payload;
        }
        finally {
            release();
        }
    }
    async create(caller, dto, idempotencyKey) {
        const key = this.normaliseIdempotencyKey(idempotencyKey);
        const canFinance = await this.canFinance(caller);
        const prepared = await this.prepare(caller, dto, canFinance);
        const includesFinance = canFinance &&
            prepared.selectedMetricIds.some((id) => {
                const def = registry_1.METRIC_REGISTRY[id];
                return !!def && (0, report_selection_1.isFinanceMetric)(def);
            });
        const requestHash = this.requestHash(prepared, includesFinance);
        let outcome;
        try {
            outcome = await this.prisma.$transaction(async (tx) => {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`reports:${caller.farmId}`}))`;
                if (key) {
                    const replay = await this.findByIdempotencyKey(tx, caller, key, canFinance, requestHash);
                    if (replay)
                        return { kind: 'replay', report: replay };
                }
                if (!dto.forceNew) {
                    const existing = await this.findDuplicate(tx, caller.farmId, prepared, includesFinance);
                    if (existing)
                        return { kind: 'duplicate', existing };
                }
                await this.assertInFlightCapacity(tx, caller.farmId);
                const created = await tx.report.create({
                    data: {
                        farmId: caller.farmId,
                        origin: 'ON_DEMAND',
                        type: 'ON_DEMAND',
                        templateVersionId: prepared.template.id,
                        periodStart: new Date(prepared.period.start),
                        periodEnd: new Date(prepared.period.end),
                        periodStartDate: prepared.period.startDate,
                        periodEndDate: prepared.period.endDate,
                        timezone: prepared.period.timezone,
                        scope: prepared.scope,
                        selectedMetricIds: prepared.selectedMetricIds,
                        includesFinance,
                        status: 'QUEUED',
                        requestedBy: caller.userId,
                        idempotencyKey: key ?? null,
                        requestHash,
                    },
                    select: SUMMARY_SELECT,
                });
                return { kind: 'created', row: created };
            });
        }
        catch (err) {
            if (key &&
                err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                const replay = await this.findByIdempotencyKey(this.prisma, caller, key, canFinance, requestHash);
                if (replay)
                    return { duplicate: false, replayed: true, report: replay };
                throw this.idempotencyConflict();
            }
            throw err;
        }
        if (outcome.kind === 'replay') {
            return { duplicate: false, replayed: true, report: outcome.report };
        }
        if (outcome.kind === 'duplicate') {
            return { duplicate: true, existing: outcome.existing };
        }
        const row = outcome.row;
        try {
            await this.queue.enqueue(row.id);
        }
        catch (err) {
            this.log.error('Report enqueue failed', err, { reportId: row.id });
            await this.prisma.report
                .updateMany({
                where: { id: row.id, farmId: caller.farmId, status: 'QUEUED' },
                data: {
                    status: 'FAILED',
                    errorCategory: 'QUEUE_UNAVAILABLE',
                    errorMessage: 'The report could not be queued. Please retry.',
                },
            })
                .catch(() => undefined);
            throw new common_1.ServiceUnavailableException({
                message: 'The report could not be queued. Please retry.',
                details: {
                    reason: reports_api_constants_1.ReportApiReason.QUEUE_UNAVAILABLE,
                    reportId: row.id,
                },
            });
        }
        await this.auditSafe(caller, client_1.AuditAction.REPORT_GENERATED, row.id, {
            type: 'ON_DEMAND',
            periodStart: prepared.period.startDate,
            periodEnd: prepared.period.endDate,
            includesFinance,
        });
        return { duplicate: false, replayed: false, report: this.toSummary(row) };
    }
    async list(caller, query) {
        const canFinance = await this.canFinance(caller);
        const rows = await this.prisma.report.findMany({
            where: {
                ...this.visibleWhere(caller.farmId, canFinance),
                ...(query.type ? { type: query.type } : {}),
                ...(query.origin ? { origin: query.origin } : {}),
                ...(query.status ? { status: query.status } : {}),
            },
            select: SUMMARY_SELECT,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return { items: page.items.map((r) => this.toSummary(r)), meta: page.meta };
    }
    async getOne(caller, id) {
        const canFinance = await this.canFinance(caller);
        const row = await this.prisma.report.findFirst({
            where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
            select: { ...SUMMARY_SELECT, snapshot: { select: { payload: true } } },
        });
        if (!row)
            throw this.notFound();
        let payload = null;
        if (row.status === 'COMPLETED' && row.snapshot) {
            payload = row.snapshot.payload;
            if (!canFinance) {
                try {
                    (0, snapshot_1.assertNoFinance)(payload);
                }
                catch {
                    this.log.error('Finance content in finance-free report view', undefined, {
                        reportId: row.id,
                    });
                    throw this.notFound();
                }
            }
        }
        return { ...this.toSummary(row), payload };
    }
    async download(caller, id) {
        const canFinance = await this.canFinance(caller);
        const row = await this.prisma.report.findFirst({
            where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
            select: {
                id: true,
                type: true,
                status: true,
                periodStartDate: true,
                periodEndDate: true,
                artifactKey: true,
                artifactContentType: true,
            },
        });
        if (!row)
            throw this.notFound();
        if (row.status !== 'COMPLETED' || !row.artifactKey) {
            throw new common_1.ConflictException({
                message: 'The PDF for this report is not available',
                details: { reason: reports_api_constants_1.ReportApiReason.PDF_NOT_AVAILABLE },
            });
        }
        let body;
        try {
            body = await this.storage.get(row.artifactKey);
        }
        catch (err) {
            this.log.error('Report artifact read failed', err, { reportId: row.id });
            throw new common_1.ServiceUnavailableException({
                message: 'The PDF could not be read. Try again shortly.',
                details: { reason: reports_api_constants_1.ReportApiReason.STORAGE_UNAVAILABLE },
            });
        }
        await this.auditSafe(caller, client_1.AuditAction.REPORT_DOWNLOADED, row.id, {
            type: row.type,
            periodStart: row.periodStartDate,
            periodEnd: row.periodEndDate,
        });
        return {
            body,
            contentType: row.artifactContentType ?? reports_api_constants_1.PDF_CONTENT_TYPE,
            fileName: this.fileName(row.type, row.periodStartDate, row.periodEndDate),
        };
    }
    async retry(caller, id) {
        const canFinance = await this.canFinance(caller);
        const row = await this.prisma.report.findFirst({
            where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
            select: { id: true, status: true, type: true, manualRetries: true },
        });
        if (!row)
            throw this.notFound();
        if (row.status !== 'FAILED') {
            throw new common_1.ConflictException({
                message: 'Only a failed report can be retried',
                details: { reason: reports_api_constants_1.ReportApiReason.NOT_RETRYABLE },
            });
        }
        if (row.manualRetries >= reports_api_constants_1.MAX_MANUAL_RETRIES) {
            throw new common_1.ConflictException({
                message: 'This report was retried too many times',
                details: {
                    reason: reports_api_constants_1.ReportApiReason.RETRY_LIMIT,
                    max: reports_api_constants_1.MAX_MANUAL_RETRIES,
                },
            });
        }
        await this.assertInFlightCapacity(this.prisma, caller.farmId);
        const reset = await this.lifecycle.resetForRetry(row.id, caller.farmId, reports_api_constants_1.MAX_MANUAL_RETRIES);
        if (!reset) {
            throw new common_1.ConflictException({
                message: 'Only a failed report can be retried',
                details: { reason: reports_api_constants_1.ReportApiReason.NOT_RETRYABLE },
            });
        }
        try {
            await this.queue.enqueue(row.id);
        }
        catch (err) {
            this.log.error('Report re-enqueue failed', err, { reportId: row.id });
            await this.prisma.report
                .updateMany({
                where: { id: row.id, farmId: caller.farmId, status: 'QUEUED' },
                data: {
                    status: 'FAILED',
                    errorCategory: 'QUEUE_UNAVAILABLE',
                    errorMessage: 'The report could not be queued. Please retry.',
                },
            })
                .catch(() => undefined);
            throw new common_1.ServiceUnavailableException({
                message: 'The report could not be queued. Please retry.',
                details: { reason: reports_api_constants_1.ReportApiReason.QUEUE_UNAVAILABLE },
            });
        }
        await this.auditSafe(caller, client_1.AuditAction.REPORT_RETRIED, row.id, {
            type: row.type,
            attempt: row.manualRetries + 1,
        });
        const fresh = await this.prisma.report.findFirst({
            where: { id: row.id, farmId: caller.farmId, deletedAt: null },
            select: SUMMARY_SELECT,
        });
        if (!fresh)
            throw this.notFound();
        return this.toSummary(fresh);
    }
    async remove(caller, id) {
        if (!this.isOwner(caller)) {
            throw new common_1.ForbiddenException({
                message: 'Only the farm owner can delete reports',
                details: { reason: reports_api_constants_1.ReportApiReason.OWNER_ONLY },
            });
        }
        const row = await this.prisma.report.findFirst({
            where: { id, farmId: caller.farmId, deletedAt: null },
            select: {
                id: true,
                type: true,
                artifactKey: true,
                status: true,
                startedAt: true,
            },
        });
        if (!row)
            throw this.notFound();
        const leaseCutoff = new Date(Date.now() - reports_api_constants_1.PROCESSING_LEASE_MINUTES * MINUTE_MS);
        if (row.status === 'PROCESSING' &&
            (!row.startedAt || row.startedAt > leaseCutoff)) {
            throw new common_1.ConflictException({
                message: 'This report is being generated and cannot be deleted yet',
                details: { reason: reports_api_constants_1.ReportApiReason.PROCESSING },
            });
        }
        const res = await this.prisma.report.updateMany({
            where: {
                id: row.id,
                farmId: caller.farmId,
                deletedAt: null,
                NOT: { status: 'PROCESSING', startedAt: { gt: leaseCutoff } },
            },
            data: { deletedAt: new Date() },
        });
        if (res.count === 0)
            throw this.notFound();
        if (row.artifactKey) {
            try {
                await this.storage.delete(row.artifactKey);
                await this.prisma.report.updateMany({
                    where: { id: row.id, farmId: caller.farmId },
                    data: { artifactKey: null },
                });
            }
            catch (err) {
                this.log.error('Report artifact delete failed', err, {
                    reportId: row.id,
                });
            }
        }
        await this.auditSafe(caller, client_1.AuditAction.REPORT_DELETED, row.id, {
            type: row.type,
        });
        return { deleted: true };
    }
    isOwner(caller) {
        return caller.isSystemRole && caller.roleName === permission_catalogue_1.SYSTEM_ROLES.OWNER;
    }
    canFinance(caller) {
        return this.permissions.hasPermission(caller.userId, caller.farmId, caller.permissionsVersion, ['finance.read']);
    }
    visibleWhere(farmId, canFinance) {
        return {
            farmId,
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            ...(canFinance ? {} : { includesFinance: false }),
        };
    }
    notFound() {
        return new common_1.NotFoundException('Report not found');
    }
    idempotencyConflict() {
        return new common_1.ConflictException({
            message: 'This idempotency key cannot be reused',
            details: { reason: reports_api_constants_1.ReportApiReason.IDEMPOTENCY_CONFLICT },
        });
    }
    async assertInFlightCapacity(db, farmId) {
        const cutoff = new Date(Date.now() - reports_api_constants_1.STALE_IN_FLIGHT_MINUTES * MINUTE_MS);
        const inFlight = await db.report.count({
            where: {
                farmId,
                deletedAt: null,
                OR: [
                    { status: 'QUEUED', createdAt: { gt: cutoff } },
                    {
                        status: 'PROCESSING',
                        OR: [
                            { startedAt: { gt: cutoff } },
                            { startedAt: null, createdAt: { gt: cutoff } },
                        ],
                    },
                ],
            },
        });
        if (inFlight >= reports_api_constants_1.MAX_IN_FLIGHT_REPORTS) {
            throw new common_1.HttpException({
                message: 'Too many reports are being generated. Try again shortly.',
                details: {
                    reason: reports_api_constants_1.ReportApiReason.TOO_MANY_IN_FLIGHT,
                    max: reports_api_constants_1.MAX_IN_FLIGHT_REPORTS,
                },
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    requestHash(prepared, includesFinance) {
        const canonical = JSON.stringify({
            templateVersionId: prepared.template.id,
            periodStart: prepared.period.startDate,
            periodEnd: prepared.period.endDate,
            timezone: prepared.period.timezone,
            scope: (0, report_selection_1.scopeIdentity)(prepared.scope),
            metricIds: [...new Set(prepared.selectedMetricIds)].sort(),
            includesFinance,
        });
        return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('hex');
    }
    async latestTemplateRow(type) {
        return this.prisma.reportTemplateVersion.findFirst({
            where: { type, effectiveFrom: { lte: new Date() } },
            orderBy: [{ version: 'desc' }],
            select: { id: true, version: true, definition: true },
        });
    }
    async latestTemplate(type) {
        const row = await this.latestTemplateRow(type);
        if (!row) {
            throw new common_1.ServiceUnavailableException({
                message: 'No report template is published',
                details: { reason: reports_api_constants_1.ReportApiReason.TEMPLATE_UNAVAILABLE },
            });
        }
        return {
            id: row.id,
            definition: row.definition,
        };
    }
    async prepare(caller, dto, canFinance) {
        const template = await this.latestTemplate('ON_DEMAND');
        if (dto.templateId !== reports_api_constants_1.ON_DEMAND_TEMPLATE_ALIAS &&
            dto.templateId !== template.id) {
            throw new common_1.BadRequestException({
                message: 'Unknown report template',
                details: { reason: reports_api_constants_1.ReportApiReason.INVALID_TEMPLATE },
            });
        }
        const selectedMetricIds = (0, report_selection_1.validateMetricSelection)({
            requested: dto.selectedMetricIds,
            allowed: (0, report_selection_1.allowedMetricIds)(template.definition, registry_1.METRIC_REGISTRY),
            registry: registry_1.METRIC_REGISTRY,
            canFinance,
        });
        const scope = await this.resolveScope(caller.farmId, dto.scope);
        const period = await this.resolvePeriod(caller.farmId, dto.period);
        return { template, selectedMetricIds, scope, period };
    }
    async resolveScope(farmId, input) {
        const invalid = () => new common_1.BadRequestException({
            message: 'Invalid report scope',
            details: { reason: reports_api_constants_1.ReportApiReason.INVALID_SCOPE },
        });
        if (input.kind === 'ALL_ELIGIBLE') {
            if (input.cattleId || input.groupId)
                throw invalid();
            return { kind: 'ALL_ELIGIBLE' };
        }
        if (input.kind === 'SINGLE_COW') {
            if (!input.cattleId || input.groupId)
                throw invalid();
            const cow = await this.prisma.cattle.findFirst({
                where: { id: input.cattleId, farmId },
                select: { id: true },
            });
            if (!cow)
                throw new common_1.NotFoundException('Animal not found');
            return { kind: 'SINGLE_COW', cattleId: cow.id };
        }
        if (!input.groupId || input.cattleId)
            throw invalid();
        const group = await this.prisma.animalGroup.findFirst({
            where: { id: input.groupId, farmId, deletedAt: null },
            select: { id: true },
        });
        if (!group)
            throw new common_1.NotFoundException('Group not found');
        return {
            kind: 'GROUP',
            groupId: group.id,
            membershipAsOf: new Date().toISOString(),
        };
    }
    async resolvePeriod(farmId, input) {
        const timezone = await this.farmClock.timezone(farmId);
        const custom = input.preset === 'custom'
            ? input.customStartDate && input.customEndDate
                ? { from: input.customStartDate, to: input.customEndDate }
                : undefined
            : undefined;
        if (input.preset !== 'custom' &&
            (input.customStartDate || input.customEndDate)) {
            throw new common_1.BadRequestException({
                message: 'Custom dates are only valid with the custom preset',
                details: { reason: reports_api_constants_1.ReportApiReason.INVALID_PERIOD },
            });
        }
        try {
            return (0, period_resolver_1.resolvePreset)(input.preset, new Date(), timezone, custom);
        }
        catch (err) {
            if (err instanceof errors_1.PeriodError) {
                throw new common_1.BadRequestException({
                    message: 'Invalid report period',
                    details: { reason: reports_api_constants_1.ReportApiReason.INVALID_PERIOD, code: err.code },
                });
            }
            throw err;
        }
    }
    normaliseIdempotencyKey(raw) {
        if (raw === undefined || raw === null)
            return undefined;
        const key = String(raw).trim();
        if (key.length === 0 ||
            key.length > reports_api_constants_1.MAX_IDEMPOTENCY_KEY_LENGTH ||
            !/^[A-Za-z0-9._:-]+$/.test(key)) {
            throw new common_1.BadRequestException({
                message: 'Invalid Idempotency-Key',
                details: { reason: reports_api_constants_1.ReportApiReason.INVALID_IDEMPOTENCY_KEY },
            });
        }
        return key;
    }
    async findByIdempotencyKey(db, caller, key, canFinance, requestHash) {
        const row = await db.report.findFirst({
            where: {
                farmId: caller.farmId,
                requestedBy: caller.userId,
                idempotencyKey: key,
            },
            select: { ...SUMMARY_SELECT, deletedAt: true, requestHash: true },
        });
        if (!row)
            return null;
        if (row.deletedAt || (row.includesFinance && !canFinance)) {
            throw this.idempotencyConflict();
        }
        if (row.requestHash && row.requestHash !== requestHash) {
            throw this.idempotencyConflict();
        }
        return this.toSummary(row);
    }
    async findDuplicate(db, farmId, prepared, includesFinance) {
        const { period, scope } = prepared;
        const candidates = await db.report.findMany({
            where: {
                farmId,
                deletedAt: null,
                templateVersionId: prepared.template.id,
                periodStartDate: period.startDate,
                periodEndDate: period.endDate,
                timezone: period.timezone,
                includesFinance,
                status: { in: [...DUPLICATE_STATUSES] },
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { ...SUMMARY_SELECT, periodEnd: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 25,
        });
        const wanted = (0, report_selection_1.scopeIdentity)(scope);
        const now = Date.now();
        const staleCutoff = now - reports_api_constants_1.STALE_IN_FLIGHT_MINUTES * MINUTE_MS;
        const freshCutoff = now - reports_api_constants_1.DUPLICATE_FRESH_MINUTES * MINUTE_MS;
        const reusable = (r) => {
            if (r.status === 'COMPLETED') {
                const completedAt = r.completedAt?.getTime();
                if (completedAt === undefined)
                    return false;
                if (completedAt >= freshCutoff)
                    return true;
                return scope.kind !== 'GROUP' && r.periodEnd.getTime() <= completedAt;
            }
            const since = (r.startedAt ?? r.createdAt).getTime();
            return since > staleCutoff;
        };
        const hit = candidates.find((r) => reusable(r) &&
            (0, report_selection_1.scopeIdentity)(r.scope) === wanted &&
            (0, report_selection_1.sameMetricSet)(r.selectedMetricIds, prepared.selectedMetricIds));
        return hit ? this.toSummary(hit) : null;
    }
    toSummary(row) {
        return {
            id: row.id,
            type: row.type,
            origin: row.origin,
            status: row.status,
            templateVersion: row.templateVersion?.version ?? null,
            period: {
                startDate: row.periodStartDate,
                endDate: row.periodEndDate,
                timezone: row.timezone,
            },
            scope: row.scope,
            selectedMetricIds: row.selectedMetricIds,
            includesFinance: row.includesFinance,
            hasPdf: row.status === 'COMPLETED' && !!row.artifactKey,
            pdfBytes: row.artifactBytes ?? null,
            attempts: row.attempts,
            errorCategory: row.status === 'FAILED' ? row.errorCategory : null,
            errorMessage: row.status === 'FAILED' && row.errorMessage
                ? row.errorMessage.slice(0, reports_api_constants_1.MAX_ERROR_MESSAGE_LENGTH)
                : null,
            createdAt: row.createdAt,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            expiresAt: row.expiresAt,
        };
    }
    fileName(type, start, end) {
        const safe = (s) => s.replace(/[^A-Za-z0-9_-]/g, '');
        const base = `report-${safe(type.toLowerCase())}-${safe(start)}_${safe(end)}`;
        return `${base}.pdf`;
    }
    async auditSafe(caller, action, reportId, metadata) {
        try {
            await this.audit.record({
                actorUserId: caller.userId,
                action,
                entityType: 'Report',
                entityId: reportId,
                farmId: caller.farmId,
                metadata,
            });
        }
        catch (err) {
            this.log.error('Report audit write failed', err, {
                reportId,
                action: String(action),
            });
        }
    }
};
exports.ReportsApiService = ReportsApiService;
exports.ReportsApiService = ReportsApiService = ReportsApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(object_storage_port_1.OBJECT_STORAGE)),
    __param(6, (0, common_1.Inject)(reports_api_types_1.REPORT_LIFECYCLE)),
    __param(7, (0, common_1.Inject)(report_ports_1.REPORT_COMPUTE)),
    __param(8, (0, common_1.Inject)(report_ports_1.REPORT_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        permission_service_1.PermissionService,
        farm_clock_service_1.FarmClockService,
        audit_service_1.AuditService,
        logger_service_1.LoggerService, Object, Object, Object, Object])
], ReportsApiService);
//# sourceMappingURL=reports-api.service.js.map