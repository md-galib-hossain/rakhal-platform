/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method -- jest mock call inspection */
import { Prisma } from '@prisma/client';
import type { LoggerService } from 'src/core/logger/logger/logger.service';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import type { MetricDefinition } from '../../domain/contracts/metric-definition';
import type { MetricResult } from '../../domain/contracts/metric-value';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import { resolvePreset } from '../../domain/period';
import { ReportError } from '../../domain/report-error';
import type {
  DomainMetricModule,
  MetricContext,
} from '../metrics/metric-context';
import type { ReportComputeInput } from '../ports/report-ports';
import { REPORT_STATEMENT_TIMEOUT_MS } from './report-pipeline.constants';
import {
  COW_KEYED_ROW_METRIC_IDS,
  ReportComputeService,
} from './report-compute.service';
import { emptyDataQuality } from './report-data-quality';

const def = (
  id: MetricDefinition['id'],
  extra: Partial<MetricDefinition> = {},
): MetricDefinition => ({
  id,
  domain: id.split('.')[0] as MetricDefinition['domain'],
  unit: 'L',
  formula: 'f',
  eligibilityRule: 'e',
  missingDataRule: 'm',
  calcVersion: 1,
  ...extra,
});

const metric = (id: MetricResult['metricId'], fin = false): MetricResult => ({
  metricId: id,
  value: { state: 'value', value: 1, unit: fin ? 'BDT' : 'L' },
  source: fin ? 'cash_ledger' : null,
  comparison: null,
  requiresPermission: fin ? 'finance.read' : null,
});

function fakeModule(
  domain: 'milk' | 'health' | 'finance',
  ids: MetricResult['metricId'][],
  defs: MetricDefinition[],
  withException = false,
) {
  const compute = jest.fn((ctx: MetricContext) => {
    void ctx;
    return Promise.resolve({
      section: {
        id: domain,
        domain,
        titleKey: `x.${domain}`,
        metrics: ids.map((i) => metric(i, domain === 'finance')),
      },
      exceptions: withException
        ? [
            {
              code: 'milk.sudden_drop',
              domain,
              messageKey: 'k',
              cattleIds: ['c1'],
            },
          ]
        : [],
      dataQuality: {
        ...emptyDataQuality(),
        coverage: { expected: 2, recorded: 1 },
        notes: [`n.${domain}`],
        flags: { ...emptyDataQuality().flags, incompleteCoverage: true },
      },
    });
  });
  return { definitions: defs, compute } satisfies DomainMetricModule;
}

const period = resolvePreset(
  'custom',
  new Date('2026-10-20T00:00:00Z'),
  'Asia/Dhaka',
  { from: '2026-10-05', to: '2026-10-11' },
);

const template: ReportTemplateDefinition = {
  type: 'WEEKLY',
  version: 3,
  thresholds: {
    suddenDropPct: 30,
    repeatedCaseWindowDays: 60,
    finalizationMaxWaitHours: 6,
  },
  sections: [
    {
      id: 's-milk',
      domain: 'milk',
      titleKey: 't.milk',
      metricIds: ['milk.total_yield', 'milk.sudden_drop_cows'],
    },
    {
      id: 's-fin',
      domain: 'finance',
      titleKey: 't.fin',
      metricIds: ['finance.cash_received'],
    },
    {
      id: 's-health',
      domain: 'health',
      titleKey: 't.health',
      metricIds: ['health.cases_opened'],
    },
  ],
};

function setup(opts: { cows?: unknown[]; groupFound?: boolean } = {}) {
  const milk = fakeModule(
    'milk',
    ['milk.total_yield', 'milk.sudden_drop_cows'],
    [def('milk.total_yield'), def('milk.sudden_drop_cows', { calcVersion: 4 })],
    true,
  );
  const health = fakeModule(
    'health',
    ['health.cases_opened'],
    [def('health.cases_opened')],
  );
  const finance = fakeModule(
    'finance',
    ['finance.cash_received'],
    [
      def('finance.cash_received', {
        unit: 'BDT',
        requiresPermission: 'finance.read',
      }),
    ],
  );
  const tx = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    farm: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'farm1',
        name: 'Farm One',
        timezone: 'Asia/Dhaka',
      }),
    },
    cattle: {
      findMany: jest.fn().mockResolvedValue(
        opts.cows ?? [
          {
            id: 'c1',
            enteredHerdAt: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            deletedAt: null,
            disposition: null,
          },
          {
            id: 'c2',
            enteredHerdAt: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            deletedAt: null,
            disposition: null,
          },
        ],
      ),
    },
    animalGroup: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.groupFound === false ? null : { id: 'g1' }),
    },
    animalGroupMember: {
      findMany: jest.fn().mockResolvedValue([{ cattleId: 'c1' }]),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const settings = {
    lactationSuddenDropThresholdPct: jest.fn().mockResolvedValue(25),
  } as unknown as FarmSettingsService;
  const logger = {
    setContext() {
      return this;
    },
    info: jest.fn(),
  } as unknown as LoggerService;
  const svc = new ReportComputeService(prisma, settings, logger, {
    milk,
    health,
    finance,
  });
  return { svc, tx, prisma, milk, health, finance };
}

const input = (over: Partial<ReportComputeInput> = {}): ReportComputeInput => ({
  farmId: 'farm1',
  includeFinance: true,
  type: 'WEEKLY',
  period,
  scope: { kind: 'ALL_ELIGIBLE' },
  selectedMetricIds: [
    'milk.total_yield',
    'milk.sudden_drop_cows',
    'finance.cash_received',
    'health.cases_opened',
  ],
  template,
  generatedAt: new Date('2026-10-12T02:00:00Z'),
  ...over,
});

describe('ReportComputeService', () => {
  it('runs one RepeatableRead transaction with explicit limits', async () => {
    const { svc, prisma, tx } = setup();
    await svc.compute(input());
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const opts = (prisma.$transaction as jest.Mock).mock.calls[0][1] as {
      isolationLevel: string;
      timeout: number;
      maxWait: number;
    };
    expect(opts.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.RepeatableRead,
    );
    expect(opts.timeout).toBeGreaterThan(0);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL statement_timeout = ${REPORT_STATEMENT_TIMEOUT_MS}`,
    );
    expect(opts.maxWait).toBeGreaterThan(0);
  });

  it('keeps template section order, uses template ids, merges quality, max calcVersion', async () => {
    const { svc, milk } = setup();
    const p = await svc.compute(input());
    expect(p.sections.map((s) => s.id)).toEqual([
      's-milk',
      's-fin',
      's-health',
    ]);
    expect(p.templateVersion).toBe(3);
    expect(p.calcVersion).toBe(4);
    expect(p.farm).toEqual({
      id: 'farm1',
      name: 'Farm One',
      timezone: 'Asia/Dhaka',
      logoKey: null,
    });
    expect(p.dataQuality.coverage).toEqual({ expected: 6, recorded: 3 });
    expect(p.dataQuality.notes).toEqual(
      expect.arrayContaining(['n.milk', 'n.health', 'n.finance']),
    );
    expect(p.dataQuality.flags.incompleteCoverage).toBe(true);
    expect(p.exceptions).toHaveLength(1);
    expect(p.previousPeriod?.endDate).toBe('2026-10-04');
    const ctx = milk.compute.mock.calls[0][0];
    expect(ctx.cattleIds).toEqual(['c1', 'c2']);
    expect(ctx.previousCattleIds).toEqual(['c1', 'c2']);
    expect(ctx.cattlePresence?.get('c1')).toEqual({
      startDate: '2026-10-05',
      endDate: '2026-10-11',
    });
    expect(ctx.scopeKind).toBe('ALL_ELIGIBLE');
    // farm setting overrides the template threshold
    expect(ctx.thresholds.suddenDropPct).toBe(25);
    expect(ctx.db).toBeDefined();
  });

  it('filters metrics to the selection and drops exceptions of filtered metrics', async () => {
    const { svc, finance, health } = setup();
    const p = await svc.compute(
      input({ selectedMetricIds: ['milk.total_yield'] }),
    );
    expect(p.sections.map((s) => s.id)).toEqual(['s-milk']);
    expect(p.sections[0].metrics.map((m) => m.metricId)).toEqual([
      'milk.total_yield',
    ]);
    expect(p.exceptions).toEqual([]);
    expect(finance.compute).not.toHaveBeenCalled();
    expect(health.compute).not.toHaveBeenCalled();
  });

  it('includeFinance=false: finance module never runs, no finance section, finance ids ignored', async () => {
    const { svc, finance } = setup();
    const p = await svc.compute(input({ includeFinance: false }));
    expect(finance.compute).not.toHaveBeenCalled();
    expect(p.includesFinance).toBe(false);
    expect(p.sections.map((s) => s.domain)).toEqual(['milk', 'health']);
    expect(JSON.stringify(p)).not.toContain('finance');
  });

  it('includeFinance=false passes false to every module', async () => {
    const { svc, milk, health } = setup();
    await svc.compute(input({ includeFinance: false }));
    expect(milk.compute.mock.calls[0][0].includeFinance).toBe(false);
    expect(health.compute.mock.calls[0][0].includeFinance).toBe(false);
  });

  it('rejects a SINGLE_COW that is not in this farm', async () => {
    const { svc, tx } = setup();
    await expect(
      svc.compute(
        input({ scope: { kind: 'SINGLE_COW', cattleId: 'other-farm-cow' } }),
      ),
    ).rejects.toMatchObject({ category: 'INVALID_CONFIG' });
    expect(tx.cattle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { farmId: 'farm1' } }),
    );
  });

  it('rejects a GROUP that is not in this farm (lookup is keyed by farmId)', async () => {
    const { svc, tx } = setup({ groupFound: false });
    const p = svc.compute(
      input({
        scope: {
          kind: 'GROUP',
          groupId: 'foreign',
          membershipAsOf: '2026-10-12T00:00:00.000Z',
        },
      }),
    );
    await expect(p).rejects.toBeInstanceOf(ReportError);
    expect(tx.animalGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'foreign', farmId: 'farm1' }),
      }),
    );
    expect(tx.animalGroupMember.findMany).not.toHaveBeenCalled();
  });

  it('GROUP scope resolves members, flags membership as of generation', async () => {
    const { svc, milk } = setup();
    const p = await svc.compute(
      input({
        scope: {
          kind: 'GROUP',
          groupId: 'g1',
          membershipAsOf: '2026-10-12T00:00:00.000Z',
        },
      }),
    );
    expect(milk.compute.mock.calls[0][0].cattleIds).toEqual(['c1']);
    expect(p.dataQuality.flags.groupMembershipCurrentOnly).toBe(true);
  });

  it('a cow deleted before generation or entered after the period is out of scope', async () => {
    const { svc, milk } = setup({
      cows: [
        {
          id: 'gone',
          enteredHerdAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: new Date('2026-10-01T00:00:00Z'),
          disposition: null,
        },
        {
          id: 'late',
          enteredHerdAt: new Date('2026-10-12T00:00:00Z'),
          createdAt: new Date('2026-10-12T00:00:00Z'),
          deletedAt: null,
          disposition: null,
        },
        {
          id: 'ok',
          enteredHerdAt: new Date('2026-10-08T00:00:00Z'),
          createdAt: new Date('2026-10-12T00:00:00Z'),
          deletedAt: null,
          disposition: { date: new Date('2026-10-09T00:00:00Z') },
        },
      ],
    });
    await svc.compute(input());
    const ctx = milk.compute.mock.calls[0][0];
    expect(ctx.cattleIds).toEqual(['ok']);
    expect(ctx.cattlePresence?.get('ok')).toEqual({
      startDate: '2026-10-08',
      endDate: '2026-10-09',
    });
  });

  it('sets reportType from the input type', async () => {
    const { svc } = setup();
    const p = await svc.compute(input({ type: 'MONTHLY' }));
    expect(p.reportType).toBe('MONTHLY');
  });

  describe('cow-keyed row labels', () => {
    const cowRow = (key: string, label: string | null = null) => ({
      key,
      label,
      value: { state: 'value' as const, value: 5, unit: 'L' },
      source: null,
    });
    function build(
      rows: ReturnType<typeof cowRow>[],
      metricId: MetricResult['metricId'] = 'milk.cow_total_yield',
      found: unknown[] = [],
    ) {
      const mod = {
        definitions: [def(metricId)],
        compute: jest.fn(() =>
          Promise.resolve({
            section: {
              id: 'milk',
              domain: 'milk' as const,
              titleKey: 'x',
              metrics: [{ ...metric(metricId), rows }],
            },
            exceptions: [],
            dataQuality: emptyDataQuality(),
          }),
        ),
      } satisfies DomainMetricModule;
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'c1',
            enteredHerdAt: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            deletedAt: null,
            disposition: null,
          },
        ])
        .mockResolvedValue(found);
      const tx = {
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
        farm: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'farm1',
            name: 'F',
            timezone: 'Asia/Dhaka',
          }),
        },
        cattle: { findMany },
      };
      const prisma = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      } as unknown as PrismaService;
      const settings = {
        lactationSuddenDropThresholdPct: jest.fn().mockResolvedValue(25),
      } as unknown as FarmSettingsService;
      const logger = {
        setContext() {
          return this;
        },
        info: jest.fn(),
      } as unknown as LoggerService;
      const svc = new ReportComputeService(prisma, settings, logger, {
        milk: mod,
      });
      const tpl: ReportTemplateDefinition = {
        ...template,
        sections: [
          { id: 'milk', domain: 'milk', titleKey: 'x', metricIds: [metricId] },
        ],
      };
      return { svc, findMany, tpl, metricId };
    }

    it('lists the cow-keyed metric ids', () => {
      expect(COW_KEYED_ROW_METRIC_IDS).toContain('milk.top_cow_avg_yield');
      expect(COW_KEYED_ROW_METRIC_IDS).toContain(
        'feed.offered_minus_refusal_kg',
      );
    });

    it('labels rows with tag + name in one farm-scoped query; deleted cow stays null', async () => {
      const { svc, findMany, tpl, metricId } = build(
        [cowRow('c1'), cowRow('c2'), cowRow('gone'), cowRow('c3', 'Preset')],
        'milk.cow_total_yield',
        [
          { id: 'c1', tagNumber: 'T-01', name: 'Lakshmi' },
          { id: 'c2', tagNumber: 'T-02', name: null },
        ],
      );
      const p = await svc.compute(
        input({ template: tpl, selectedMetricIds: [metricId] }),
      );
      const rows = p.sections[0].metrics[0].rows ?? [];
      expect(rows.map((r) => r.label)).toEqual([
        'T-01 Lakshmi',
        'T-02',
        null,
        'Preset',
      ]);
      expect(findMany).toHaveBeenCalledTimes(2);
      const where = findMany.mock.calls[1][0].where;
      expect(where.farmId).toBe('farm1');
      expect([...where.id.in].sort()).toEqual(['c1', 'c2', 'gone']);
    });

    it('does not label a cross-farm id the farm-scoped query did not return', async () => {
      const { svc, tpl, metricId } = build([cowRow('other')], undefined, []);
      const p = await svc.compute(
        input({ template: tpl, selectedMetricIds: [metricId] }),
      );
      expect(p.sections[0].metrics[0].rows?.[0].label).toBeNull();
    });

    it('labels 2,500 distinct cows in batches of 1000 with none left unlabelled', async () => {
      const ids = Array.from({ length: 2500 }, (_, i) => `cow${i}`);
      const { svc, findMany, tpl, metricId } = build(
        ids.map((id) => cowRow(id)),
        'milk.cow_total_yield',
        ids.map((id) => ({ id, tagNumber: `T-${id}`, name: null })),
      );
      const p = await svc.compute(
        input({ template: tpl, selectedMetricIds: [metricId] }),
      );
      const rows = p.sections[0].metrics[0].rows ?? [];
      expect(rows).toHaveLength(2500);
      expect(rows.every((r) => r.label === `T-${r.key}`)).toBe(true);
      expect(findMany).toHaveBeenCalledTimes(4);
      const sizes = findMany.mock.calls
        .slice(1)
        .map((c) => Number(c[0].where.id.in.length));
      expect(sizes).toEqual([1000, 1000, 500]);
    });

    it('does not query when there are no unlabeled cow rows', async () => {
      const { svc, findMany, tpl, metricId } = build([cowRow('c1', 'Set')]);
      await svc.compute(
        input({ template: tpl, selectedMetricIds: [metricId] }),
      );
      expect(findMany).toHaveBeenCalledTimes(1);
    });
  });
});
