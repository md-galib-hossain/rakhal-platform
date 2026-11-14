import type {
  BreakdownRow,
  MetricResult,
  MetricValue,
  SeriesPoint,
} from '../../domain/contracts/metric-value';
import { compareMetric, valueOf } from '../../domain/contracts/metric-value';
import type { ReportPeriod } from '../../domain/contracts/period';
import type {
  ReportSnapshotPayload,
  SnapshotSection,
} from '../../domain/contracts/snapshot';
import type { MetricId } from '../../domain/contracts/metric-definition';

/** Test fixtures for the PDF renderer. All numbers are synthetic. */

const period = (
  startDate: string,
  endDate: string,
  label: string,
): ReportPeriod => ({
  start: `${startDate}T00:00:00.000Z`,
  end: `${endDate}T23:59:59.000Z`,
  startDate,
  endDate,
  timezone: 'Asia/Dhaka',
  label,
});

const m = (
  metricId: string,
  value: MetricValue,
  extra: Partial<MetricResult> = {},
): MetricResult => ({
  metricId: metricId as MetricId,
  value,
  source: null,
  comparison: null,
  requiresPermission: null,
  ...extra,
});

const withPrev = (
  id: string,
  cur: number,
  prev: number,
  unit: string,
): MetricResult =>
  m(id, valueOf(cur, unit), {
    comparison: compareMetric(valueOf(cur, unit), valueOf(prev, unit)),
  });

const days = (start: string, n: number): string[] => {
  const [y, mo, d] = start.split('-').map(Number);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(y, mo - 1, d + i)).toISOString().slice(0, 10),
  );
};

export function dailySeries(
  start: string,
  n: number,
  gapAt: number[] = [],
): SeriesPoint[] {
  return days(start, n).map((key, i) => ({
    key,
    value: gapAt.includes(i)
      ? { state: 'missing', reason: 'reports.milk.no_rows_for_day' }
      : valueOf(280 + ((i * 37) % 60) + i, 'L'),
  }));
}

export function cowRows(
  n: number,
  names?: (i: number) => string | null,
): {
  total: BreakdownRow[];
  avg: BreakdownRow[];
  rec: BreakdownRow[];
  exp: BreakdownRow[];
} {
  const mk = (f: (i: number) => MetricValue): BreakdownRow[] =>
    Array.from({ length: n }, (_, i) => ({
      key: `cow-${String(i).padStart(5, '0')}-uuid`,
      label: names ? names(i) : `SDF-${String(i + 1).padStart(3, '0')}`,
      value: f(i),
      source: null,
    }));
  const noRec = (i: number): boolean => i % 97 === 5;
  return {
    total: mk((i) =>
      noRec(i)
        ? { state: 'missing', reason: 'reports.milk.no_rows_for_cow' }
        : valueOf(Math.round((90 + ((i * 13) % 140)) * 10) / 10 + 0.5, 'L'),
    ),
    avg: mk((i) =>
      noRec(i)
        ? { state: 'missing', reason: 'reports.milk.no_rows_for_cow' }
        : valueOf(Math.round((12 + ((i * 7) % 90) / 10) * 100) / 100, 'L'),
    ),
    rec: mk((i) =>
      noRec(i)
        ? valueOf(0, 'days')
        : valueOf(7 - (i % 3 === 0 ? 1 : 0), 'days'),
    ),
    exp: mk(() => valueOf(7, 'days')),
  };
}

function milkSection(opts: {
  nDays: number;
  cows: number;
  names?: (i: number) => string | null;
  start: string;
  gaps?: number[];
}): SnapshotSection {
  const c = cowRows(opts.cows, opts.names);
  return {
    id: 'milk.overview',
    domain: 'milk',
    titleKey: 'reports.section.milk',
    metrics: [
      withPrev('milk.total_yield', 2184.5, 2045, 'L'),
      withPrev('milk.avg_daily_yield', 7.57, 7.4, 'L'),
      m('milk.cows_with_data', valueOf(42, 'cows')),
      m('milk.expected_cow_days', valueOf(294, 'cow-days')),
      m('milk.recorded_cow_days', valueOf(280, 'cow-days')),
      m('milk.daily_yield', valueOf(2184.5, 'L'), {
        series: dailySeries(opts.start, opts.nDays, opts.gaps),
      }),
      m('milk.cow_total_yield', valueOf(2184.5, 'L'), { rows: c.total }),
      m('milk.cow_avg_daily_yield', valueOf(7.57, 'L'), { rows: c.avg }),
      m('milk.cow_recorded_days', valueOf(280, 'cow-days'), { rows: c.rec }),
      m('milk.cow_expected_days', valueOf(294, 'cow-days'), { rows: c.exp }),
      m('milk.disposition_yield', valueOf(2184.5, 'L'), {
        rows: [
          { key: 'SOLD', label: null, value: valueOf(1900, 'L'), source: null },
          {
            key: 'HOME_USE',
            label: null,
            value: valueOf(184.5, 'L'),
            source: null,
          },
          { key: 'CALF', label: null, value: valueOf(100, 'L'), source: null },
        ],
      }),
    ],
  };
}

const healthSection = (): SnapshotSection => ({
  id: 'health.overview',
  domain: 'health',
  titleKey: 'reports.section.health',
  metrics: [
    withPrev('health.cases_opened', 6, 4, 'count'),
    m('health.cows_with_cases_opened', valueOf(5, 'cows')),
    m('health.cases_recovered', valueOf(2, 'count')),
    m('health.cases_open_at_period_end', valueOf(4, 'count')),
    m('health.tasks_overdue', valueOf(1, 'count')),
    m('health.cases_repeated', {
      state: 'not_calculated',
      reason: 'incomplete data',
    }),
  ],
});

const reproSection = (): SnapshotSection => ({
  id: 'reproduction.overview',
  domain: 'reproduction',
  titleKey: 'reports.section.reproduction',
  metrics: [
    m('reproduction.services_total', valueOf(3, 'count')),
    m('reproduction.outcomes_pending', valueOf(2, 'count')),
    m('reproduction.conception_rate', {
      state: 'not_calculated',
      reason: 'small cohort',
    }),
    withPrev('reproduction.calvings', 2, 0, 'count'),
  ],
});

const feedSection = (nCows: number): SnapshotSection => ({
  id: 'feed.overview',
  domain: 'feed',
  titleKey: 'reports.section.feed',
  metrics: [
    m('feed.recorded_actual_kg', valueOf(742, 'kg'), {
      source: 'recordedActual',
      rows: [
        {
          key: 'g',
          label: 'Green fodder',
          value: valueOf(318, 'kg'),
          source: null,
        },
        {
          key: 'c',
          label: 'Concentrate mix',
          value: valueOf(246, 'kg'),
          source: null,
        },
        {
          key: 'r',
          label: 'Rice straw',
          value: valueOf(143, 'kg'),
          source: null,
        },
        {
          key: 'mm',
          label: 'Mineral mix',
          value: valueOf(35, 'kg'),
          source: null,
        },
      ],
    }),
    m('feed.offered_minus_refusal_kg', valueOf(820, 'kg'), {
      source: 'offeredMinusRefusal',
      rows: Array.from({ length: Math.min(nCows, 50) }, (_, i) => ({
        key: `cow-${i}`,
        label: `SDF-${String(i + 1).padStart(3, '0')}`,
        value: valueOf(14 + (i % 9), 'kg'),
        source: 'offeredMinusRefusal',
      })),
    }),
    m('feed.fit_off_target_share', { state: 'not_applicable' }),
  ],
});

const financeSection = (): SnapshotSection => ({
  id: 'finance.overview',
  domain: 'finance',
  titleKey: 'reports.sections.finance',
  metrics: [
    withPrev('finance.cash_received', 482600, 410000, 'BDT'),
    m('finance.cash_paid', valueOf(361240, 'BDT')),
    m('finance.net_cash_flow', valueOf(121360, 'BDT')),
  ].map((x) => ({
    ...x,
    source: 'cash_ledger',
    requiresPermission: 'finance.read',
  })),
});

const base = (
  p: ReportPeriod,
  includesFinance: boolean,
  sections: SnapshotSection[],
  prev?: ReportPeriod,
): ReportSnapshotPayload => ({
  schemaVersion: 1,
  calcVersion: 1,
  templateVersion: 1,
  farm: {
    id: 'farm-1',
    name: 'Shapla Dairy Farm',
    timezone: 'Asia/Dhaka',
    logoKey: null,
  },
  period: p,
  previousPeriod: prev,
  scope: { kind: 'ALL_ELIGIBLE' },
  generatedAt: '2026-10-19T04:32:00.000Z',
  includesFinance,
  sections,
  exceptions: [
    {
      code: 'milk.sudden_drop',
      domain: 'milk',
      messageKey: 'reports.exception.milk.sudden_drop',
      cattleIds: ['a', 'b'],
    },
    {
      code: 'health.overdue_tasks',
      domain: 'health',
      messageKey: 'reports.exceptions.health.overdue_tasks',
      cattleIds: ['c'],
    },
  ],
  dataQuality: {
    coverage: { expected: 294, recorded: 280 },
    notes: [
      'reports.dq.unsubmitted_drafts_excluded',
      'reports.dq.brand_new_unknown_key',
    ],
    flags: {
      incompleteCoverage: true,
      hasUnsubmittedDrafts: true,
      hasEstimatedValues: false,
      hasUnknownCosts: false,
      groupMembershipCurrentOnly: false,
    },
  },
});

export const weeklyPayload = (includesFinance = true): ReportSnapshotPayload =>
  base(
    period('2026-10-12', '2026-10-18', '2026-W42'),
    includesFinance,
    [
      milkSection({ nDays: 7, cows: 25, start: '2026-10-12', gaps: [3] }),
      healthSection(),
      reproSection(),
      feedSection(25),
      ...(includesFinance ? [financeSection()] : []),
    ],
    period('2026-10-05', '2026-10-11', '2026-W41'),
  );

export const monthlyPayload = (cows = 2000): ReportSnapshotPayload =>
  base(
    period('2026-09-01', '2026-09-30', 'September 2026'),
    true,
    [
      milkSection({ nDays: 30, cows, start: '2026-09-01', gaps: [4, 5] }),
      healthSection(),
      reproSection(),
      feedSection(cows),
      financeSection(),
    ],
    period('2026-08-01', '2026-08-31', 'August 2026'),
  );

export const onDemandPayload = (): ReportSnapshotPayload =>
  base(period('2026-10-13', '2026-10-19', 'Custom'), true, [
    milkSection({ nDays: 7, cows: 12, start: '2026-10-13' }),
    healthSection(),
    financeSection(),
  ]);

const BANGLA = [
  'লক্ষ্মী',
  'গাভী ক্ষীর',
  'শ্রীমতী',
  'কালো মানিক',
  'রূপালী',
  'বাসন্তী',
];
export const banglaPayload = (): ReportSnapshotPayload => {
  const p = weeklyPayload(true);
  p.farm.name = 'শাপলা ডেইরি ফার্ম, গাজীপুর';
  p.sections[0] = milkSection({
    nDays: 7,
    cows: 14,
    start: '2026-10-12',
    names: (i) => `${BANGLA[i % BANGLA.length]} ${i + 1}`,
  });
  return p;
};

export const allMissingPayload = (): ReportSnapshotPayload => {
  const miss: MetricValue = {
    state: 'missing',
    reason: 'reports.milk.no_submitted_rows',
  };
  const p = weeklyPayload(false);
  p.sections = [
    {
      id: 'milk.overview',
      domain: 'milk',
      titleKey: 'reports.section.milk',
      metrics: [
        m('milk.total_yield', miss),
        m('milk.avg_daily_yield', miss),
        m('milk.daily_yield', miss, {
          series: dailySeries('2026-10-12', 7).map((s) => ({
            ...s,
            value: miss,
          })),
        }),
        m('milk.cow_total_yield', miss, { rows: [] }),
      ],
    },
  ];
  p.exceptions = [];
  return p;
};

/**
 * Edge cases for the layout/PDF review fixes: a 12-slice donut with an unrecorded row, a one-point series,
 * a bar series with a negative and a tiny value, and a null-label breakdown row.
 */
export const edgePayload = (includesFinance = true): ReportSnapshotPayload => {
  const p = weeklyPayload(includesFinance);
  const milk = p.sections[0];
  milk.metrics = milk.metrics.filter(
    (x) => x.metricId !== 'milk.disposition_yield',
  );
  const slice = (i: number): BreakdownRow => ({
    key: `DISP_${i}`,
    label: null,
    value: valueOf(100 - i * 6, 'L'),
    source: null,
  });
  milk.metrics.push(
    m('milk.disposition_yield', valueOf(1000, 'L'), {
      rows: [
        ...Array.from({ length: 12 }, (_, i) => slice(i)),
        {
          key: 'GONE',
          label: null,
          value: { state: 'missing', reason: 'reports.milk.no_rows_for_day' },
          source: null,
        },
      ],
    }),
    m('milk.fat_percent_trend', valueOf(3.9, '%'), {
      series: [{ key: '2026-10-12', value: valueOf(3.9, '%') }],
    }),
    m('milk.shed_yield', valueOf(0.04, 'L'), {
      series: [
        { key: 'Shed A', value: valueOf(0.04, 'L') },
        {
          key: 'Shed B with a very long descriptive name',
          value: valueOf(-1.5, 'L'),
        },
        { key: 'Shed C', value: valueOf(2.25, 'L') },
      ],
    }),
  );
  return p;
};
