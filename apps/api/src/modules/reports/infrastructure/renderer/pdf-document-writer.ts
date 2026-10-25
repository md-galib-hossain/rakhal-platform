import PDFDocument from 'pdfkit';
import { ReportError } from '../../domain/report-error';
import type {
  ChartPoint,
  KpiCard,
  LayoutBlock,
  RankedRow,
  ReportLayout,
  TableSpec,
} from './report-layout';
import { resolveFontPaths } from './pdf-fonts';

/* ------------------------------- constants ------------------------------- */

export const MAX_PAGES = 200;
export const MAX_OUTPUT_BYTES = 15 * 1024 * 1024;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 40;
const CW = PAGE_W - MX * 2;
const BOTTOM = PAGE_H - 56;
const TOP_LATER = 82;
const GAP = 10;

const C = {
  page: '#FBFAF6',
  green: '#2F5D50',
  greenDark: '#244A40',
  sage: '#A9BFB3',
  sageMid: '#7FA08F',
  sageLight: '#E4ECE7',
  sand: '#C9A56B',
  amber: '#9A6B2A',
  text: '#1F2A26',
  muted: '#6B7771',
  rule: '#D9DDD6',
  card: '#FFFFFF',
  cardLine: '#DAD9D0',
  warnBg: '#FAF6EC',
  restricted: '#F1F2EE',
  white: '#FFFFFF',
};
const PALETTE = [
  C.green,
  C.sageMid,
  C.sand,
  '#4E7F6F',
  '#D9C4A0',
  C.sage,
  '#8C6B3A',
  '#B9CFC4',
];

type Role = 'sans' | 'sansBold' | 'serif' | 'serifBold';

export interface WriteOptions {
  /** Verified PNG/JPEG bytes, or undefined. Any draw failure is swallowed. */
  logo?: Buffer;
  /** Embedded creation date (from `payload.generatedAt`) so equal payloads give equal bytes. */
  createdAt: Date;
  /** Test hook: receives every string drawn onto a page. */
  onText?: (text: string) => void;
}

/** Characters the bundled font has no glyph for, mapped to safe ASCII. */
const REPLACEMENTS: Record<string, string> = {
  '→': 'to',
  '≈': '~',
  '≠': '!=',
  '≥': '>=',
  '≤': '<=',
  ' ': ' ',
};
function clean(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    out += code < 32 || code === 127 ? ' ' : (REPLACEMENTS[ch] ?? ch);
  }
  return out;
}

const toError = (e: unknown): Error =>
  e instanceof Error ? e : new Error('pdf write failed');

const isLatin1 = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0xff) return false;
  return true;
};

/* --------------------------------- writer -------------------------------- */

export class PdfDocumentWriter {
  private doc!: PDFKit.PDFDocument;
  private y = 0;
  private pages = 0;
  private logo?: { buf: Buffer; w: number; h: number };
  private onText?: (t: string) => void;

  constructor(private readonly layout: ReportLayout) {}

  write(opts: WriteOptions): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const fonts = resolveFontPaths();
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 0, left: 0, bottom: 0, right: 0 },
          autoFirstPage: false,
          bufferPages: true,
          info: {
            Title: clean(`${this.layout.title} - ${this.layout.farmName}`),
            Author: 'Rakhal',
            Producer: 'Rakhal Reports',
            Creator: 'Rakhal Reports',
            CreationDate: opts.createdAt,
            ModDate: opts.createdAt,
          },
        });
        this.doc = doc;
        this.onText = opts.onText;
        doc.registerFont('sans', fonts.regular);
        doc.registerFont('sansBold', fonts.bold);

        if (opts.logo) {
          try {
            const img = (
              doc as unknown as {
                openImage(b: Buffer): { width: number; height: number };
              }
            ).openImage(opts.logo);
            this.logo = { buf: opts.logo, w: img.width, h: img.height };
          } catch {
            this.logo = undefined;
          }
        }

        const chunks: Buffer[] = [];
        let size = 0;
        doc.on('data', (c: Buffer) => {
          size += c.length;
          chunks.push(c);
        });
        doc.on('end', () => {
          if (size > MAX_OUTPUT_BYTES) {
            reject(
              new ReportError('RENDER_FAILED', 'The report PDF is too large.'),
            );
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
        doc.on('error', (e: unknown) => reject(toError(e)));

        this.draw();
        doc.end();
      } catch (e) {
        reject(toError(e));
      }
    });
  }

  /* ------------------------------ primitives ----------------------------- */

  private fontName(role: Role, text: string): string {
    if (role === 'serif' || role === 'serifBold') {
      if (isLatin1(text))
        return role === 'serif' ? 'Times-Roman' : 'Times-Bold';
      return role === 'serif' ? 'sans' : 'sansBold';
    }
    return role;
  }

  private measure(text: string, role: Role, size: number, cs = 0): number {
    const t = clean(text);
    this.doc.font(this.fontName(role, t)).fontSize(size);
    return this.doc.widthOfString(t, cs ? { characterSpacing: cs } : undefined);
  }

  private fit(
    text: string,
    role: Role,
    size: number,
    maxW: number,
    cs = 0,
  ): string {
    const t = clean(text);
    if (this.measure(t, role, size, cs) <= maxW) return t;
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.measure(`${t.slice(0, mid)}…`, role, size, cs) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${t.slice(0, lo).trimEnd()}…` : '…';
  }

  /** Largest size in [minSize, size] at which `text` fits `maxW`; minSize if none (the caller then ellipsises). */
  private shrinkSize(
    text: string,
    role: Role,
    size: number,
    minSize: number,
    maxW: number,
  ): number {
    let s = size;
    while (s > minSize && this.measure(text, role, s) > maxW) s -= 0.4;
    return Math.max(minSize, s);
  }

  private text(
    text: string,
    x: number,
    y: number,
    o: {
      role?: Role;
      size?: number;
      color?: string;
      align?: 'left' | 'right' | 'center';
      width?: number;
      cs?: number;
      maxW?: number;
    } = {},
  ): void {
    const role = o.role ?? 'sans';
    const size = o.size ?? 8;
    const cs = o.cs ?? 0;
    let t = clean(text);
    if (!t) return;
    if (o.maxW !== undefined) t = this.fit(t, role, size, o.maxW, cs);
    const w = this.measure(t, role, size, cs);
    let px = x;
    if (o.align === 'right') px = x + (o.width ?? 0) - w;
    else if (o.align === 'center') px = x + ((o.width ?? 0) - w) / 2;
    this.doc.fillColor(o.color ?? C.text);
    this.doc.text(t, px, y, { lineBreak: false, characterSpacing: cs });
    this.onText?.(t);
  }

  private wrap(
    text: string,
    role: Role,
    size: number,
    maxW: number,
    maxLines = 6,
  ): string[] {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (this.measure(next, role, size) <= maxW || !cur) {
        cur = next;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    const out = lines
      .slice(0, maxLines)
      .map((l) => this.fit(l, role, size, maxW));
    if (lines.length > maxLines)
      out[maxLines - 1] = this.fit(`${out[maxLines - 1]}…`, role, size, maxW);
    return out;
  }

  private rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: string,
    stroke?: string,
    r = 0,
  ): void {
    const d = this.doc;
    if (r > 0) d.roundedRect(x, y, w, h, r);
    else d.rect(x, y, w, h);
    if (fill && stroke) d.fillAndStroke(fill, stroke);
    else if (fill) d.fill(fill);
    else if (stroke) d.stroke(stroke);
  }

  private hline(
    x1: number,
    x2: number,
    y: number,
    color = C.rule,
    w = 0.6,
  ): void {
    this.doc
      .lineWidth(w)
      .strokeColor(color)
      .moveTo(x1, y)
      .lineTo(x2, y)
      .stroke();
  }

  private vline(
    x: number,
    y1: number,
    y2: number,
    color = C.rule,
    w = 0.6,
  ): void {
    this.doc
      .lineWidth(w)
      .strokeColor(color)
      .moveTo(x, y1)
      .lineTo(x, y2)
      .stroke();
  }

  private card(
    x: number,
    y: number,
    w: number,
    h: number,
    fill = C.card,
  ): void {
    this.doc.lineWidth(0.6);
    this.rect(x, y, w, h, fill, C.cardLine, 2);
  }

  private ensure(h: number): void {
    if (this.y + h > BOTTOM) this.newPage();
  }

  /* -------------------------------- pages -------------------------------- */

  private brand(x: number, y: number, size: number): void {
    this.rect(x, y, size, size, C.green, undefined, size * 0.22);
    this.text('R', x, y + size * 0.16, {
      role: 'serifBold',
      size: size * 0.66,
      color: C.white,
      align: 'center',
      width: size,
    });
    this.text('RAKHAL', x + size + 9, y + size * 0.1, {
      role: 'sansBold',
      size: 9,
      color: C.greenDark,
      cs: 1.6,
    });
    this.text('FARM RECORDS, CLEARLY.', x + size + 9, y + size * 0.1 + 14, {
      size: 5.6,
      color: C.muted,
      cs: 1,
    });
  }

  private newPage(): void {
    if (this.pages >= MAX_PAGES) {
      throw new ReportError(
        'RENDER_FAILED',
        'The report is too large to render.',
      );
    }
    this.doc.addPage({
      size: 'A4',
      margins: { top: 0, left: 0, bottom: 0, right: 0 },
    });
    this.pages += 1;
    this.rect(0, 0, PAGE_W, PAGE_H, C.page);
    this.rect(0, 0, PAGE_W * 0.45, 5, C.green);
    this.rect(PAGE_W * 0.45, 0, PAGE_W * 0.55, 5, C.sage);
    if (this.pages === 1) {
      this.firstHeader();
    } else {
      this.brand(MX, 30, 22);
      this.text(this.layout.headerRight[0] ?? '', MX, 32, {
        size: 6,
        color: C.muted,
        cs: 0.9,
        align: 'right',
        width: CW,
      });
      this.text(`${this.layout.headerRight[1] ?? ''} · CONTINUED`, MX, 42, {
        size: 6,
        color: C.muted,
        cs: 0.9,
        align: 'right',
        width: CW,
      });
      this.hline(MX, MX + CW, 66);
      this.y = TOP_LATER;
    }
  }

  private firstHeader(): void {
    const L = this.layout;
    this.brand(MX, 34, 28);
    let rightEdge = MX + CW;
    if (this.logo) {
      try {
        const maxW = 96;
        const maxH = 30;
        const s = Math.min(maxW / this.logo.w, maxH / this.logo.h, 1);
        const w = this.logo.w * s;
        const h = this.logo.h * s;
        this.doc.image(this.logo.buf, rightEdge - w, 34 + (28 - h) / 2, {
          width: w,
          height: h,
        });
        rightEdge -= w + 12;
      } catch {
        /* a bad logo never fails the report */
      }
    }
    this.text(L.headerRight[0] ?? '', MX, 38, {
      size: 6,
      color: C.muted,
      cs: 0.9,
      align: 'right',
      width: rightEdge - MX,
    });
    this.text(L.headerRight[1] ?? '', MX, 49, {
      size: 6,
      color: C.muted,
      cs: 0.9,
      align: 'right',
      width: rightEdge - MX,
    });
    this.hline(MX, MX + CW, 78);
    this.text(L.eyebrow, MX, 92, {
      role: 'sansBold',
      size: 6.5,
      color: C.green,
      cs: 1.2,
      maxW: CW,
    });
    this.text(L.title, MX, 104, {
      role: 'serif',
      size: 27,
      color: C.text,
      maxW: CW,
    });
    this.text(L.farmName, MX, 140, {
      role: 'sansBold',
      size: 9,
      color: C.text,
      maxW: CW,
    });
    let x = MX;
    const metaY = 156;
    for (const m of L.meta) {
      const label = `${m.label}  `;
      const lw = this.measure(label, 'sansBold', 7);
      const avail = MX + CW - x - lw;
      const value = this.fit(
        m.value,
        'sans',
        7,
        Math.max(40, Math.min(avail, 230)),
      );
      const vw = this.measure(value, 'sans', 7);
      if (x + lw + vw > MX + CW) break;
      this.text(label, x, metaY, { role: 'sansBold', size: 7, color: C.text });
      this.text(value, x + lw, metaY, { size: 7, color: C.muted });
      x += lw + vw + 18;
    }
    this.y = 178;
  }

  /* --------------------------------- main -------------------------------- */

  private draw(): void {
    this.newPage();
    const blocks = this.layout.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'section') {
        // Widow protection: a heading is never left alone at the bottom of a page.
        this.ensure(26 + 90);
        this.section(b.title);
      } else {
        this.block(b);
      }
    }
    this.footers();
  }

  private block(b: LayoutBlock): void {
    switch (b.type) {
      case 'hero':
        return this.hero(b);
      case 'kpis':
        return this.kpis(b.cards);
      case 'line':
      case 'bar':
        return this.chart(b);
      case 'donut':
        return this.donut(b);
      case 'ranked':
        return this.ranked(b);
      case 'table':
        return this.tableBlock(b.title, b.table);
      case 'exceptions':
        return this.exceptions(b);
      case 'notice':
        return this.notice(b);
      case 'dataQuality':
        return this.dataQuality(b);
      default:
        return;
    }
  }

  private footers(): void {
    const range = this.doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      this.doc.switchToPage(range.start + i);
      const fy = PAGE_H - 44;
      this.hline(MX, MX + CW, fy);
      this.text(this.layout.footerLabel, MX, fy + 10, {
        role: 'sansBold',
        size: 6.5,
        color: C.greenDark,
        cs: 0.8,
      });
      this.text(this.layout.farmName, MX, fy + 8, {
        size: 6.5,
        color: C.muted,
        align: 'right',
        width: CW,
        maxW: CW * 0.5,
      });
      const pg = `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      this.text(pg, MX, fy + 18, {
        role: 'serif',
        size: 8.5,
        color: C.muted,
        align: 'right',
        width: CW,
      });
    }
  }

  /* -------------------------------- blocks ------------------------------- */

  private section(title: string): void {
    this.y += 4;
    this.text(title, MX, this.y, {
      role: 'serif',
      size: 14,
      color: C.greenDark,
      maxW: CW,
    });
    this.y += 20;
    this.hline(MX, MX + CW, this.y - 3);
    this.y += 5;
  }

  private hero(b: Extract<LayoutBlock, { type: 'hero' }>): void {
    const h = 72;
    this.ensure(h + GAP);
    const y = this.y;
    this.rect(MX, y, CW, h, C.green, undefined, 3);
    const sideW = 170;
    this.text(b.eyebrow, MX + 16, y + 12, {
      role: 'sansBold',
      size: 6.5,
      color: C.sageLight,
      cs: 1.1,
      maxW: CW - sideW - 24,
    });
    const isValue = b.state === 'value';
    const vSize = isValue ? 30 : 20;
    const vText = b.valueText;
    this.text(vText, MX + 16, y + 24, {
      role: 'serifBold',
      size: vSize,
      color: C.white,
    });
    if (b.unitText) {
      const vw = this.measure(vText, isValue ? 'serifBold' : 'sansBold', vSize);
      this.text(b.unitText, MX + 16 + vw + 5, y + 24 + vSize - 15, {
        role: 'serif',
        size: 12,
        color: C.sageLight,
      });
    }
    const sub = [b.delta ? b.delta.text : '', b.caption ?? '']
      .filter(Boolean)
      .join('  ·  ');
    if (sub)
      this.text(sub, MX + 16, y + h - 15, {
        size: 7,
        color: C.sageLight,
        maxW: CW - sideW - 24,
      });
    const sx = MX + CW - sideW;
    this.doc
      .lineWidth(0.6)
      .strokeColor('#5E8A7C')
      .moveTo(sx, y + 12)
      .lineTo(sx, y + h - 12)
      .stroke();
    this.text(b.sideLabel, sx + 14, y + 14, {
      role: 'sansBold',
      size: 6.5,
      color: C.white,
      cs: 1.1,
    });
    let ly = y + 28;
    for (const line of b.sideLines.slice(0, 3)) {
      for (const l of this.wrap(line, 'sans', 7.5, sideW - 24, 2)) {
        this.text(l, sx + 14, ly, { size: 7.5, color: C.sageLight });
        ly += 10;
      }
    }
    this.y = y + h + GAP + 4;
  }

  private kpis(cards: KpiCard[]): void {
    const cols = 4;
    const gap = 8;
    const w = (CW - gap * (cols - 1)) / cols;
    const h = 68;
    for (let i = 0; i < cards.length; i += cols) {
      this.ensure(h + gap);
      const y = this.y;
      cards
        .slice(i, i + cols)
        .forEach((c, j) => this.kpiCard(c, MX + j * (w + gap), y, w, h));
      this.y += h + gap;
    }
    this.y += 2;
  }

  private kpiCard(
    c: KpiCard,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    this.card(x, y, w, h);
    const iw = w - 16;
    const label = this.wrap(c.label.toUpperCase(), 'sansBold', 5.8, iw, 2);
    // `wrap` measures without letter spacing; leave a little headroom for the 0.5 tracking.
    label.forEach((l, i) =>
      this.text(l, x + 8, y + 8 + i * 8, {
        role: 'sansBold',
        size: 5.8,
        color: C.muted,
        cs: 0.4,
        maxW: iw,
      }),
    );
    const vy = y + 27;
    if (c.state === 'value') {
      this.text(c.valueText, x + 8, vy, {
        role: 'serif',
        size: 17,
        color: C.text,
        maxW: iw,
      });
      if (c.unitText) {
        const vw = this.measure(c.valueText, 'serif', 17);
        if (vw + 6 < iw)
          this.text(c.unitText, x + 8 + vw + 4, vy + 6, {
            size: 8,
            color: C.muted,
            maxW: iw - vw - 6,
          });
      }
    } else {
      this.text(c.valueText, x + 8, vy + 3, {
        role: 'sansBold',
        size: 10,
        color: C.amber,
        maxW: iw,
      });
    }
    let sy = y + 50;
    if (c.delta) {
      const col =
        c.delta.direction === 'up'
          ? C.green
          : c.delta.direction === 'down'
            ? C.amber
            : C.muted;
      this.text(`${c.delta.text} vs previous`, x + 8, sy, {
        role: 'sansBold',
        size: 6.2,
        color: col,
        maxW: iw,
      });
      sy += 9;
    } else if (c.detail) {
      this.text(c.detail, x + 8, sy, { size: 6.2, color: C.muted, maxW: iw });
      sy += 8;
    }
    if (c.sourceLabel)
      this.text(c.sourceLabel, x + 8, sy, {
        size: 5.8,
        color: C.muted,
        maxW: iw,
      });
  }

  private cardTitle(
    title: string,
    unit: string,
    x: number,
    y: number,
    w: number,
  ): void {
    this.text(title, x + 10, y + 9, {
      role: 'sansBold',
      size: 7.5,
      color: C.text,
      maxW: w - 20 - (unit ? 60 : 0),
    });
    if (unit)
      this.text(unit, x + 10, y + 9, {
        size: 6.5,
        color: C.muted,
        align: 'right',
        width: w - 20,
      });
  }

  private chart(b: Extract<LayoutBlock, { type: 'line' | 'bar' }>): void {
    const h = 150 + (b.footnote ? 12 : 0);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h);
    this.cardTitle(b.title, b.unitLabel ? `${b.unitLabel}` : '', x, y, CW);

    const px = x + 40;
    const pw = CW - 40 - 16;
    const py = y + 30;
    const ph = 150 - 30 - 26;
    const vals = b.points
      .map((p) => p.value)
      .filter((v): v is number => v !== null);
    if (vals.length === 0) {
      this.text('Not recorded', x, py + ph / 2 - 4, {
        role: 'sansBold',
        size: 10,
        color: C.amber,
        align: 'center',
        width: CW,
      });
    } else {
      // Bars grow from a zero baseline, so the axis always spans zero (negative bars hang below it).
      let lo = Math.min(...vals, b.type === 'bar' ? 0 : Infinity);
      let hi = Math.max(...vals, b.type === 'bar' ? 0 : -Infinity);
      if (b.type === 'line') {
        const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
        lo -= pad;
        hi += pad;
      } else if (hi === lo) hi = lo + 1;
      const yOf = (v: number): number => py + ph - ((v - lo) / (hi - lo)) * ph;
      const n = b.points.length;
      const xOf = (i: number): number =>
        n === 1 ? px + pw / 2 : px + (i * pw) / (n - 1);
      // gridlines
      for (let g = 0; g <= 2; g++) {
        const gv = lo + ((hi - lo) * g) / 2;
        const gy = yOf(gv);
        this.hline(px, px + pw, gy, '#E6E8E2', 0.5);
        this.text(fmtTick(gv), x + 6, gy - 3, {
          size: 6,
          color: C.muted,
          align: 'right',
          width: 28,
        });
      }
      if (b.type === 'line') this.lineSeries(b.points, xOf, yOf, py + ph);
      else this.barSeries(b.points, px, pw, yOf, py + ph);
      // x labels
      const maxLabels = Math.min(n, 7);
      const used = new Set<number>();
      for (let k = 0; k < maxLabels; k++)
        used.add(
          maxLabels === 1 ? 0 : Math.round((k * (n - 1)) / (maxLabels - 1)),
        );
      // Bar labels get the room between neighbouring labels and shrink (down to 4.4pt) before ellipsising.
      const labelW =
        b.type === 'bar'
          ? Math.max(50, Math.min(pw / Math.max(maxLabels, 1), 96))
          : 50;
      for (const i of used) {
        const cx = b.type === 'bar' ? px + ((i + 0.5) * pw) / n : xOf(i);
        const lt = clean(b.points[i].label);
        this.text(b.points[i].label, cx - labelW / 2, py + ph + 6, {
          size: this.shrinkSize(lt, 'sans', 6, 4.4, labelW),
          color: C.muted,
          align: 'center',
          width: labelW,
          maxW: labelW,
        });
      }
    }
    if (b.footnote)
      this.text(b.footnote, x + 10, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 20,
      });
    this.y = y + h + GAP;
  }

  private lineSeries(
    pts: ChartPoint[],
    xOf: (i: number) => number,
    yOf: (v: number) => number,
    baseY: number,
  ): void {
    const d = this.doc;
    // contiguous runs (gaps break the line: missing is never drawn as 0)
    const runs: { i: number; v: number }[][] = [];
    let cur: { i: number; v: number }[] = [];
    pts.forEach((p, i) => {
      if (p.value === null) {
        if (cur.length) runs.push(cur);
        cur = [];
      } else cur.push({ i, v: p.value });
    });
    if (cur.length) runs.push(cur);
    for (const r of runs) {
      if (r.length >= 2) {
        d.moveTo(xOf(r[0].i), baseY);
        for (const p of r) d.lineTo(xOf(p.i), yOf(p.v));
        d.lineTo(xOf(r[r.length - 1].i), baseY)
          .closePath()
          .fillColor(C.sageLight)
          .fill();
        d.lineWidth(1.5).strokeColor(C.green).lineJoin('round');
        d.moveTo(xOf(r[0].i), yOf(r[0].v));
        for (const p of r.slice(1)) d.lineTo(xOf(p.i), yOf(p.v));
        d.stroke();
      }
      // A lone recorded point has no line to show it, so it is always drawn as a dot.
      if (pts.length <= 40 || r.length === 1)
        for (const p of r)
          d.circle(xOf(p.i), yOf(p.v), 1.8).fillColor(C.green).fill();
    }
    pts.forEach((p, i) => {
      if (p.value === null) {
        d.lineWidth(1)
          .strokeColor(C.sand)
          .moveTo(xOf(i), baseY - 5)
          .lineTo(xOf(i), baseY)
          .stroke();
      }
    });
  }

  private barSeries(
    pts: ChartPoint[],
    px: number,
    pw: number,
    yOf: (v: number) => number,
    baseY: number,
  ): void {
    const n = pts.length;
    const slot = pw / n;
    const bw = Math.min(34, slot * 0.62);
    const zeroY = yOf(0);
    pts.forEach((p, i) => {
      const cx = px + (i + 0.5) * slot;
      if (p.value === null) {
        this.doc
          .lineWidth(1)
          .strokeColor(C.sand)
          .moveTo(cx, baseY - 5)
          .lineTo(cx, baseY)
          .stroke();
        return;
      }
      const end = yOf(p.value);
      const top = Math.min(end, zeroY);
      this.rect(
        cx - bw / 2,
        top,
        bw,
        Math.max(0.5, Math.abs(end - zeroY)),
        C.sageMid,
      );
      if (n <= 12) {
        // The payload-derived text (same formatting as the tables), shrunk to the slot before ellipsising.
        const lw = Math.max(slot, 40);
        const size = this.shrinkSize(p.text, 'sans', 6, 4.4, lw);
        this.text(p.text, cx - lw / 2, p.value < 0 ? end + 2 : top - 8, {
          size,
          color: C.muted,
          align: 'center',
          width: lw,
          maxW: lw,
        });
      }
    });
  }

  private donut(b: Extract<LayoutBlock, { type: 'donut' }>): void {
    // The card grows with the legend (at most DONUT_MAX_SLICES rows) so it never overflows its border.
    const legendRows = b.slices.length;
    const h = Math.max(124, 36 + legendRows * 12 + 10) + (b.footnote ? 12 : 0);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h);
    this.cardTitle(b.title, '', x, y, CW);
    const cx = x + 70;
    const cy = y + 32 + 40;
    const R = 40;
    const r = 25;
    const total = b.slices.reduce((s, v) => s + v.value, 0);
    if (total > 0 && b.slices.length > 0) {
      let a0 = -Math.PI / 2;
      b.slices.forEach((s, i) => {
        const sweep = (s.value / total) * Math.PI * 2;
        this.ring(
          cx,
          cy,
          R,
          r,
          a0,
          a0 + (b.slices.length === 1 ? Math.PI * 2 - 0.0001 : sweep),
          PALETTE[i % PALETTE.length],
        );
        a0 += sweep;
      });
    }
    this.text(b.centerText, cx - r, cy - 5, {
      role: 'serif',
      size: 9,
      color: C.text,
      align: 'center',
      width: r * 2,
      maxW: r * 2,
    });
    if (b.centerCaption)
      this.text(b.centerCaption, cx - r, cy + 5, {
        size: 5.6,
        color: C.muted,
        align: 'center',
        width: r * 2,
        maxW: r * 2,
      });
    let ly = y + 36;
    b.slices.forEach((s, i) => {
      this.rect(x + 150, ly + 1, 7, 7, PALETTE[i % PALETTE.length]);
      this.text(s.label, x + 164, ly, { size: 7.5, color: C.text, maxW: 150 });
      this.text(s.text, x + 164, ly, {
        size: 7.5,
        color: C.muted,
        align: 'right',
        width: CW - 164 - 14,
      });
      ly += 12;
    });
    if (b.footnote)
      this.text(b.footnote, x + 10, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 20,
      });
    this.y = y + h + GAP;
  }

  private ring(
    cx: number,
    cy: number,
    R: number,
    r: number,
    a0: number,
    a1: number,
    color: string,
  ): void {
    const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 90));
    const d = this.doc;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const px = cx + R * Math.cos(a);
      const py = cy + R * Math.sin(a);
      if (i === 0) d.moveTo(px, py);
      else d.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / steps;
      d.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    d.closePath().fill(color);
  }

  private ranked(b: Extract<LayoutBlock, { type: 'ranked' }>): void {
    const rowH = 15;
    const head = 30;
    const n = Math.max(b.rows.length, b.table?.rows.length ?? 0, 1);
    const h = head + n * rowH + (b.footnote ? 16 : 8);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h);
    this.cardTitle(b.title, b.unitLabel, x, y, b.table ? CW * 0.46 : CW);
    const barW = b.table ? CW * 0.46 : CW;
    const max = Math.max(...b.rows.map((r) => r.value), 0);
    if (b.rows.length === 0) {
      this.text('Not recorded', x + 10, y + head + 4, {
        role: 'sansBold',
        size: 9,
        color: C.amber,
      });
    }
    b.rows.forEach((r, i) =>
      this.rankedRow(r, i, x + 10, y + head + i * rowH, barW - 20, max),
    );
    if (b.table) {
      const tx = x + CW * 0.46 + 6;
      this.vline(tx - 6, y + 8, y + h - 8, C.rule);
      const tw = CW - CW * 0.46 - 16;
      this.tableBody(b.table, tx, y + 10, tw, rowH, true, b.table.rows.length);
    }
    if (b.footnote)
      this.text(b.footnote, x + 10, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 20,
      });
    this.y = y + h + GAP;
  }

  private rankedRow(
    r: RankedRow,
    i: number,
    x: number,
    y: number,
    w: number,
    max: number,
  ): void {
    this.text(String(r.rank).padStart(2, '0'), x, y + 3, {
      size: 6.5,
      color: C.muted,
    });
    const labelW = Math.min(88, w * 0.34);
    this.text(r.label, x + 14, y + 3, {
      size: this.shrinkSize(clean(r.label), 'sans', 7, 5, labelW),
      color: C.text,
      maxW: labelW,
    });
    const valueW = 62;
    const bx = x + 14 + labelW + 6;
    const bw = Math.max(20, w - (bx - x) - valueW - 4);
    this.rect(bx, y + 4, bw, 6, '#EEF1EC');
    const fill = max > 0 ? Math.max(1.5, (r.value / max) * bw) : 0;
    this.rect(bx, y + 4, fill, 6, i === 0 ? C.green : C.sageMid);
    this.text(r.text, bx + bw + 4, y + 3, {
      size: 7,
      color: C.text,
      align: 'right',
      width: valueW,
      maxW: valueW,
    });
  }

  /** Table header + rows for the side table of a ranked block (no pagination). */
  private tableBody(
    t: TableSpec,
    x: number,
    y: number,
    w: number,
    rowH: number,
    dropRank: boolean,
    count: number,
  ): void {
    const cols = t.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !(dropRank && c.label === '#'));
    const widths = this.colWidths(
      cols.map((k) => k.c.weight),
      w,
    );
    this.tableHeader(
      cols.map((k) => k.c),
      widths,
      x,
      y,
      20,
    );
    const rows = t.rows.slice(0, count);
    rows.forEach((row, ri) => {
      const ry = y + 20 + ri * rowH;
      this.tableRow(
        cols.map((k) => row[k.i] ?? ''),
        cols.map((k) => k.c.align),
        widths,
        x,
        ry,
        rowH,
        ri % 2 === 1,
        7,
      );
    });
  }

  private colWidths(weights: number[], total: number): number[] {
    const sum = weights.reduce((s, v) => s + v, 0) || 1;
    return weights.map((v) => (v / sum) * total);
  }

  private tableHeader(
    cols: { label: string; align: 'left' | 'right' }[],
    widths: number[],
    x: number,
    y: number,
    h: number,
  ): void {
    this.rect(
      x,
      y,
      widths.reduce((s, v) => s + v, 0),
      h,
      C.sageLight,
    );
    let cx = x;
    cols.forEach((c, i) => {
      const lines = this.wrap(c.label, 'sansBold', 6, widths[i] - 8, 2);
      lines.forEach((l, li) =>
        this.text(l, cx + 4, y + (lines.length === 1 ? 7 : 3) + li * 7.5, {
          role: 'sansBold',
          size: 6,
          color: C.greenDark,
          align: c.align,
          width: widths[i] - 8,
        }),
      );
      cx += widths[i];
    });
  }

  private tableRow(
    cells: string[],
    aligns: ('left' | 'right')[],
    widths: number[],
    x: number,
    y: number,
    h: number,
    stripe: boolean,
    size: number,
  ): void {
    if (stripe)
      this.rect(
        x,
        y,
        widths.reduce((s, v) => s + v, 0),
        h,
        '#F5F6F1',
      );
    let cx = x;
    cells.forEach((cell, i) => {
      this.text(cell, cx + 4, y + (h - size) / 2 - 0.5, {
        size,
        color: C.text,
        align: aligns[i],
        width: widths[i] - 8,
        maxW: widths[i] - 8,
      });
      cx += widths[i];
    });
  }

  private tableBlock(title: string, t: TableSpec): void {
    const rowH = 15;
    const headH = 22;
    const titleH = 22;
    const widths = this.colWidths(
      t.columns.map((c) => c.weight),
      CW,
    );
    const aligns = t.columns.map((c) => c.align);
    let i = 0;
    const total = t.rows.length;
    let first = true;
    while (i < total || first) {
      // widow protection: title + header + at least `minRowsBeforeBreak` rows must fit, else new page.
      const need =
        (first ? titleH : 0) +
        headH +
        Math.min(total - i, t.minRowsBeforeBreak) * rowH;
      this.ensure(need);
      let cap = Math.floor(
        (BOTTOM - this.y - (first ? titleH : 0) - headH) / rowH,
      );
      cap = Math.max(1, cap);
      const remaining = total - i;
      let take = Math.min(cap, remaining);
      // no stranded last rows on the next page
      if (
        remaining > take &&
        remaining - take < t.avoidOrphanRows &&
        take > t.avoidOrphanRows
      ) {
        take -= t.avoidOrphanRows - (remaining - take);
      }
      if (first) {
        this.text(title, MX, this.y + 4, {
          role: 'sansBold',
          size: 8.5,
          color: C.text,
          maxW: CW,
        });
        this.y += titleH;
      }
      this.tableHeader(t.columns, widths, MX, this.y, headH);
      this.y += headH;
      for (let k = 0; k < take; k++) {
        this.tableRow(
          t.rows[i + k],
          aligns,
          widths,
          MX,
          this.y,
          rowH,
          (i + k) % 2 === 1,
          7,
        );
        this.hline(MX, MX + CW, this.y + rowH, '#ECEEE8', 0.4);
        this.y += rowH;
      }
      i += take;
      first = false;
      if (i < total) this.newPage();
    }
    if (t.note) {
      this.ensure(14);
      this.text(t.note, MX, this.y + 3, {
        size: 6.5,
        color: C.muted,
        maxW: CW,
      });
      this.y += 14;
    }
    this.y += GAP;
  }

  private exceptions(b: Extract<LayoutBlock, { type: 'exceptions' }>): void {
    const lh = 11;
    const h = 28 + b.items.length * lh + 6;
    this.ensure(Math.min(h, 120) + GAP);
    let y = this.y;
    let drawn = 0;
    while (drawn < b.items.length) {
      const room = Math.max(1, Math.floor((BOTTOM - y - 34) / lh));
      const part = b.items.slice(drawn, drawn + room);
      const ph = 28 + part.length * lh + 6;
      this.rect(MX, y, CW, ph, C.warnBg, undefined, 2);
      this.rect(MX, y, 2.5, ph, C.sand);
      this.text(b.title.toUpperCase(), MX + 12, y + 9, {
        role: 'sansBold',
        size: 6.5,
        color: C.amber,
        cs: 1,
      });
      part.forEach((it, i) => {
        this.text(it.text, MX + 12, y + 24 + i * lh, {
          size: 7.5,
          color: C.text,
          maxW: CW - 130,
        });
        if (it.detail)
          this.text(it.detail, MX, y + 24 + i * lh, {
            size: 7.5,
            color: C.muted,
            align: 'right',
            width: CW - 12,
          });
      });
      drawn += part.length;
      y += ph + GAP;
      if (drawn < b.items.length) {
        this.newPage();
        y = this.y;
      }
    }
    this.y = y;
  }

  private notice(b: Extract<LayoutBlock, { type: 'notice' }>): void {
    const lines = this.wrap(b.text, 'sans', 7.5, CW - 28, 4);
    const h = 28 + lines.length * 10 + 4;
    this.ensure(h + GAP);
    const y = this.y;
    this.rect(MX, y, CW, h, C.restricted, undefined, 2);
    this.rect(MX, y, 2.5, h, C.green);
    this.text(b.title, MX + 12, y + 9, {
      role: 'sansBold',
      size: 6.5,
      color: C.greenDark,
      cs: 1,
    });
    lines.forEach((l, i) =>
      this.text(l, MX + 12, y + 22 + i * 10, { size: 7.5, color: C.muted }),
    );
    this.y = y + h + GAP;
  }

  private dataQuality(b: Extract<LayoutBlock, { type: 'dataQuality' }>): void {
    const iw = CW - 28;
    const items: string[][] = [];
    if (b.coverage) items.push(this.wrap(b.coverage, 'sansBold', 7.5, iw, 2));
    for (const r of b.rules)
      items.push(this.wrap(`• ${r}`, 'sans', 7.2, iw, 3));
    for (const n of b.notes)
      items.push(this.wrap(`• ${n}`, 'sans', 7.2, iw, 3));
    const lineCount = items.reduce((s, l) => s + l.length, 0);
    const h = 26 + lineCount * 9.5 + items.length * 2 + 8;
    this.ensure(h + GAP);
    const y = this.y;
    this.card(MX, y, CW, h, C.warnBg);
    this.text(b.title.toUpperCase(), MX + 12, y + 9, {
      role: 'sansBold',
      size: 6.5,
      color: C.amber,
      cs: 1,
    });
    let ly = y + 23;
    items.forEach((lines, idx) => {
      lines.forEach((l) => {
        this.text(l, MX + 12, ly, {
          role: idx === 0 && b.coverage ? 'sansBold' : 'sans',
          size: idx === 0 && b.coverage ? 7.5 : 7.2,
          color: idx === 0 && b.coverage ? C.text : C.muted,
        });
        ly += 9.5;
      });
      ly += 2;
    });
    this.y = y + h + GAP;
  }
}

function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return `${Math.round(v).toLocaleString('en-US')}`;
  if (a >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}
