import {
  buildReportLayout,
  detectKind,
  type LayoutBlock,
} from './report-layout';
import { formatFull, formatNumber, formatPercentChange } from './report-format';
import { humanize, keyLabel, metricLabel } from './report-labels';
import {
  allMissingPayload,
  banglaPayload,
  edgePayload,
  monthlyPayload,
  weeklyPayload,
} from './renderer-fixtures';
import { valueOf } from '../../domain/contracts/metric-value';

const json = (x: unknown): string => JSON.stringify(x);
const kpiCards = (blocks: LayoutBlock[]) =>
  blocks.flatMap((b) => (b.type === 'kpis' ? b.cards : []));

describe('buildReportLayout', () => {
  it('derives kind/title from the period only', () => {
    expect(buildReportLayout(weeklyPayload()).title).toBe('Weekly farm report');
    expect(buildReportLayout(monthlyPayload(5)).title).toBe(
      'September at a glance',
    );
    const p = weeklyPayload();
    p.period = { ...p.period, startDate: '2026-10-13', endDate: '2026-10-19' };
    expect(buildReportLayout(p).title).toBe('Farm snapshot');
    expect(detectKind(p.period)).toBe('snapshot');
  });

  it('shows every metric value equal to the payload value (formatted)', () => {
    const p = weeklyPayload();
    const layout = buildReportLayout(p);
    const cards = kpiCards(layout.blocks);
    const hero = layout.blocks.find((b) => b.type === 'hero');
    for (const s of p.sections) {
      for (const m of s.metrics) {
        if (m.rows?.length || m.series?.length) continue;
        if (m.value.state !== 'value') continue;
        const expected = formatFull(m.value);
        const card = cards.find((c) => c.id === m.metricId);
        if (card) {
          expect(
            `${card.valueText}${card.unitText ? ` ${card.unitText}` : ''}`,
          ).toBe(expected);
        } else {
          // the hero metric
          expect(
            hero && hero.type === 'hero'
              ? `${hero.valueText} ${hero.unitText}`.trim()
              : '',
          ).toBe(expected);
        }
      }
    }
    // ranked rows and table cells carry payload numbers
    const ranked = layout.blocks.find((b) => b.type === 'ranked');
    expect(ranked && ranked.type === 'ranked' && ranked.rows[0].text).toMatch(
      /L$/,
    );
  });

  it('renders missing / not_calculated / not_applicable as words, never 0', () => {
    const layout = buildReportLayout(weeklyPayload());
    const byId = Object.fromEntries(
      kpiCards(layout.blocks).map((c) => [c.id, c]),
    );
    expect(byId['health.cases_repeated'].valueText).toBe('Not calculated');
    expect(byId['feed.fit_off_target_share'].valueText).toBe('—');
    const missing = buildReportLayout(allMissingPayload());
    const hero = missing.blocks.find((b) => b.type === 'hero');
    expect(hero && hero.type === 'hero' && hero.valueText).toBe('Not recorded');
    const cards = kpiCards(missing.blocks);
    expect(cards.every((c) => c.valueText === 'Not recorded')).toBe(true);
    const chart = missing.blocks.find((b) => b.type === 'line');
    expect(
      chart &&
        chart.type === 'line' &&
        chart.points.every(
          (pt) => pt.value === null && pt.text === 'Not recorded',
        ),
    ).toBe(true);
    expect(json(missing.blocks)).not.toMatch(/"valueText":"0"/);
  });

  it('renders a zero as 0 (a real zero is not "missing")', () => {
    const p = weeklyPayload();
    p.sections[1].metrics[0] = {
      ...p.sections[1].metrics[0],
      value: valueOf(0, 'count'),
      comparison: null,
    };
    const c = kpiCards(buildReportLayout(p).blocks).find(
      (k) => k.id === 'health.cases_opened',
    );
    expect(c?.valueText).toBe('0');
  });

  it('renders a null percent change as an em dash', () => {
    expect(formatPercentChange(null)).toEqual({ text: '—', direction: 'none' });
    const layout = buildReportLayout(weeklyPayload());
    const calv = kpiCards(layout.blocks).find(
      (c) => c.id === 'reproduction.calvings',
    );
    expect(calv?.delta?.text).toBe('—'); // previous 0 => percentChange null
    expect(formatPercentChange(6.84).text).toBe('+6.8%');
    expect(formatPercentChange(-2).text).toBe('−2.0%');
  });

  it("keeps per-cow feed figures labelled 'offered minus refusal', never 'consumed'", () => {
    const layout = buildReportLayout(weeklyPayload());
    const text = json(layout.blocks);
    expect(text).toContain('Offered minus refusal');
    expect(text.toLowerCase()).not.toContain('consumed');
    const ranked = layout.blocks.filter(
      (b) => b.type === 'ranked' || b.type === 'table',
    );
    expect(json(ranked)).toContain('Offered minus refusal');
  });

  it('finance-free layout has no finance block, BDT unit or finance source label', () => {
    const layout = buildReportLayout(weeklyPayload(false));
    const text = json(layout);
    expect(text).not.toMatch(/BDT|৳|Cash|Ledger|ledger|Currency|Expenses/);
    expect(layout.meta.map((m) => m.label)).not.toContain('Currency');
    const notices = layout.blocks.filter((b) => b.type === 'notice');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ tone: 'restricted' });
    // with finance: no notice, cash figures present
    const full = buildReportLayout(weeklyPayload(true));
    expect(full.blocks.some((b) => b.type === 'notice')).toBe(false);
    expect(json(full)).toContain('Cash received');
  });

  it('drops finance metrics defensively even if a finance-free payload carries one', () => {
    const p = weeklyPayload(true);
    p.includesFinance = false;
    const text = json(buildReportLayout(p));
    expect(text).not.toMatch(/Cash|BDT|৳/);
  });

  it('maps i18n keys through one dictionary and never crashes on unknown keys', () => {
    const layout = buildReportLayout(weeklyPayload());
    const dq = layout.blocks.find((b) => b.type === 'dataQuality');
    expect(dq && dq.type === 'dataQuality' && dq.notes).toEqual(
      expect.arrayContaining([
        'Unsubmitted milk drafts are excluded.',
        'Brand new unknown key',
      ]),
    );
    expect(keyLabel('reports.exception.milk.sudden_drop')).toBe(
      'Sudden drop in milk yield',
    );
    expect(keyLabel('reports.some.new_thing')).toBe('New thing');
    expect(keyLabel('Plain sentence stays.')).toBe('Plain sentence stays.');
    expect(keyLabel(undefined)).toBe('');
    expect(metricLabel('milk.never_seen_before')).toBe('Never seen before');
    expect(humanize(null)).toBe('');
    expect(humanize(42)).toBe('42');
    expect(formatNumber(NaN)).toBe('—');
  });

  it('survives an odd payload (empty sections, unknown ids, no exceptions)', () => {
    const p = weeklyPayload();
    p.sections = [
      {
        id: 'x',
        domain: 'milk',
        titleKey: 'reports.section.unknown_thing',
        metrics: [
          {
            metricId: 'milk.brand_new',
            value: { state: 'not_applicable' },
            source: 'someNewSource',
            comparison: null,
            requiresPermission: null,
          },
        ],
      },
    ];
    p.exceptions = [];
    const layout = buildReportLayout(p);
    expect(layout.blocks.length).toBeGreaterThan(1);
  });

  it('adds pagination hints and a full table only when rows exceed the top list', () => {
    const big = buildReportLayout(monthlyPayload(300));
    const tables = big.blocks.filter((b) => b.type === 'table');
    expect(tables.length).toBeGreaterThan(0);
    const all = tables.find(
      (t) => t.type === 'table' && t.title === 'All animals',
    );
    expect(all && all.type === 'table' && all.table.rows).toHaveLength(300);
    expect(all && all.type === 'table' && all.table.repeatHeader).toBe(true);
    expect(
      all && all.type === 'table' && all.table.minRowsBeforeBreak,
    ).toBeGreaterThanOrEqual(3);
    const small = buildReportLayout(weeklyPayload());
    // 25 rows: still has a full table; with <=10 it would not
    expect(
      small.blocks.filter((b) => b.type === 'table').length,
    ).toBeGreaterThan(0);
  });

  it('uses Bangla labels verbatim and a neutral fallback (never a raw id) when a cow has no label', () => {
    const layout = buildReportLayout(banglaPayload());
    expect(json(layout)).toContain('গাভী ক্ষীর');
    const p = weeklyPayload();
    const rows = p.sections[0].metrics.find(
      (m) => m.metricId === 'milk.cow_total_yield',
    )?.rows;
    if (rows)
      rows[0] = {
        ...rows[0],
        label: null,
        key: 'abcdef12-0000-0000-0000-000000000000',
      };
    expect(json(buildReportLayout(p))).toContain('Animal (removed)');
    expect(json(buildReportLayout(p))).not.toContain('abcdef12');
  });

  it('prefers payload.reportType over period inference', () => {
    const p = weeklyPayload();
    p.reportType = 'ON_DEMAND';
    expect(buildReportLayout(p).kind).toBe('snapshot');
    p.reportType = 'MONTHLY';
    expect(buildReportLayout(p).kind).toBe('monthly');
    delete p.reportType;
    expect(buildReportLayout(p).kind).toBe('weekly');
  });

  it('truncates absurd strings', () => {
    const p = weeklyPayload();
    p.farm.name = 'x'.repeat(5000);
    expect(buildReportLayout(p).farmName.length).toBeLessThanOrEqual(80);
  });

  describe('review fixes', () => {
    const blocks = () => buildReportLayout(edgePayload()).blocks;
    const base = {
      source: null,
      comparison: null,
      requiresPermission: null,
    } as const;

    it('a one-point series renders as a scalar card, and charted metrics keep their own value as a card', () => {
      const b = blocks();
      const cards = kpiCards(b);
      expect(
        cards.find((c) => c.id === 'milk.fat_percent_trend'),
      ).toMatchObject({ valueText: '3.9%' });
      expect(
        b.some(
          (x) =>
            x.type === 'line' &&
            x.title === metricLabel('milk.fat_percent_trend'),
        ),
      ).toBe(false);
      expect(cards.find((c) => c.id === 'milk.daily_yield')).toBeDefined();
      expect(cards.find((c) => c.id === 'milk.shed_yield')).toBeDefined();
    });

    it('null-label rows: Animal (removed) only on cattle-keyed metrics, humanised key elsewhere', () => {
      const p = weeklyPayload();
      p.sections[0].metrics.push(
        {
          ...base,
          metricId: 'milk.top_cow_avg_yield',
          value: valueOf(1, 'L'),
          rows: [
            { key: 'c1', label: null, value: valueOf(9, 'L'), source: null },
          ],
        },
        {
          ...base,
          metricId: 'milk.by_shed',
          value: valueOf(1, 'L'),
          rows: [
            {
              key: 'north_shed',
              label: null,
              value: valueOf(5, 'L'),
              source: null,
            },
          ],
        },
      );
      const text = json(buildReportLayout(p).blocks);
      expect(text).toContain('Animal (removed)');
      expect(text).toContain('North shed');
    });

    it('bar labels carry the formatted payload text; footnote says days only for date series', () => {
      const bar = blocks().find((x) => x.type === 'bar');
      expect(
        bar && bar.type === 'bar' && bar.points.map((q) => q.text),
      ).toEqual(['0.04 L', '-1.5 L', '2.25 L']);
      const p = edgePayload();
      const shed = p.sections[0].metrics.find(
        (x) => x.metricId === 'milk.shed_yield',
      );
      if (shed?.series) {
        shed.series[0] = {
          key: 'Shed A',
          value: { state: 'missing', reason: 'r' },
        };
      }
      const b2 = buildReportLayout(p).blocks.find((x) => x.type === 'bar');
      expect(b2 && b2.type === 'bar' && b2.footnote).toMatch(
        /^1 entry has no record/,
      );
    });

    it('donut is capped at 8 with a labelled Other holding the real sum, and notes unrecorded rows', () => {
      const d = blocks().find((x) => x.type === 'donut');
      if (!d || d.type !== 'donut') throw new Error('no donut');
      expect(d.slices).toHaveLength(8);
      expect(d.slices[7].label).toBe('Other (5)');
      expect(d.slices[7].value).toBe(58 + 52 + 46 + 40 + 34);
      const all = Array.from({ length: 12 }, (_, i) => 100 - i * 6);
      expect(d.slices.reduce((t, q) => t + q.value, 0)).toBe(
        all.reduce((t, v) => t + v, 0),
      );
      expect(d.footnote).toMatch(/^1 entry has no record/);
    });

    it('coverage percent floors (never 100% when something is missing)', () => {
      const p = weeklyPayload();
      p.dataQuality.coverage = { expected: 10000, recorded: 9999 };
      const dq = buildReportLayout(p).blocks.find(
        (x) => x.type === 'dataQuality',
      );
      expect(dq && dq.type === 'dataQuality' && dq.coverage).toContain('(99%)');
      p.dataQuality.coverage = { expected: 100, recorded: 29 };
      const dq2 = buildReportLayout(p).blocks.find(
        (x) => x.type === 'dataQuality',
      );
      expect(dq2 && dq2.type === 'dataQuality' && dq2.coverage).toContain(
        '(29%)',
      );
    });

    it('finance-free: drops finance exceptions/notes/series and a section left empty, keeps look-alikes', () => {
      const p = edgePayload(false);
      p.sections.push({
        id: 'costs',
        domain: 'milk',
        titleKey: 'reports.section.costs_only',
        metrics: [
          {
            ...base,
            metricId: 'milk.cost_trend',
            value: { state: 'missing', reason: 'x' },
            series: [
              { key: '2026-10-12', value: valueOf(5, 'BDT') },
              { key: '2026-10-13', value: valueOf(6, 'BDT') },
            ],
          },
        ],
      });
      p.exceptions.push(
        {
          code: 'finance.overdue_payments',
          domain: 'finance',
          messageKey: 'reports.exception.finance.overdue_payments',
        },
        {
          code: 'milk.costume_drop', // contains "cost" but is not finance
          domain: 'milk',
          messageKey: 'reports.exception.milk.sudden_drop',
        },
      );
      p.dataQuality.notes.push('reports.dq.partial_costs');
      const layout = buildReportLayout(p);
      const text = json(layout.blocks);
      expect(text).not.toContain('BDT');
      expect(text).not.toContain('Costs only');
      expect(text).not.toContain('Cost trend');
      expect(text).not.toContain('Some costs');
      const ex = layout.blocks.find((x) => x.type === 'exceptions');
      expect(ex && ex.type === 'exceptions' && ex.items).toHaveLength(3);
    });

    it('notes truncated tables', () => {
      const all = buildReportLayout(monthlyPayload(5200)).blocks.find(
        (x) => x.type === 'table' && x.title === 'All animals',
      );
      expect(all && all.type === 'table' && all.table.rows).toHaveLength(5000);
      expect(all && all.type === 'table' && all.table.note).toBe(
        'Showing first 5,000 of 5,200 rows.',
      );
    });
  });
});
