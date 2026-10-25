import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReportError } from '../../domain/report-error';
import { buildReportLayout } from './report-layout';
import { PdfDocumentWriter } from './pdf-document-writer';
import { PdfReportRenderer } from './pdf-report-renderer';
import { REPORT_RENDERER_PROVIDERS } from './index';
import { REPORT_RENDERER } from '../../application/ports/report-ports';
import {
  allMissingPayload,
  banglaPayload,
  edgePayload,
  monthlyPayload,
  onDemandPayload,
  weeklyPayload,
} from './renderer-fixtures';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';

const pageCount = (b: Buffer): number =>
  (b.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

async function renderWithText(
  payload: ReportSnapshotPayload,
): Promise<{ body: Buffer; texts: string[] }> {
  const texts: string[] = [];
  const body = await new PdfDocumentWriter(buildReportLayout(payload)).write({
    createdAt: new Date(payload.generatedAt),
    onText: (t) => texts.push(t),
  });
  return { body, texts };
}

const FINANCE_STRINGS = [
  'Cash received',
  'Cash paid',
  'Net cash flow',
  'Cash ledger',
  'BDT',
  '৳',
  'Currency',
  'Expenses recorded',
];

describe('PdfReportRenderer', () => {
  it('is bound to REPORT_RENDERER', () => {
    expect(REPORT_RENDERER_PROVIDERS).toEqual([
      { provide: REPORT_RENDERER, useClass: PdfReportRenderer },
    ]);
  });

  it('renders a small weekly payload', async () => {
    const r = await new PdfReportRenderer().render(weeklyPayload());
    expect(r.contentType).toBe('application/pdf');
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(r.body)).toBeGreaterThanOrEqual(2);
    // The Bengali-capable font is embedded.
    expect(r.body.toString('latin1')).toContain('NotoSansBengali');
  });

  it('is deterministic for the same payload', async () => {
    const a = await new PdfReportRenderer().render(weeklyPayload());
    const b = await new PdfReportRenderer().render(weeklyPayload());
    expect(a.body.equals(b.body)).toBe(true);
  });

  it('renders on-demand and Bangla names (taka + conjuncts) without error', async () => {
    const od = await new PdfReportRenderer().render(onDemandPayload());
    expect(od.body.subarray(0, 4).toString()).toBe('%PDF');
    const bn = await renderWithText(banglaPayload());
    expect(bn.texts.some((t) => t.includes('গাভী ক্ষীর'))).toBe(true);
    expect(bn.texts.some((t) => t.includes('৳'))).toBe(true);
    expect(bn.body.toString('latin1')).toContain('NotoSansBengali');
  });

  it('renders a 2,000-cow monthly report with pagination in under 10 s', async () => {
    const t0 = Date.now();
    const r = await new PdfReportRenderer().render(monthlyPayload(2000));
    const ms = Date.now() - t0;

    console.log(
      `monthly 2000 cows: ${ms} ms, ${r.body.length} bytes, ${pageCount(r.body)} pages`,
    );
    expect(ms).toBeLessThan(10_000);
    expect(pageCount(r.body)).toBeGreaterThan(40);
    expect(r.body.length).toBeLessThan(15 * 1024 * 1024);
  }, 30_000);

  it('finance-free PDF draws no finance strings and no restricted figure', async () => {
    const { texts, body } = await renderWithText(weeklyPayload(false));
    const all = texts.join('\n');
    for (const f of FINANCE_STRINGS) expect(all).not.toContain(f);
    expect(all).toContain('FINANCE · RESTRICTED');
    expect(body.toString('latin1')).not.toMatch(/Cash|BDT/);
    // And a with-finance copy does draw them.
    const full = (await renderWithText(weeklyPayload(true))).texts.join('\n');
    expect(full.toLowerCase()).toContain('cash received');
    expect(full).not.toContain('RESTRICTED');
  });

  it('renders an all-missing payload and says Not recorded', async () => {
    const { texts, body } = await renderWithText(allMissingPayload());
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
    expect(texts.filter((t) => t === 'Not recorded').length).toBeGreaterThan(0);
  });

  it('ignores a missing/unusable logo', async () => {
    const storage = { get: jest.fn().mockRejectedValue(new Error('nope')) };
    const p = weeklyPayload();
    p.farm.logoKey = 'farms/farm-1/logo.png';
    const r = await new PdfReportRenderer(storage as never).render(p);
    expect(storage.get).toHaveBeenCalledWith('farms/farm-1/logo.png', {
      maxBytes: 1024 * 1024,
    });
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');

    // not png/jpeg -> ignored
    storage.get.mockResolvedValue(Buffer.from('<svg></svg>'));
    expect(
      (await new PdfReportRenderer(storage as never).render(p)).body.length,
    ).toBeGreaterThan(1000);
    // oversize -> ignored
    storage.get.mockResolvedValue(Buffer.alloc(2 * 1024 * 1024, 0xff));
    expect(
      (await new PdfReportRenderer(storage as never).render(p)).body.length,
    ).toBeGreaterThan(1000);
  });

  it('never fetches a logo key outside the farm own prefix', async () => {
    for (const key of [
      'farms/other-farm/logo.png',
      'https://evil.example/farms/farm-1/logo.png',
      'farms/farm-1/../other/logo.png',
      'farms/farm-12/logo.png',
    ]) {
      const storage = { get: jest.fn() };
      const p = weeklyPayload();
      p.farm.logoKey = key;
      const r = await new PdfReportRenderer(storage as never).render(p);
      expect(storage.get).not.toHaveBeenCalled();
      expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
    }
  });

  it('drops a logo whose declared dimensions are a decompression bomb', async () => {
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(13, 8);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(60000, 16);
    png.writeUInt32BE(60000, 20);
    const p = weeklyPayload();
    p.farm.logoKey = 'farms/farm-1/logo.png';
    const r = await new PdfReportRenderer({
      get: () => Promise.resolve(png),
    } as never).render(p);
    expect(r.body.toString('latin1')).not.toContain('/Subtype /Image');
  });

  it('draws a valid PNG logo', async () => {
    // 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const p = weeklyPayload();
    p.farm.logoKey = 'farms/farm-1/logo.png';
    const plain = await new PdfReportRenderer().render(weeklyPayload());
    const withLogo = await new PdfReportRenderer({
      get: () => Promise.resolve(png),
    } as never).render(p);
    expect(withLogo.body.toString('latin1')).toContain('/Subtype /Image');
    expect(plain.body.toString('latin1')).not.toContain('/Subtype /Image');
  });

  it('fails with RENDER_FAILED past the page cap', async () => {
    const p = monthlyPayload(2000);
    // each metric table is capped at MAX_TABLE_ROWS; force > 200 pages by duplicating sections
    const milk = p.sections[0];
    p.sections = Array.from({ length: 8 }, () => milk);
    await expect(new PdfReportRenderer().render(p)).rejects.toMatchObject({
      category: 'RENDER_FAILED',
    });
    await expect(new PdfReportRenderer().render(p)).rejects.toBeInstanceOf(
      ReportError,
    );
  }, 60_000);

  it('prints bar value labels from the payload text (0.04 stays 0.04) and the donut centre caption', async () => {
    const { texts } = await renderWithText(edgePayload());
    expect(texts).toContain('0.04 L');
    expect(texts).toContain('-1.5 L');
    expect(texts).toContain('total');
    expect(texts).toContain('Other (5)');
  });

  it('writes sample PDFs when REPORT_PDF_SAMPLES_DIR is set', async () => {
    const dir = process.env.REPORT_PDF_SAMPLES_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const r = new PdfReportRenderer();
    const out: [string, ReportSnapshotPayload][] = [
      ['weekly.pdf', weeklyPayload()],
      ['monthly.pdf', monthlyPayload(60)],
      ['monthly-2000.pdf', monthlyPayload(2000)],
      ['on-demand.pdf', onDemandPayload()],
      ['no-finance.pdf', weeklyPayload(false)],
      ['bangla.pdf', banglaPayload()],
      ['all-missing.pdf', allMissingPayload()],
      ['edge.pdf', edgePayload()],
      ['edge-no-finance.pdf', edgePayload(false)],
    ];
    for (const [name, payload] of out) {
      writeFileSync(join(dir, name), (await r.render(payload)).body);
    }
  }, 60_000);
});
