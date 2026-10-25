import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import type { DataQuality } from '../../domain/contracts/data-quality';
import type { ReportDomain } from '../../domain/contracts/enums';
import type {
  MetricDefinition,
  MetricId,
  MetricRegistry,
} from '../../domain/contracts/metric-definition';
import type { ReportPeriod } from '../../domain/contracts/period';
import {
  assertNoFinance,
  type ReportException,
  type ReportSnapshotPayload,
  type SnapshotSection,
} from '../../domain/contracts/snapshot';
import type { ReportThresholds } from '../../domain/contracts/template';
import {
  DQ_NOTE,
  evaluatePresence,
  resolveScopeCattleIds,
  type PresencePeriod,
  type ScopeInputCows,
} from '../../domain/eligibility';
import { previousEquivalentPeriod } from '../../domain/period';
import { ReportError } from '../../domain/report-error';
import type {
  DomainMetricModule,
  MetricContext,
} from '../metrics/metric-context';
import {
  buildMetricRegistry,
  METRIC_MODULES,
  METRIC_REGISTRY,
} from '../metrics/registry';
import type {
  ReportComputeInput,
  ReportComputeService as ReportComputePort,
} from '../ports/report-ports';
import {
  REPORT_STATEMENT_TIMEOUT_MS,
  REPORT_TX_MAX_WAIT_MS,
  REPORT_TX_TIMEOUT_MS,
  SNAPSHOT_SCHEMA_VERSION,
} from './report-pipeline.constants';
import { isFarmOwnedKey } from '../../infrastructure/renderer/logo-guard';
import { mergeDataQuality } from './report-data-quality';

/** Optional DI override of the metric modules (tests). Production uses `METRIC_MODULES`. */
export const REPORT_METRIC_MODULES = Symbol('REPORT_METRIC_MODULES');
type ModuleMap = Readonly<Partial<Record<ReportDomain, DomainMetricModule>>>;

/**
 * An exception is only kept when the metric it was derived from is part of the report. The metric
 * modules do not tag exceptions with a metric id, so the link is declared here. An exception whose
 * code is not listed is kept (it cannot be tied to a filtered metric) and is still covered by
 * `assertNoFinance`.
 */
export const EXCEPTION_SOURCE_METRICS: Readonly<Record<string, MetricId[]>> = {
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

/**
 * Metrics whose breakdown `rows` are keyed by cattle id (milk per-cow/top/bottom, feed per-cow). The
 * metric modules emit `label: null` for them; compute fills in tag + name from `Cattle`.
 */
export const COW_KEYED_ROW_METRIC_IDS: readonly MetricId[] = [
  'milk.cow_total_yield',
  'milk.cow_avg_daily_yield',
  'milk.cow_recorded_days',
  'milk.cow_expected_days',
  'milk.top_cow_avg_yield',
  'milk.bottom_cow_avg_yield',
  'feed.offered_minus_refusal_kg',
];

/** Cattle ids per label lookup query (no overall cap: no cow is ever left mislabelled). */
export const COW_LABEL_LOOKUP_BATCH = 1000;

interface CowRow {
  id: string;
  enteredHerdAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  disposition: { date: Date } | null;
}

const ymdOf = (d: Date): string => d.toISOString().slice(0, 10);

function presenceInput(cows: CowRow[], p: ReportPeriod, generatedAt: Date) {
  const period: PresencePeriod = {
    start: new Date(p.start),
    end: new Date(p.end),
    startDate: p.startDate,
    endDate: p.endDate,
  };
  const input: ScopeInputCows = { present: [], absent: {} };
  for (const c of cows) {
    const r = evaluatePresence(
      {
        enteredAt: c.enteredHerdAt,
        createdAt: c.createdAt,
        dispositionDate: c.disposition?.date ?? null,
        deletedAt: c.deletedAt,
      },
      period,
      generatedAt,
    );
    if (r.present) input.present.push({ id: c.id, entrySource: r.entrySource });
    else if (r.reason) input.absent![c.id] = r.reason;
  }
  return input;
}

/**
 * Builds a complete snapshot payload (RPT-09). One `$transaction` at RepeatableRead (first use in the
 * repo): Postgres takes the snapshot at the first statement, so every metric module reads the same
 * database state. Reads only; the only writes of the pipeline happen after this returns.
 */
/**
 * `Farm.logo` has no writer yet: keep it only when it is an object-storage key under the farm's own
 * prefix `farms/<farmId>/` (media module convention); URLs, other tenants and traversal become null.
 * The renderer re-checks against `payload.farm.id` and still sniffs the fetched bytes.
 */
export function logoObjectKey(
  logo: string | null | undefined,
  farmId: string,
): string | null {
  if (!logo) return null;
  const k = logo.trim();
  return isFarmOwnedKey(k, farmId) ? k : null;
}

@Injectable()
export class ReportComputeService implements ReportComputePort {
  private readonly log: LoggerService;
  private readonly modules: ModuleMap;
  private readonly registry: MetricRegistry;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmSettings: FarmSettingsService,
    logger: LoggerService,
    @Optional() @Inject(REPORT_METRIC_MODULES) modules?: ModuleMap,
  ) {
    this.log = logger.setContext(ReportComputeService.name);
    this.modules = modules ?? METRIC_MODULES;
    this.registry = modules ? buildMetricRegistry(modules) : METRIC_REGISTRY;
  }

  async compute(input: ReportComputeInput): Promise<ReportSnapshotPayload> {
    const thresholds = await this.resolveThresholds(input);
    const payload = await this.prisma.$transaction(
      async (tx) => {
        // Cap each statement so one runaway query cannot hold the connection for the whole tx
        // timeout. Numeric constant, validated before interpolation (SET cannot take bind params).
        if (!Number.isSafeInteger(REPORT_STATEMENT_TIMEOUT_MS)) {
          throw new ReportError('INVALID_CONFIG', 'Invalid statement timeout.');
        }
        await tx.$executeRawUnsafe(
          `SET LOCAL statement_timeout = ${REPORT_STATEMENT_TIMEOUT_MS}`,
        );
        return this.build(tx, input, thresholds);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: REPORT_TX_MAX_WAIT_MS,
        timeout: REPORT_TX_TIMEOUT_MS,
      },
    );
    this.log.info('Report snapshot computed', {
      farmId: input.farmId,
      type: input.type,
      sections: payload.sections.length,
    });
    return payload;
  }

  // TODO(RPT-10): thresholds actually used (incl. the farm-overridden suddenDropPct) are not recorded
  // in the snapshot, so they cannot be reconstructed later.
  /** Template thresholds, overridden by the farm's real setting where one exists (sudden-drop %). */
  private async resolveThresholds(
    input: ReportComputeInput,
  ): Promise<ReportThresholds> {
    const base = input.template.thresholds;
    const pct = await this.farmSettings.lactationSuddenDropThresholdPct(
      input.farmId,
    );
    return Number.isFinite(pct) && pct > 0
      ? { ...base, suddenDropPct: pct }
      : base;
  }

  private async build(
    tx: Prisma.TransactionClient,
    input: ReportComputeInput,
    thresholds: ReportThresholds,
  ): Promise<ReportSnapshotPayload> {
    const { farmId, scope, period, generatedAt } = input;
    const farm = await tx.farm.findFirst({
      where: { id: farmId },
      select: { id: true, name: true, timezone: true, logo: true },
    });
    if (!farm) throw new ReportError('INVALID_CONFIG', 'Farm not found.');

    // Every cow is loaded with `where { farmId }`: this set IS the farm-ownership proof.
    const cows: CowRow[] = await tx.cattle.findMany({
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

    let groupMemberIds: string[] = [];
    if (scope.kind === 'SINGLE_COW') {
      if (!cows.some((c) => c.id === scope.cattleId)) {
        throw new ReportError('INVALID_CONFIG', 'Animal not found.');
      }
    } else if (scope.kind === 'GROUP') {
      const group = await tx.animalGroup.findFirst({
        where: { id: scope.groupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new ReportError('INVALID_CONFIG', 'Group not found.');
      const members = await tx.animalGroupMember.findMany({
        where: { groupId: group.id, farmId },
        select: { cattleId: true },
      });
      groupMemberIds = members.map((m) => m.cattleId);
    }

    const curScope = resolveScopeCattleIds(
      scope,
      presenceInput(cows, period, generatedAt),
      groupMemberIds,
    );
    const prev = previousEquivalentPeriod(period, generatedAt).previous;
    const prevScope = resolveScopeCattleIds(
      scope,
      presenceInput(cows, prev, generatedAt),
      groupMemberIds,
    );

    const inScope = new Set(curScope.cattleIds);
    const tz = period.timezone;
    const cattlePresence = new Map<
      string,
      { startDate: string; endDate: string }
    >();
    for (const c of cows) {
      if (!inScope.has(c.id)) continue;
      const entry = c.enteredHerdAt
        ? ymdOf(c.enteredHerdAt)
        : localDateIso(tz, c.createdAt);
      const exit = c.disposition ? ymdOf(c.disposition.date) : null;
      cattlePresence.set(c.id, {
        startDate: entry > period.startDate ? entry : period.startDate,
        endDate: exit && exit < period.endDate ? exit : period.endDate,
      });
    }

    const includeFinance = input.includeFinance;
    const selected = new Set<string>(
      input.selectedMetricIds.filter((id) => {
        const def = this.registry[id];
        return includeFinance || !def || !this.isFinanceDef(def);
      }),
    );

    const baseCtx: Omit<MetricContext, 'db'> = {
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

    // Template order is the section order. Each domain module runs once, and only when at least one of
    // its sections still has a selected metric.
    const outputs = new Map<
      ReportDomain,
      Awaited<ReturnType<DomainMetricModule['compute']>>
    >();
    const sections: SnapshotSection[] = [];
    const parts: DataQuality[] = [];
    const exceptions: ReportException[] = [];
    const emitted = new Set<string>();

    for (const ts of input.template.sections) {
      if (ts.domain === 'finance' && !includeFinance) continue;
      const mod = this.modules[ts.domain];
      if (!mod) continue;
      const wanted = new Set(ts.metricIds.filter((m) => selected.has(m)));
      if (wanted.size === 0) continue;

      let out = outputs.get(ts.domain);
      if (!out) {
        out = await mod.compute({ ...baseCtx, db: tx });
        outputs.set(ts.domain, out);
        parts.push(out.dataQuality);
      }
      if (!out.section) continue;
      const metrics = out.section.metrics.filter(
        (m) => wanted.has(m.metricId) && !emitted.has(m.metricId),
      );
      if (metrics.length === 0) continue;
      for (const m of metrics) emitted.add(m.metricId);
      sections.push({
        id: ts.id,
        domain: ts.domain,
        titleKey: ts.titleKey,
        metrics,
      });
    }
    for (const out of outputs.values()) {
      for (const e of out.exceptions) {
        const sources = EXCEPTION_SOURCE_METRICS[e.code];
        if (!sources || sources.some((s) => emitted.has(s))) exceptions.push(e);
      }
    }

    // Scope-level quality facts the metric modules do not know about.
    const scopeDq: DataQuality = {
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
    if (curScope.isEmpty) scopeDq.notes.push(DQ_NOTE.scopeEmpty);
    if (curScope.usesCreatedAtProxy) scopeDq.notes.push(DQ_NOTE.entryDateProxy);
    if (curScope.groupMembershipCurrentOnly)
      scopeDq.notes.push(DQ_NOTE.groupMembershipCurrentOnly);

    const used: MetricDefinition[] = [];
    for (const id of emitted) {
      const def = this.registry[id];
      if (!def) {
        throw new ReportError(
          'INVALID_CONFIG',
          'Report definition does not match the metric registry.',
        );
      }
      used.push(def);
    }

    await this.labelCowRows(tx, farmId, sections);

    const payload: ReportSnapshotPayload = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
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
      dataQuality: mergeDataQuality([scopeDq, ...parts]),
    };

    if (!includeFinance) {
      if (used.some((d) => this.isFinanceDef(d))) {
        throw new ReportError(
          'PERMISSION_DENIED',
          'Finance data is not allowed in this report.',
        );
      }
      try {
        assertNoFinance(payload);
      } catch {
        // The thrown text names metrics; the persisted message must stay generic.
        throw new ReportError(
          'PERMISSION_DENIED',
          'Finance data is not allowed in this report.',
        );
      }
    }
    return payload;
  }

  /** Fills `label` (tag + name) on cow-keyed rows with one farm-scoped query. Unknown ids stay null. */
  private async labelCowRows(
    tx: Prisma.TransactionClient,
    farmId: string,
    sections: SnapshotSection[],
  ): Promise<void> {
    const ids = new Set<string>();
    for (const s of sections) {
      for (const m of s.metrics) {
        if (!COW_KEYED_ROW_METRIC_IDS.includes(m.metricId)) continue;
        for (const r of m.rows ?? []) {
          if (r.label === null) ids.add(r.key);
        }
      }
    }
    if (ids.size === 0) return;
    const all = [...ids];
    const found: {
      id: string;
      tagNumber: string | null;
      name: string | null;
    }[] = [];
    for (let i = 0; i < all.length; i += COW_LABEL_LOOKUP_BATCH) {
      found.push(
        ...(await tx.cattle.findMany({
          where: {
            farmId,
            id: { in: all.slice(i, i + COW_LABEL_LOOKUP_BATCH) },
          },
          select: { id: true, tagNumber: true, name: true },
        })),
      );
    }
    const labels = new Map<string, string>();
    for (const c of found) {
      const tag = (c.tagNumber ?? '').trim();
      const name = (c.name ?? '').trim();
      const label = tag + (name ? (tag ? ' ' : '') + name : '');
      if (label) labels.set(c.id, label);
    }
    for (const s of sections) {
      s.metrics = s.metrics.map((m) =>
        COW_KEYED_ROW_METRIC_IDS.includes(m.metricId) && m.rows
          ? {
              ...m,
              rows: m.rows.map((r) =>
                r.label === null && labels.has(r.key)
                  ? { ...r, label: labels.get(r.key) as string }
                  : r,
              ),
            }
          : m,
      );
    }
  }

  private isFinanceDef(def: MetricDefinition): boolean {
    return (
      def.requiresPermission === 'finance.read' ||
      def.unit === 'BDT' ||
      def.unit.startsWith('BDT/')
    );
  }
}
