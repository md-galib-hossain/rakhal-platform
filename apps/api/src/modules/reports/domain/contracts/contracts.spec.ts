import { assertNoFinance, type ReportSnapshotPayload } from './snapshot';
import { isTransientError } from './enums';
import { scheduledReportKey } from './job-key';
import { isSubsetOfAllowed } from './template';

const FARM = 'cm1abcdefghijklmnopqrstuv';

const base = (
  over: Partial<ReportSnapshotPayload> = {},
): ReportSnapshotPayload => ({
  schemaVersion: 1,
  calcVersion: 1,
  templateVersion: 1,
  farm: { id: 'f1', name: 'Farm', timezone: 'Asia/Dhaka' },
  period: {
    start: '2026-10-18T18:00:00.000Z',
    end: '2026-10-25T18:00:00.000Z',
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    timezone: 'Asia/Dhaka',
    label: '2026-W43',
  },
  scope: { kind: 'ALL_ELIGIBLE' },
  generatedAt: '2026-10-26T00:00:00.000Z',
  includesFinance: false,
  sections: [],
  exceptions: [],
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
  ...over,
});

describe('assertNoFinance', () => {
  it('passes a clean payload', () =>
    expect(() => assertNoFinance(base())).not.toThrow());
  it('throws on a finance section', () => {
    const p = base({
      sections: [{ id: 's', domain: 'finance', titleKey: 't', metrics: [] }],
    });
    expect(() => assertNoFinance(p)).toThrow();
  });
  it('throws on a finance-gated metric in another section', () => {
    const p = base({
      sections: [
        {
          id: 'feed',
          domain: 'feed',
          titleKey: 't',
          metrics: [
            {
              metricId: 'feed.ledger_cost',
              value: { state: 'not_applicable' },
              source: 'ledgerFeed5000',
              comparison: null,
              requiresPermission: 'finance.read',
            },
          ],
        },
      ],
    });
    expect(() => assertNoFinance(p)).toThrow();
  });
  it('throws on a finance exception', () => {
    const p = base({
      exceptions: [{ code: 'x', domain: 'finance', messageKey: 'm' }],
    });
    expect(() => assertNoFinance(p)).toThrow();
  });
  it('allows finance when included', () => {
    const p = base({
      includesFinance: true,
      sections: [{ id: 's', domain: 'finance', titleKey: 't', metrics: [] }],
    });
    expect(() => assertNoFinance(p)).not.toThrow();
  });
});

describe('misc contracts', () => {
  it('classifies errors', () => {
    expect(isTransientError('DB_TIMEOUT')).toBe(true);
    expect(isTransientError('RENDER_FAILED')).toBe(false);
  });
  it('builds a stable scheduled key', () => {
    const i = {
      farmId: FARM,
      type: 'WEEKLY',
      periodStartDate: '2026-10-19',
      templateVersion: 2,
    } as const;
    expect(scheduledReportKey(i)).toBe(`${FARM}:WEEKLY:2026-10-19:v2`);
    expect(scheduledReportKey({ ...i })).toBe(scheduledReportKey(i));
    expect(scheduledReportKey({ ...i, templateVersion: 3 })).not.toBe(
      scheduledReportKey(i),
    );
  });
  it('rejects bad key input', () => {
    expect(() =>
      scheduledReportKey({
        farmId: FARM,
        type: 'WEEKLY',
        periodStartDate: '19-10-2026',
        templateVersion: 1,
      }),
    ).toThrow();
  });
  it('checks metric subset', () => {
    expect(
      isSubsetOfAllowed(
        ['milk.total_yield_l'],
        ['milk.total_yield_l', 'feed.ledger_cost'],
      ),
    ).toBe(true);
    expect(
      isSubsetOfAllowed(['feed.ledger_cost'], ['milk.total_yield_l']),
    ).toBe(false);
  });
});
