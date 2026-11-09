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
var ReportComputeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportComputeService = exports.COW_LABEL_LOOKUP_BATCH = exports.COW_KEYED_ROW_METRIC_IDS = exports.EXCEPTION_SOURCE_METRICS = exports.REPORT_METRIC_MODULES = void 0;
exports.logoObjectKey = logoObjectKey;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_time_1 = require("src/common/farm-time/farm-time");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const snapshot_1 = require("../../domain/contracts/snapshot");
const eligibility_1 = require("../../domain/eligibility");
const period_1 = require("../../domain/period");
const report_error_1 = require("../../domain/report-error");
const registry_1 = require("../metrics/registry");
const report_pipeline_constants_1 = require("./report-pipeline.constants");
const logo_guard_1 = require("../../infrastructure/renderer/logo-guard");
const report_data_quality_1 = require("./report-data-quality");
exports.REPORT_METRIC_MODULES = Symbol('REPORT_METRIC_MODULES');
exports.EXCEPTION_SOURCE_METRICS = {
    'milk.sudden_drop': ['milk.sudden_drop_cows'],
    'health.overdue_tasks': ['health.tasks_overdue'],
    'health.repeated_cases': ['health.cases_repeated'],
    'reproduction.pregnancy_check_overdue': [
        'reproduction.pregnancy_checks_overdue',
    ],
    'reproduction.repeated_failed_services': [
        'reproduction.repeated_failed_services',
    ],
    'feed.low_stock_items': ['feed.low_stock_items'],
    'feed.persistently_off_target': ['feed.fit_off_target_share'],
};
exports.COW_KEYED_ROW_METRIC_IDS = [
    'milk.cow_total_yield',
    'milk.cow_avg_daily_yield',
    'milk.cow_recorded_days',
    'milk.cow_expected_days',
    'milk.top_cow_avg_yield',
    'milk.bottom_cow_avg_yield',
    'feed.offered_minus_refusal_kg',
];
exports.COW_LABEL_LOOKUP_BATCH = 1000;
const ymdOf = (d) => d.toISOString().slice(0, 10);
function presenceInput(cows, p, generatedAt) {
    const period = {
        start: new Date(p.start),
        end: new Date(p.end),
        startDate: p.startDate,
        endDate: p.endDate,
    };
    const input = { present: [], absent: {} };
    for (const c of cows) {
        const r = (0, eligibility_1.evaluatePresence)({
            enteredAt: c.enteredHerdAt,
            createdAt: c.createdAt,
            dispositionDate: c.disposition?.date ?? null,
            deletedAt: c.deletedAt,
        }, period, generatedAt);
        if (r.present)
            input.present.push({ id: c.id, entrySource: r.entrySource });
        else if (r.reason)
            input.absent[c.id] = r.reason;
    }
    return input;
}
function logoObjectKey(logo, farmId) {
    if (!logo)
        return null;
    const k = logo.trim();
    return (0, logo_guard_1.isFarmOwnedKey)(k, farmId) ? k : null;
}
let ReportComputeService = ReportComputeService_1 = class ReportComputeService {
    prisma;
    farmSettings;
    log;
    modules;
    registry;
    constructor(prisma, farmSettings, logger, modules) {
        this.prisma = prisma;
        this.farmSettings = farmSettings;
        this.log = logger.setContext(ReportComputeService_1.name);
        this.modules = modules ?? registry_1.METRIC_MODULES;
        this.registry = modules ? (0, registry_1.buildMetricRegistry)(modules) : registry_1.METRIC_REGISTRY;
    }
    async compute(input) {
        const thresholds = await this.resolveThresholds(input);
        const payload = await this.prisma.$transaction(async (tx) => {
            if (!Number.isSafeInteger(report_pipeline_constants_1.REPORT_STATEMENT_TIMEOUT_MS)) {
                throw new report_error_1.ReportError('INVALID_CONFIG', 'Invalid statement timeout.');
            }
            await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${report_pipeline_constants_1.REPORT_STATEMENT_TIMEOUT_MS}`);
            return this.build(tx, input, thresholds);
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
            maxWait: report_pipeline_constants_1.REPORT_TX_MAX_WAIT_MS,
            timeout: report_pipeline_constants_1.REPORT_TX_TIMEOUT_MS,
        });
        this.log.info('Report snapshot computed', {
            farmId: input.farmId,
            type: input.type,
            sections: payload.sections.length,
        });
        return payload;
    }
    async resolveThresholds(input) {
        const base = input.template.thresholds;
        const pct = await this.farmSettings.lactationSuddenDropThresholdPct(input.farmId);
        return Number.isFinite(pct) && pct > 0
            ? { ...base, suddenDropPct: pct }
            : base;
    }
    async build(tx, input, thresholds) {
        const { farmId, scope, period, generatedAt } = input;
        const farm = await tx.farm.findFirst({
            where: { id: farmId },
            select: { id: true, name: true, timezone: true, logo: true },
        });
        if (!farm)
            throw new report_error_1.ReportError('INVALID_CONFIG', 'Farm not found.');
        const cows = await tx.cattle.findMany({
            where: { farmId },
            select: {
                id: true,
                enteredHerdAt: true,
                createdAt: true,
                deletedAt: true,
                disposition: { select: { date: true } },
            },
            orderBy: { id: 'asc' },
        });
        let groupMemberIds = [];
        if (scope.kind === 'SINGLE_COW') {
            if (!cows.some((c) => c.id === scope.cattleId)) {
                throw new report_error_1.ReportError('INVALID_CONFIG', 'Animal not found.');
            }
        }
        else if (scope.kind === 'GROUP') {
            const group = await tx.animalGroup.findFirst({
                where: { id: scope.groupId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!group)
                throw new report_error_1.ReportError('INVALID_CONFIG', 'Group not found.');
            const members = await tx.animalGroupMember.findMany({
                where: { groupId: group.id, farmId },
                select: { cattleId: true },
            });
            groupMemberIds = members.map((m) => m.cattleId);
        }
        const curScope = (0, eligibility_1.resolveScopeCattleIds)(scope, presenceInput(cows, period, generatedAt), groupMemberIds);
        const prev = (0, period_1.previousEquivalentPeriod)(period, generatedAt).previous;
        const prevScope = (0, eligibility_1.resolveScopeCattleIds)(scope, presenceInput(cows, prev, generatedAt), groupMemberIds);
        const inScope = new Set(curScope.cattleIds);
        const tz = period.timezone;
        const cattlePresence = new Map();
        for (const c of cows) {
            if (!inScope.has(c.id))
                continue;
            const entry = c.enteredHerdAt
                ? ymdOf(c.enteredHerdAt)
                : (0, farm_time_1.localDateIso)(tz, c.createdAt);
            const exit = c.disposition ? ymdOf(c.disposition.date) : null;
            cattlePresence.set(c.id, {
                startDate: entry > period.startDate ? entry : period.startDate,
                endDate: exit && exit < period.endDate ? exit : period.endDate,
            });
        }
        const includeFinance = input.includeFinance;
        const selected = new Set(input.selectedMetricIds.filter((id) => {
            const def = this.registry[id];
            return includeFinance || !def || !this.isFinanceDef(def);
        }));
        const baseCtx = {
            farmId,
            timezone: tz,
            period,
            previousPeriod: prev,
            scopeKind: scope.kind,
            cattleIds: curScope.cattleIds,
            previousCattleIds: prevScope.cattleIds,
            cattlePresence,
            generatedAt,
            thresholds,
            includeFinance,
        };
        const outputs = new Map();
        const sections = [];
        const parts = [];
        const exceptions = [];
        const emitted = new Set();
        for (const ts of input.template.sections) {
            if (ts.domain === 'finance' && !includeFinance)
                continue;
            const mod = this.modules[ts.domain];
            if (!mod)
                continue;
            const wanted = new Set(ts.metricIds.filter((m) => selected.has(m)));
            if (wanted.size === 0)
                continue;
            let out = outputs.get(ts.domain);
            if (!out) {
                out = await mod.compute({ ...baseCtx, db: tx });
                outputs.set(ts.domain, out);
                parts.push(out.dataQuality);
            }
            if (!out.section)
                continue;
            const metrics = out.section.metrics.filter((m) => wanted.has(m.metricId) && !emitted.has(m.metricId));
            if (metrics.length === 0)
                continue;
            for (const m of metrics)
                emitted.add(m.metricId);
            sections.push({
                id: ts.id,
                domain: ts.domain,
                titleKey: ts.titleKey,
                metrics,
            });
        }
        for (const out of outputs.values()) {
            for (const e of out.exceptions) {
                const sources = exports.EXCEPTION_SOURCE_METRICS[e.code];
                if (!sources || sources.some((s) => emitted.has(s)))
                    exceptions.push(e);
            }
        }
        const scopeDq = {
            coverage: { expected: 0, recorded: 0 },
            notes: [],
            flags: {
                incompleteCoverage: false,
                hasUnsubmittedDrafts: false,
                hasEstimatedValues: curScope.usesCreatedAtProxy,
                hasUnknownCosts: false,
                groupMembershipCurrentOnly: curScope.groupMembershipCurrentOnly,
            },
        };
        if (curScope.isEmpty)
            scopeDq.notes.push(eligibility_1.DQ_NOTE.scopeEmpty);
        if (curScope.usesCreatedAtProxy)
            scopeDq.notes.push(eligibility_1.DQ_NOTE.entryDateProxy);
        if (curScope.groupMembershipCurrentOnly)
            scopeDq.notes.push(eligibility_1.DQ_NOTE.groupMembershipCurrentOnly);
        const used = [];
        for (const id of emitted) {
            const def = this.registry[id];
            if (!def) {
                throw new report_error_1.ReportError('INVALID_CONFIG', 'Report definition does not match the metric registry.');
            }
            used.push(def);
        }
        await this.labelCowRows(tx, farmId, sections);
        const payload = {
            schemaVersion: report_pipeline_constants_1.SNAPSHOT_SCHEMA_VERSION,
            reportType: input.type,
            calcVersion: Math.max(1, ...used.map((d) => d.calcVersion)),
            templateVersion: input.template.version,
            farm: {
                id: farm.id,
                name: farm.name,
                timezone: farm.timezone,
                logoKey: logoObjectKey(farm.logo, farmId),
            },
            period,
            previousPeriod: prev,
            scope,
            generatedAt: generatedAt.toISOString(),
            includesFinance: includeFinance,
            sections,
            exceptions,
            dataQuality: (0, report_data_quality_1.mergeDataQuality)([scopeDq, ...parts]),
        };
        if (!includeFinance) {
            if (used.some((d) => this.isFinanceDef(d))) {
                throw new report_error_1.ReportError('PERMISSION_DENIED', 'Finance data is not allowed in this report.');
            }
            try {
                (0, snapshot_1.assertNoFinance)(payload);
            }
            catch {
                throw new report_error_1.ReportError('PERMISSION_DENIED', 'Finance data is not allowed in this report.');
            }
        }
        return payload;
    }
    async labelCowRows(tx, farmId, sections) {
        const ids = new Set();
        for (const s of sections) {
            for (const m of s.metrics) {
                if (!exports.COW_KEYED_ROW_METRIC_IDS.includes(m.metricId))
                    continue;
                for (const r of m.rows ?? []) {
                    if (r.label === null)
                        ids.add(r.key);
                }
            }
        }
        if (ids.size === 0)
            return;
        const all = [...ids];
        const found = [];
        for (let i = 0; i < all.length; i += exports.COW_LABEL_LOOKUP_BATCH) {
            found.push(...(await tx.cattle.findMany({
                where: {
                    farmId,
                    id: { in: all.slice(i, i + exports.COW_LABEL_LOOKUP_BATCH) },
                },
                select: { id: true, tagNumber: true, name: true },
            })));
        }
        const labels = new Map();
        for (const c of found) {
            const tag = (c.tagNumber ?? '').trim();
            const name = (c.name ?? '').trim();
            const label = tag + (name ? (tag ? ' ' : '') + name : '');
            if (label)
                labels.set(c.id, label);
        }
        for (const s of sections) {
            s.metrics = s.metrics.map((m) => exports.COW_KEYED_ROW_METRIC_IDS.includes(m.metricId) && m.rows
                ? {
                    ...m,
                    rows: m.rows.map((r) => r.label === null && labels.has(r.key)
                        ? { ...r, label: labels.get(r.key) }
                        : r),
                }
                : m);
        }
    }
    isFinanceDef(def) {
        return (def.requiresPermission === 'finance.read' ||
            def.unit === 'BDT' ||
            def.unit.startsWith('BDT/'));
    }
};
exports.ReportComputeService = ReportComputeService;
exports.ReportComputeService = ReportComputeService = ReportComputeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __param(3, (0, common_1.Inject)(exports.REPORT_METRIC_MODULES)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_settings_service_1.FarmSettingsService,
        logger_service_1.LoggerService, Object])
], ReportComputeService);
//# sourceMappingURL=report-compute.service.js.map