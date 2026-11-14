import { localDateIso } from '../../../../../common/farm-time/farm-time';
import type { MetricId } from '../../../domain/contracts/metric-definition';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ReportException } from '../../../domain/contracts/snapshot';
import {
  compareMetric,
  valueOf,
  type BreakdownRow,
  type Comparison,
  type MetricResult,
  type MetricValue,
} from '../../../domain/contracts/metric-value';
import { buildCoverage, buildDataQuality } from '../../../domain/eligibility';
import { addDaysYmd, enumerateDays } from '../../../domain/period';
import type {
  DomainMetricModule,
  DomainMetricOutput,
  MetricContext,
} from '../metric-context';
import {
  aggregateMilk,
  evaluateSuddenDrops,
  rankCows,
  type MilkAggregate,
  type MilkRow,
} from './milk-aggregation';
import { MILK_DEFINITIONS } from './milk-definitions';
import {
  countUnsubmittedDrafts,
  fetchExpectedSessions,
  fetchSubmittedMilkRows,
} from './milk-fetch';

export const MILK_REASON = {
  noRows: 'reports.milk.no_submitted_rows',
  noRecordedCowDays: 'reports.milk.no_recorded_cow_days',
  noRowsForDay: 'reports.milk.no_rows_for_day',
  noRowsForCow: 'reports.milk.no_rows_for_cow',
  noCompleteData: 'reports.milk.no_complete_data_for_drop_check',
  noExpectedDays: 'reports.milk.expected_days_unknown',
} as const;

const NOT_APPLICABLE: MetricValue = { state: 'not_applicable' };

const result = (
  metricId: MetricId,
  value: MetricValue,
  source: string | null = null,
  comparison: Comparison | null = null,
): MetricResult => ({
  metricId,
  value,
  source,
  comparison,
  requiresPermission: null,
});

const noRowsForCow: MetricValue = {
  state: 'missing',
  reason: MILK_REASON.noRowsForCow,
};

const row = (key: string, value: MetricValue): BreakdownRow => ({
  key,
  label: null,
  value,
  source: null,
});

const withRows = (
  metricId: MetricId,
  value: MetricValue,
  rows: BreakdownRow[],
): MetricResult => ({ ...result(metricId, value), rows });

/** Farm-local days of a period that have started by `generatedAt` (future days are not expected). */
function expectedDays(
  period: ReportPeriod,
  timezone: string,
  generatedAt: Date,
): string[] {
  const today = localDateIso(timezone, generatedAt);
  return enumerateDays(period).filter((d) => d <= today);
}

const totalValue = (a: MilkAggregate, scopeEmpty: boolean): MetricValue =>
  scopeEmpty
    ? NOT_APPLICABLE
    : a.totalYieldL === null
      ? { state: 'missing', reason: MILK_REASON.noRows }
      : valueOf(a.totalYieldL, 'L');

const avgValue = (a: MilkAggregate, scopeEmpty: boolean): MetricValue =>
  scopeEmpty
    ? NOT_APPLICABLE
    : a.avgDailyYieldPerRecordedCowDayL === null
      ? { state: 'missing', reason: MILK_REASON.noRecordedCowDays }
      : valueOf(a.avgDailyYieldPerRecordedCowDayL, 'L');

export function buildMilkOutput(args: {
  current: MilkAggregate;
  previous: MilkAggregate | null;
  currentRows: readonly MilkRow[];
  draftCount: number;
  expectedSessions: Parameters<
    typeof evaluateSuddenDrops
  >[0]['expectedSessions'];
  ctx: Pick<MetricContext, 'cattleIds' | 'thresholds'>;
}): DomainMetricOutput {
  const { current: cur, previous: prev, ctx } = args;
  const scopeEmpty = ctx.cattleIds.length === 0;
  const metrics: MetricResult[] = [];

  const curTotal = totalValue(cur, scopeEmpty);
  const curAvg = avgValue(cur, scopeEmpty);
  metrics.push(
    result(
      'milk.total_yield',
      curTotal,
      null,
      prev ? compareMetric(curTotal, totalValue(prev, false)) : null,
    ),
    result(
      'milk.avg_daily_yield',
      curAvg,
      null,
      prev ? compareMetric(curAvg, avgValue(prev, false)) : null,
    ),
    result(
      'milk.cows_with_data',
      scopeEmpty ? NOT_APPLICABLE : valueOf(cur.cowsWithData, 'cows'),
    ),
    result(
      'milk.expected_cow_days',
      scopeEmpty ? NOT_APPLICABLE : valueOf(cur.expectedCowDays, 'cow-days'),
    ),
    result(
      'milk.recorded_cow_days',
      scopeEmpty ? NOT_APPLICABLE : valueOf(cur.recordedCowDays, 'cow-days'),
    ),
  );

  metrics.push(
    {
      ...result('milk.daily_yield', curTotal),
      series: cur.daily.map((d) => ({
        key: d.date,
        value: scopeEmpty
          ? NOT_APPLICABLE
          : d.yieldL === null
            ? { state: 'missing', reason: MILK_REASON.noRowsForDay }
            : valueOf(d.yieldL, 'L'),
      })),
    },
    withRows('milk.cow_total_yield', curTotal, [
      ...cur.perCow.map((c) => row(c.cattleId, valueOf(c.totalYieldL, 'L'))),
      ...cur.cowsWithoutData.map((id) => row(id, noRowsForCow)),
    ]),
    withRows('milk.cow_avg_daily_yield', curAvg, [
      ...cur.perCow.map((c) =>
        row(c.cattleId, valueOf(c.avgPerRecordedDayL, 'L')),
      ),
      ...cur.cowsWithoutData.map((id) => row(id, noRowsForCow)),
    ]),
    withRows(
      'milk.cow_recorded_days',
      scopeEmpty ? NOT_APPLICABLE : valueOf(cur.recordedCowDays, 'cow-days'),
      cur.perCow.map((c) => row(c.cattleId, valueOf(c.recordedDays, 'days'))),
    ),
    withRows(
      'milk.cow_expected_days',
      scopeEmpty ? NOT_APPLICABLE : valueOf(cur.expectedCowDays, 'cow-days'),
      ctx.cattleIds.map((id) => {
        const n = cur.expectedDaysByCow[id];
        return row(
          id,
          n === undefined
            ? { state: 'missing', reason: MILK_REASON.noExpectedDays }
            : valueOf(n, 'days'),
        );
      }),
    ),
  );

  const { top, bottom } = rankCows(cur.perCow);
  const ranked = (id: MetricId, list: typeof top): MetricResult =>
    withRows(
      id,
      scopeEmpty
        ? NOT_APPLICABLE
        : list.length
          ? valueOf(list.length, 'cows')
          : { state: 'missing', reason: MILK_REASON.noRows },
      list.map((c) => row(c.cattleId, valueOf(c.avgPerRecordedDayL, 'L'))),
    );
  metrics.push(
    ranked('milk.top_cow_avg_yield', top),
    ranked('milk.bottom_cow_avg_yield', bottom),
    withRows(
      'milk.disposition_yield',
      curTotal,
      Object.keys(cur.dispositionTotalsL)
        .sort()
        .map((k) => row(k, valueOf(cur.dispositionTotalsL[k], 'L'))),
    ),
  );

  // Sudden drop: evaluated on the last expected day of the period.
  const drops = evaluateSuddenDrops({
    rows: args.currentRows,
    cattleIds: ctx.cattleIds,
    evaluatedDate: cur.days.length ? cur.days[cur.days.length - 1] : null,
    expectedSessions: args.expectedSessions,
    dropThresholdPct: ctx.thresholds.suddenDropPct,
  });
  metrics.push(
    result(
      'milk.sudden_drop_cows',
      scopeEmpty
        ? NOT_APPLICABLE
        : drops.evaluatedCows === 0
          ? { state: 'not_calculated', reason: MILK_REASON.noCompleteData }
          : valueOf(drops.findings.length, 'cows'),
    ),
  );

  const exceptions: ReportException[] = drops.findings.length
    ? [
        {
          code: 'milk.sudden_drop',
          domain: 'milk',
          messageKey: 'reports.exception.milk.sudden_drop',
          cattleIds: drops.findings.map((f) => f.cattleId),
        },
      ]
    : [];

  return {
    section: {
      id: 'milk',
      domain: 'milk',
      titleKey: 'reports.section.milk',
      metrics,
    },
    exceptions,
    dataQuality: buildDataQuality({
      coverage: buildCoverage(cur.expectedCowDays, cur.recordedCowDays),
      hasUnsubmittedDrafts: args.draftCount > 0,
      hasEstimatedValues: !scopeEmpty && cur.expectedEstimated,
      scopeEmpty,
    }),
  };
}

export const milkMetricModule: DomainMetricModule = {
  definitions: MILK_DEFINITIONS,
  async compute(ctx: MetricContext): Promise<DomainMetricOutput> {
    const days = expectedDays(ctx.period, ctx.timezone, ctx.generatedAt);
    const lastDay = days.length ? days[days.length - 1] : ctx.period.endDate;
    // Reach back 7 days before the last day so the drop baseline is complete.
    const from =
      addDaysYmd(lastDay, -7) < ctx.period.startDate
        ? addDaysYmd(lastDay, -7)
        : ctx.period.startDate;
    const base = { farmId: ctx.farmId, cattleIds: ctx.cattleIds };

    const [rows, draftCount, expectedSessions] = await Promise.all([
      fetchSubmittedMilkRows(ctx.db, {
        ...base,
        from,
        to: ctx.period.endDate,
      }),
      countUnsubmittedDrafts(ctx.db, {
        ...base,
        from: ctx.period.startDate,
        to: ctx.period.endDate,
      }),
      fetchExpectedSessions(ctx.db, ctx.farmId),
    ]);
    const current = aggregateMilk({
      rows,
      cattleIds: ctx.cattleIds,
      days,
      presence: ctx.cattlePresence,
    });

    let previous: MilkAggregate | null = null;
    if (ctx.previousPeriod) {
      const prevDays = expectedDays(
        ctx.previousPeriod,
        ctx.timezone,
        ctx.generatedAt,
      );
      const prevRows = await fetchSubmittedMilkRows(ctx.db, {
        farmId: ctx.farmId,
        cattleIds: ctx.previousCattleIds,
        from: ctx.previousPeriod.startDate,
        to: ctx.previousPeriod.endDate,
      });
      previous = aggregateMilk({
        rows: prevRows,
        cattleIds: ctx.previousCattleIds,
        days: prevDays,
      });
    }

    return buildMilkOutput({
      current,
      previous,
      currentRows: rows,
      draftCount,
      expectedSessions,
      ctx,
    });
  },
};
