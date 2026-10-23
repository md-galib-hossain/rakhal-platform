import {
  assertNoFinance,
  FINANCE_SOURCE_DENYLIST,
  type ReportSnapshotPayload,
} from './snapshot';
import type { MetricResult, MetricValue } from './metric-value';
import type { MetricId } from './metric-definition';
import { scheduledReportKey } from './job-key';

const payload = (
  metrics: MetricResult[],
  exceptions: ReportSnapshotPayload['exceptions'] = [],
): ReportSnapshotPayload => ({
  schemaVersion: 1,
  calcVersion: 1,
  templateVersion: 1,
  farm: { id: 'f', name: 'F', timezone: 'Asia/Dhaka' },
  period: {
    start: '2026-10-18T18:00:00.000Z',
    end: '2026-10-25T18:00:00.000Z',
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    timezone: 'Asia/Dhaka',
    label: 'x',
  },
  scope: { kind: 'ALL_ELIGIBLE' },
  generatedAt: '2026-10-26T00:00:00.000Z',
  includesFinance: false,
  sections: [{ id: 's', domain: 'feed', titleKey: 't', metrics }],
  exceptions,
  dataQuality: {
    coverage: { expected: 0, recorded: 0 },
    notes: [],
    flags: {
      incompleteCoverage: false,
      hasUnsubmittedDrafts: false,
      hasEstimatedValues: false,
      hasUnknownCosts: false,
      groupMembershipCurrentOnly: false,
    },
  },
});

const NA: MetricValue = { state: 'not_applicable' };
const bdt = (unit = 'BDT'): MetricValue => ({ state: 'value', value: 1, unit });
const metric = (over: Partial<MetricResult> = {}): MetricResult => ({
  metricId: 'feed.total_kg',
  value: NA,
  source: null,
  comparison: null,
  requiresPermission: null,
  ...over,
});
const cmp = (current: MetricValue, previous: MetricValue) => ({
  current,
  previous,
  absoluteChange: null,
  percentChange: null,
  previousState: previous.state,
});

describe('assertNoFinance hardening', () => {
  it('passes a clean metric', () =>
    expect(() => assertNoFinance(payload([metric()]))).not.toThrow());

  it('throws on BDT unit even without requiresPermission', () =>
    expect(() =>
      assertNoFinance(payload([metric({ value: bdt() })])),
    ).toThrow());

  it('throws on BDT/ rate units', () => {
    expect(() =>
      assertNoFinance(payload([metric({ value: bdt('BDT/kg') })])),
    ).toThrow();
    expect(() =>
      assertNoFinance(payload([metric({ value: bdt('BDT/L') })])),
    ).toThrow();
  });

  it('does not treat unrelated units as finance', () =>
    expect(() =>
      assertNoFinance(
        payload([metric({ value: { state: 'value', value: 1, unit: 'kg' } })]),
      ),
    ).not.toThrow());

  it('throws on a finance. metric id', () =>
    expect(() =>
      assertNoFinance(
        payload([metric({ metricId: 'finance.net' as MetricId })]),
      ),
    ).toThrow());

  it.each([...FINANCE_SOURCE_DENYLIST, 'ledger_other', 'ledgerX'])(
    'throws on source %s',
    (source) =>
      expect(() => assertNoFinance(payload([metric({ source })]))).toThrow(),
  );

  it('throws on a denylisted row source', () =>
    expect(() =>
      assertNoFinance(
        payload([
          metric({
            rows: [{ key: 'a', label: null, value: NA, source: 'vet_fee' }],
          }),
        ]),
      ),
    ).toThrow());

  it('throws on a BDT row value', () =>
    expect(() =>
      assertNoFinance(
        payload([
          metric({
            rows: [{ key: 'a', label: null, value: bdt(), source: null }],
          }),
        ]),
      ),
    ).toThrow());

  it('throws on a BDT series point', () =>
    expect(() =>
      assertNoFinance(
        payload([metric({ series: [{ key: '2026-10-19', value: bdt() }] })]),
      ),
    ).toThrow());

  it('throws on BDT hidden in comparison current or previous', () => {
    expect(() =>
      assertNoFinance(payload([metric({ comparison: cmp(bdt(), NA) })])),
    ).toThrow();
    expect(() =>
      assertNoFinance(payload([metric({ comparison: cmp(NA, bdt()) })])),
    ).toThrow();
  });

  it.each(['feed_cost_high', 'CASH_GAP', 'ledger_mismatch'])(
    'throws on exception code %s',
    (code) =>
      expect(() =>
        assertNoFinance(
          payload([], [{ code, domain: 'feed', messageKey: 'm' }]),
        ),
      ).toThrow(),
  );

  it('allows a benign exception', () =>
    expect(() =>
      assertNoFinance(
        payload(
          [],
          [{ code: 'missing_weights', domain: 'feed', messageKey: 'm' }],
        ),
      ),
    ).not.toThrow());

  it('does nothing when finance is included', () => {
    const p = payload([metric({ value: bdt(), source: 'cash_ledger' })]);
    p.includesFinance = true;
    expect(() => assertNoFinance(p)).not.toThrow();
  });
});

describe('scheduledReportKey farmId validation', () => {
  const ok = 'cm1abcdefghijklmnopqrstuv';
  const input = (farmId: string) => ({
    farmId,
    type: 'WEEKLY' as const,
    periodStartDate: '2026-10-19',
    templateVersion: 1,
  });

  it('accepts a cuid', () =>
    expect(scheduledReportKey(input(ok))).toBe(`${ok}:WEEKLY:2026-10-19:v1`));

  it.each([
    '',
    'f1',
    'a:b',
    'cm1abcdefghijklmnopqrstu v',
    ' cm1abcdefghijklmnopqrstuv',
    'cm1abcdefghijklmnopqrstuv\n',
    'cm1abcdefghijklmnopqrst:v',
    '550e8400-e29b-41d4-a716-446655440000',
    'CM1ABCDEFGHIJKLMNOPQRSTUV',
  ])('rejects farmId %j', (id) =>
    expect(() => scheduledReportKey(input(id))).toThrow(),
  );

  it('cannot collide through a ":" in farmId', () =>
    expect(() =>
      scheduledReportKey(input('x:WEEKLY:2026-10-19:v1')),
    ).toThrow());

  it('distinct farms/versions/periods/types give distinct keys', () => {
    const other = 'cm2abcdefghijklmnopqrstuv';
    const keys = new Set([
      scheduledReportKey(input(ok)),
      scheduledReportKey(input(other)),
      scheduledReportKey({ ...input(ok), templateVersion: 2 }),
      scheduledReportKey({ ...input(ok), periodStartDate: '2026-10-26' }),
      scheduledReportKey({ ...input(ok), type: 'MONTHLY' }),
    ]);
    expect(keys.size).toBe(5);
  });
});
