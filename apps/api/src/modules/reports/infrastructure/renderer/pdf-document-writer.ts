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
  page: '#FFFFFF',
  forest: '#0C2A1D',
  forestDark: '#06170F',
  forestLight: '#143D2B',
  forestSubtle: '#1C543B',
  emerald: '#059669',
  emeraldBright: '#10B981',
  emeraldLight: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  teal: '#0D9488',
  sand: '#10B981',
  gold: '#D97706',
  goldLight: '#FEF3C7',
  goldBorder: '#FDE68A',
  amber: '#D97706',
  text: '#0F172A',
  textHeading: '#0A1E14',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  rule: '#E2E8F0',
  card: '#FFFFFF',
  cardLine: '#E2E8F0',
  cardBg: '#FAFCFA',
  warnBg: '#FFFBEB',
  warnBorder: '#FCD34D',
  restricted: '#F8FAFC',
  white: '#FFFFFF',
  green: '#059669',
  greenDark: '#0C2A1D',
  sage: '#059669',
  sageMid: '#0C2A1D',
  sageLight: '#ECFDF5',
};
const PALETTE = [
  '#059669', // Emerald
  '#0284C7', // Sky Blue
  '#D97706', // Amber Gold
  '#8B5CF6', // Purple
  '#0D9488', // Teal
  '#F43F5E', // Rose
  '#10B981', // Mint
  '#6366F1', // Indigo
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
    this.rect(x, y, w, h, fill, C.cardLine, 4);
  }

  private ensure(h: number): void {
    if (this.y + h > BOTTOM) this.newPage();
  }

  /* -------------------------------- pages -------------------------------- */

  private brand(x: number, y: number, size: number): void {
    // Sleek rounded emblem badge in deep luxury forest
    this.rect(x, y, size, size, C.forest, undefined, 6);
    this.rect(x + 1.2, y + 1.2, size - 2.4, size - 2.4, undefined, C.forestSubtle, 4.8);
    this.text('R', x, y + size * 0.15, {
      role: 'serifBold',
      size: size * 0.65,
      color: C.white,
      align: 'center',
      width: size,
    });
    // Gold accent dot in corner
    this.rect(x + size - 5.5, y + size - 5.5, 3, 3, C.gold, undefined, 1.5);

    this.text('RAKHAL', x + size + 9, y + size * 0.08, {
      role: 'sansBold',
      size: 9.5,
      color: C.forestDark,
      cs: 1.8,
    });
    this.text('FARM INTELLIGENCE REPORT', x + size + 9, y + size * 0.08 + 13.5, {
      role: 'sansBold',
      size: 5.4,
      color: C.emerald,
      cs: 1.1,
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
    // Modern multi-tier top accent band
    this.rect(0, 0, PAGE_W, 4.5, C.forest);
    this.rect(0, 4.5, PAGE_W, 2, C.emeraldBright);
    this.rect(0, 6.5, PAGE_W, 1, C.gold);

    if (this.pages === 1) {
      this.firstHeader();
    } else {
      this.brand(MX, 28, 22);
      this.text(this.layout.headerRight[0] ?? '', MX, 30, {
        role: 'sansBold',
        size: 6.2,
        color: C.forest,
        cs: 0.9,
        align: 'right',
        width: CW,
      });
      this.text(`${this.layout.headerRight[1] ?? ''} · CONTINUED`, MX, 40, {
        size: 6,
        color: C.muted,
        cs: 0.8,
        align: 'right',
        width: CW,
      });
      this.hline(MX, MX + 40, 62, C.emerald, 1.2);
      this.hline(MX + 40, MX + CW, 62, C.rule, 0.5);
      this.y = TOP_LATER;
    }
  }

  private firstHeader(): void {
    const L = this.layout;
    this.brand(MX, 32, 28);
    let rightEdge = MX + CW;
    if (this.logo) {
      try {
        const maxW = 96;
        const maxH = 30;
        const s = Math.min(maxW / this.logo.w, maxH / this.logo.h, 1);
        const w = this.logo.w * s;
        const h = this.logo.h * s;
        this.rect(rightEdge - w - 4, 32 + (28 - h) / 2 - 2, w + 8, h + 4, C.cardBg, C.cardLine, 4);
        this.doc.image(this.logo.buf, rightEdge - w, 32 + (28 - h) / 2, {
          width: w,
          height: h,
        });
        rightEdge -= w + 16;
      } catch {
        /* a bad logo never fails the report */
      }
    }
    this.text(L.headerRight[0] ?? '', MX, 36, {
      role: 'sansBold',
      size: 6.8,
      color: C.forest,
      cs: 1,
      align: 'right',
      width: rightEdge - MX,
    });
    this.text(L.headerRight[1] ?? '', MX, 47, {
      size: 6.2,
      color: C.muted,
      cs: 0.8,
      align: 'right',
      width: rightEdge - MX,
    });
    // Dual-tone divider line
    this.hline(MX, MX + 45, 74, C.emerald, 1.4);
    this.hline(MX + 45, MX + CW, 74, C.rule, 0.6);

    this.text(L.eyebrow, MX, 88, {
      role: 'sansBold',
      size: 6.8,
      color: C.emerald,
      cs: 1.3,
      maxW: CW,
    });
    this.text(L.title, MX, 100, {
      role: 'sansBold',
      size: 26,
      color: C.text,
      maxW: CW,
    });
    this.text(L.farmName, MX, 136, {
      role: 'sansBold',
      size: 11,
      color: C.forest,
      maxW: CW,
    });
    let x = MX;
    const metaY = 154;
    for (const m of L.meta) {
      const label = `${m.label}: `;
      const lw = this.measure(label, 'sansBold', 6.6);
      const avail = MX + CW - x - lw - 16;
      const value = this.fit(
        m.value,
        'sans',
        6.6,
        Math.max(40, Math.min(avail, 230)),
      );
      const vw = this.measure(value, 'sans', 6.6);
      const badgeW = lw + vw + 14;
      if (x + badgeW > MX + CW) break;
      this.rect(x, metaY - 3, badgeW, 16, C.cardBg, C.cardLine, 4);
      this.text(label, x + 7, metaY + 1.2, { role: 'sansBold', size: 6.6, color: C.forest });
      this.text(value, x + 7 + lw, metaY + 1.2, { size: 6.6, color: C.text });
      x += badgeW + 8;
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
      this.hline(MX, MX + 45, fy, C.emerald, 1.2);
      this.hline(MX + 45, MX + CW, fy, C.rule, 0.5);
      this.text(this.layout.footerLabel, MX, fy + 10, {
        role: 'sansBold',
        size: 6.8,
        color: C.forestDark,
        cs: 0.9,
      });
      this.text('Rakhal Farm Engine Verified · Official Operational Audit', MX, fy + 20, {
        size: 5.6,
        color: C.muted,
        cs: 0.5,
      });
      this.text(this.layout.farmName, MX, fy + 8, {
        role: 'sansBold',
        size: 6.8,
        color: C.forest,
        align: 'right',
        width: CW,
        maxW: CW * 0.5,
      });
      const pg = `Page ${i + 1} of ${total}`;
      this.text(pg, MX, fy + 18, {
        role: 'sans',
        size: 7.2,
        color: C.muted,
        align: 'right',
        width: CW,
      });
    }
  }

  /* -------------------------------- blocks ------------------------------- */

  private section(title: string): void {
    this.y += 6;
    this.rect(MX, this.y + 1, 3.5, 13, C.emerald, undefined, 1.5);
    this.text(title, MX + 10, this.y, {
      role: 'sansBold',
      size: 13.5,
      color: C.forestDark,
      maxW: CW - 10,
    });
    this.y += 19;
    this.hline(MX, MX + 45, this.y - 3, C.emerald, 1.2);
    this.hline(MX + 45, MX + CW, this.y - 3, C.rule, 0.5);
    this.y += 6;
  }

  private hero(b: Extract<LayoutBlock, { type: 'hero' }>): void {
    const h = 74;
    this.ensure(h + GAP);
    const y = this.y;
    this.rect(MX, y, CW, h, C.forest, undefined, 7);
    this.rect(MX, y, 4, h, C.emeraldBright, undefined, 2);

    const sideW = 175;
    this.text(b.eyebrow, MX + 18, y + 12, {
      role: 'sansBold',
      size: 6.8,
      color: C.emeraldBorder,
      cs: 1.2,
      maxW: CW - sideW - 28,
    });
    const isValue = b.state === 'value';
    const vSize = isValue ? 30 : 20;
    const vText = b.valueText;
    this.text(vText, MX + 18, y + 24, {
      role: 'sansBold',
      size: vSize,
      color: C.white,
    });
    if (b.unitText) {
      const vw = this.measure(vText, 'sansBold', vSize);
      this.text(b.unitText, MX + 18 + vw + 6, y + 24 + vSize - 15, {
        role: 'sansBold',
        size: 12,
        color: C.emeraldBorder,
      });
    }
    const sub = [b.delta ? b.delta.text : '', b.caption ?? '']
      .filter(Boolean)
      .join('  ·  ');
    if (sub) {
      const isUp = b.delta?.direction === 'up';
      const subPillBg = isUp ? '#174A35' : '#452A18';
      const subPillColor = isUp ? '#6EE7B7' : '#FCD34D';
      const sw = Math.min(CW - sideW - 28, this.measure(sub, 'sansBold', 6.6) + 14);
      this.rect(MX + 18, y + h - 18, sw, 12, subPillBg, undefined, 3);
      this.text(sub, MX + 25, y + h - 15.2, {
        role: 'sansBold',
        size: 6.6,
        color: subPillColor,
        maxW: sw - 14,
      });
    }
    const sx = MX + CW - sideW;
    this.doc
      .lineWidth(0.6)
      .strokeColor(C.forestSubtle)
      .moveTo(sx, y + 12)
      .lineTo(sx, y + h - 12)
      .stroke();
    this.text(b.sideLabel, sx + 16, y + 13, {
      role: 'sansBold',
      size: 6.8,
      color: C.white,
      cs: 1.1,
    });
    let ly = y + 28;
    for (const line of b.sideLines.slice(0, 3)) {
      for (const l of this.wrap(line, 'sans', 7.5, sideW - 26, 2)) {
        this.text(l, sx + 16, ly, { size: 7.5, color: '#D1FAE5' });
        ly += 10.5;
      }
    }
    this.y = y + h + GAP + 4;
  }

  private kpis(cards: KpiCard[]): void {
    const cols = 4;
    const gap = 8;
    const w = (CW - gap * (cols - 1)) / cols;
    const h = 70;
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
    this.card(x, y, w, h, C.cardBg);
    // Colored accent strip along the top of card
    let topIndicator = C.rule;
    if (c.delta) {
      topIndicator = c.delta.direction === 'up' ? C.emerald : c.delta.direction === 'down' ? C.amber : C.muted;
    } else if (c.state === 'value') {
      topIndicator = C.forest;
    }
    this.rect(x + 1, y + 1, w - 2, 2.5, topIndicator, undefined, 1);

    const iw = w - 16;
    const label = this.wrap(c.label.toUpperCase(), 'sansBold', 5.8, iw, 2);
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
        role: 'sansBold',
        size: 16.5,
        color: C.text,
        maxW: iw,
      });
      if (c.unitText) {
        const vw = this.measure(c.valueText, 'sansBold', 16.5);
        if (vw + 6 < iw)
          this.text(c.unitText, x + 8 + vw + 4, vy + 5, {
            role: 'sans',
            size: 7.8,
            color: C.muted,
            maxW: iw - vw - 6,
          });
      }
    } else {
      this.text(c.valueText, x + 8, vy + 3, {
        role: 'sansBold',
        size: 9.5,
        color: C.amber,
        maxW: iw,
      });
    }
    let sy = y + 50;
    if (c.delta) {
      const isUp = c.delta.direction === 'up';
      const isDown = c.delta.direction === 'down';
      const col = isUp ? '#065F46' : isDown ? '#92400E' : C.muted;
      const pillBg = isUp ? '#D1FAE5' : isDown ? '#FEF3C7' : '#F1F5F9';
      const deltaStr = `${c.delta.text} vs previous`;
      const dw = Math.min(iw, this.measure(deltaStr, 'sansBold', 5.8) + 8);
      this.rect(x + 8, sy - 1, dw, 11, pillBg, undefined, 3);
      this.text(deltaStr, x + 12, sy + 1.2, {
        role: 'sansBold',
        size: 5.8,
        color: col,
        maxW: dw - 8,
      });
      sy += 12;
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
    this.text(title, x + 12, y + 10, {
      role: 'sansBold',
      size: 8,
      color: C.text,
      maxW: w - 24 - (unit ? 60 : 0),
    });
    if (unit)
      this.text(unit, x + 12, y + 10, {
        size: 6.8,
        color: C.muted,
        align: 'right',
        width: w - 24,
      });
  }

  private chart(b: Extract<LayoutBlock, { type: 'line' | 'bar' }>): void {
    const h = 152 + (b.footnote ? 12 : 0);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h, C.cardBg);
    this.cardTitle(b.title, b.unitLabel ? `${b.unitLabel}` : '', x, y, CW);

    const px = x + 40;
    const pw = CW - 40 - 16;
    const py = y + 32;
    const ph = 150 - 32 - 24;
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
      // Subtle background gridlines
      for (let g = 0; g <= 2; g++) {
        const gv = lo + ((hi - lo) * g) / 2;
        const gy = yOf(gv);
        this.hline(px, px + pw, gy, '#EAECE8', 0.5);
        this.text(fmtTick(gv), x + 6, gy - 3, {
          size: 6,
          color: C.muted,
          align: 'right',
          width: 28,
        });
      }
      if (b.type === 'line') this.lineSeries(b.points, xOf, yOf, py + ph);
      else this.barSeries(b.points, px, pw, yOf, py + ph, py);
      // x labels
      const maxLabels = Math.min(n, 7);
      const used = new Set<number>();
      for (let k = 0; k < maxLabels; k++)
        used.add(
          maxLabels === 1 ? 0 : Math.round((k * (n - 1)) / (maxLabels - 1)),
        );
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
      this.text(b.footnote, x + 12, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 24,
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
        // Soft mint area fill
        d.moveTo(xOf(r[0].i), baseY);
        for (const p of r) d.lineTo(xOf(p.i), yOf(p.v));
        d.lineTo(xOf(r[r.length - 1].i), baseY)
          .closePath()
          .fillColor(C.emeraldLight)
          .fill();
        // Vibrant emerald line
        d.lineWidth(1.8).strokeColor(C.emerald).lineJoin('round');
        d.moveTo(xOf(r[0].i), yOf(r[0].v));
        for (const p of r.slice(1)) d.lineTo(xOf(p.i), yOf(p.v));
        d.stroke();
      }
      // Circular nodes: outer emerald, inner white core
      if (pts.length <= 40 || r.length === 1)
        for (const p of r) {
          d.circle(xOf(p.i), yOf(p.v), 2.2).fillColor(C.emerald).fill();
          d.circle(xOf(p.i), yOf(p.v), 1.0).fillColor(C.white).fill();
        }
    }
    pts.forEach((p, i) => {
      if (p.value === null) {
        d.lineWidth(1)
          .strokeColor(C.gold)
          .moveTo(xOf(i), baseY - 6)
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
    py: number,
  ): void {
    const n = pts.length;
    const slot = pw / n;
    const bw = Math.min(32, slot * 0.62);
    const zeroY = yOf(0);
    pts.forEach((p, i) => {
      const cx = px + (i + 0.5) * slot;
      if (p.value === null) {
        this.doc
          .lineWidth(1)
          .strokeColor(C.gold)
          .moveTo(cx, baseY - 6)
          .lineTo(cx, baseY)
          .stroke();
        return;
      }
      const end = yOf(p.value);
      const top = Math.min(end, zeroY);
      const barH = Math.max(0.5, Math.abs(end - zeroY));
      // Subtle background track
      this.rect(cx - bw / 2, py + 2, bw, baseY - py - 2, '#F1F5F9', undefined, 2);
      // Filled bar with rounded cap
      this.rect(
        cx - bw / 2,
        top,
        bw,
        barH,
        C.emerald,
        undefined,
        Math.min(3, bw / 3),
      );
      if (n <= 12) {
        const lw = Math.max(slot, 40);
        const size = this.shrinkSize(p.text, 'sans', 6, 4.4, lw);
        this.text(p.text, cx - lw / 2, p.value < 0 ? end + 2 : top - 8, {
          role: 'sansBold',
          size,
          color: C.text,
          align: 'center',
          width: lw,
          maxW: lw,
        });
      }
    });
  }

  private donut(b: Extract<LayoutBlock, { type: 'donut' }>): void {
    const legendRows = b.slices.length;
    const h = Math.max(128, 38 + legendRows * 13 + 10) + (b.footnote ? 12 : 0);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h, C.cardBg);
    this.cardTitle(b.title, '', x, y, CW);
    const cx = x + 72;
    const cy = y + 34 + 42;
    const R = 42;
    const r = 26;
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
    this.text(b.centerText, cx - r, cy - 6, {
      role: 'sansBold',
      size: 10,
      color: C.text,
      align: 'center',
      width: r * 2,
      maxW: r * 2,
    });
    if (b.centerCaption)
      this.text(b.centerCaption, cx - r, cy + 5, {
        role: 'sansBold',
        size: 5.6,
        color: C.muted,
        align: 'center',
        width: r * 2,
        maxW: r * 2,
      });
    let ly = y + 36;
    b.slices.forEach((s, i) => {
      this.rect(x + 150, ly + 1.5, 8, 8, PALETTE[i % PALETTE.length], undefined, 2);
      this.text(s.label, x + 164, ly, { role: 'sansBold', size: 7.5, color: C.text, maxW: 150 });
      this.text(s.text, x + 164, ly, {
        role: 'sansBold',
        size: 7.5,
        color: C.forestDark,
        align: 'right',
        width: CW - 164 - 14,
      });
      ly += 13;
    });
    if (b.footnote)
      this.text(b.footnote, x + 12, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 24,
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
    const rowH = 16;
    const head = 30;
    const n = Math.max(b.rows.length, b.table?.rows.length ?? 0, 1);
    const h = head + n * rowH + (b.footnote ? 16 : 8);
    this.ensure(h + GAP);
    const x = MX;
    const y = this.y;
    this.card(x, y, CW, h, C.cardBg);
    this.cardTitle(b.title, b.unitLabel, x, y, b.table ? CW * 0.46 : CW);
    const barW = b.table ? CW * 0.46 : CW;
    const max = Math.max(...b.rows.map((r) => r.value), 0);
    if (b.rows.length === 0) {
      this.text('Not recorded', x + 12, y + head + 4, {
        role: 'sansBold',
        size: 9,
        color: C.amber,
      });
    }
    b.rows.forEach((r, i) =>
      this.rankedRow(r, i, x + 12, y + head + i * rowH, barW - 22, max),
    );
    if (b.table) {
      const tx = x + CW * 0.46 + 6;
      this.vline(tx - 6, y + 8, y + h - 8, C.rule);
      const tw = CW - CW * 0.46 - 16;
      this.tableBody(b.table, tx, y + 10, tw, rowH, true, b.table.rows.length);
    }
    if (b.footnote)
      this.text(b.footnote, x + 12, y + h - 14, {
        size: 6.2,
        color: C.muted,
        maxW: CW - 24,
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
    const isTop3 = r.rank <= 3;
    const rankColor = isTop3 ? C.forestDark : C.muted;
    const rankBg = isTop3 ? (r.rank === 1 ? '#FEF3C7' : '#ECFDF5') : '#F1F5F9';
    this.rect(x, y + 1.5, 12, 11, rankBg, undefined, 2.5);
    this.text(String(r.rank).padStart(2, '0'), x, y + 3, {
      role: 'sansBold',
      size: 5.8,
      color: rankColor,
      align: 'center',
      width: 12,
    });
    const labelW = Math.min(88, w * 0.34);
    this.text(r.label, x + 16, y + 3.5, {
      role: isTop3 ? 'sansBold' : 'sans',
      size: this.shrinkSize(clean(r.label), 'sans', 7, 5, labelW),
      color: C.text,
      maxW: labelW,
    });
    const valueW = 62;
    const bx = x + 16 + labelW + 6;
    const bw = Math.max(20, w - (bx - x) - valueW - 4);
    const fill = max > 0 ? Math.max(1.5, (r.value / max) * bw) : 0;
    this.rect(bx, y + 4, bw, 6.5, '#F1F5F9', undefined, 3);
    if (fill > 0) {
      const barCol = isTop3 ? C.emerald : '#10B981';
      this.rect(bx, y + 4, fill, 6.5, barCol, undefined, 3);
    }
    this.text(r.text, bx + bw + 4, y + 3.5, {
      role: 'sansBold',
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
      C.forest,
      undefined,
      3,
    );
    let cx = x;
    cols.forEach((c, i) => {
      const lines = this.wrap(c.label, 'sansBold', 6, widths[i] - 8, 2);
      lines.forEach((l, li) =>
        this.text(l, cx + 4, y + (lines.length === 1 ? 7 : 3) + li * 7.5, {
          role: 'sansBold',
          size: 6,
          color: C.white,
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
        '#F8FAF8',
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
        this.hline(MX, MX + CW, this.y + rowH, C.rule, 0.5);
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
    const lh = 12;
    const h = 30 + b.items.length * lh + 6;
    this.ensure(Math.min(h, 120) + GAP);
    let y = this.y;
    let drawn = 0;
    while (drawn < b.items.length) {
      const room = Math.max(1, Math.floor((BOTTOM - y - 36) / lh));
      const part = b.items.slice(drawn, drawn + room);
      const ph = 30 + part.length * lh + 6;
      this.doc.lineWidth(0.8);
      this.rect(MX, y, CW, ph, '#FFFBEB', '#FCD34D', 6);
      this.rect(MX, y, 3.5, ph, C.amber, undefined, 2);
      this.text(b.title.toUpperCase(), MX + 14, y + 9, {
        role: 'sansBold',
        size: 6.8,
        color: '#B45309',
        cs: 1,
      });
      part.forEach((it, i) => {
        this.rect(MX + 14, y + 26 + i * lh, 3, 3, C.amber, undefined, 1.5);
        this.text(it.text, MX + 22, y + 24 + i * lh, {
          size: 7.5,
          color: C.text,
          maxW: CW - 140,
        });
        if (it.detail)
          this.text(it.detail, MX, y + 24 + i * lh, {
            role: 'sansBold',
            size: 7.5,
            color: '#B45309',
            align: 'right',
            width: CW - 14,
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
    this.rect(MX, y, CW, h, C.restricted, C.rule, 4);
    this.rect(MX, y, 3.5, h, C.emerald, undefined, 2);
    this.text(b.title, MX + 14, y + 9, {
      role: 'sansBold',
      size: 6.8,
      color: C.forestDark,
      cs: 1,
    });
    lines.forEach((l, i) =>
      this.text(l, MX + 14, y + 22 + i * 10, { size: 7.5, color: C.muted }),
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
    const h = 28 + lineCount * 9.5 + items.length * 2 + 8;
    this.ensure(h + GAP);
    const y = this.y;
    this.doc.lineWidth(0.8);
    this.rect(MX, y, CW, h, '#F8FAFC', '#E2E8F0', 6);
    this.rect(MX, y, 3.5, h, '#0284C7', undefined, 2);
    this.text(b.title.toUpperCase(), MX + 14, y + 9, {
      role: 'sansBold',
      size: 6.8,
      color: '#0369A1',
      cs: 1,
    });
    let ly = y + 24;
    items.forEach((lines, idx) => {
      lines.forEach((l) => {
        this.text(l, MX + 14, ly, {
          role: idx === 0 && b.coverage ? 'sansBold' : 'sans',
          size: idx === 0 && b.coverage ? 7.6 : 7.2,
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
