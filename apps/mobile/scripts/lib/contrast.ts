/** WCAG 2.x contrast math + known-gap reconciliation. Pure functions, no dependencies, no colour literals. */

export type Rgb = readonly [number, number, number];

/** text = WCAG 1.4.3 (4.5:1). ui = non-text contrast, WCAG 1.4.11 (3:1). decorative = not checked, needs a reason. */
export type PairKind = 'text' | 'ui' | 'decorative';

export const THRESHOLD_TEXT = 4.5;
export const THRESHOLD_UI = 3;

export function thresholdFor(kind: Exclude<PairKind, 'decorative'>): number {
  return kind === 'text' ? THRESHOLD_TEXT : THRESHOLD_UI;
}

/** Parse #rgb or #rrggbb. Alpha digits are rejected here: use resolveOpaque for translucent colours. */
export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new Error(`Unsupported colour for contrast (need an opaque 3 or 6 digit hex, no alpha): "${hex}"`);
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Opaque equivalent of `fg` drawn over the opaque `bg`. A 6-digit (opaque) fg is returned unchanged;
 * an 8-digit fg is alpha-composited over bg (sRGB space, as browsers and RN do).
 */
export function resolveOpaque(fg: string, bg: string): string {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(fg.trim());
  if (!m) return fg;
  const a = parseInt(m[2]!, 16) / 255;
  const f = hexToRgb('#' + m[1]!);
  const b = hexToRgb(bg);
  return toHex([f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)]);
}

/**
 * Opaque colour of `fg` drawn over the opaque `bg` at a real-valued `alpha` (0..1), composited in sRGB space like RN does.
 * Used to measure pressed overlays (e.g. 12% foreground over a button fill). Both colours must be opaque hex.
 */
export function blend(fg: string, bg: string, alpha: number): string {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`blend alpha must be within 0..1, got ${alpha}`);
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return toHex([f[0] * alpha + b[0] * (1 - alpha), f[1] * alpha + b[1] * (1 - alpha), f[2] * alpha + b[2] * (1 - alpha)]);
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface PairSpec {
  fg: string;
  bg: string;
  kind: PairKind;
  note: string;
  /** Required for decorative pairs: why no contrast is needed. */
  reason?: string;
}

export interface PairResult {
  theme: string;
  fg: string;
  bg: string;
  fgHex: string;
  bgHex: string;
  kind: Exclude<PairKind, 'decorative'>;
  note: string;
  ratio: number;
  threshold: number;
  pass: boolean;
}

/** Evaluate text and ui pairs in every theme. Decorative pairs are skipped (list them with decorativePairs). */
export function evaluatePairs(themes: Record<string, Record<string, string>>, pairs: readonly PairSpec[]): PairResult[] {
  const out: PairResult[] = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const p of pairs) {
      if (p.kind === 'decorative') continue;
      const fgHex = tokens[p.fg];
      const bgHex = tokens[p.bg];
      if (!fgHex || !bgHex) throw new Error(`Unknown token in pair ${p.fg}/${p.bg} (theme ${theme})`);
      const ratio = contrastRatio(resolveOpaque(fgHex, bgHex), bgHex);
      const threshold = thresholdFor(p.kind);
      out.push({ theme, fg: p.fg, bg: p.bg, fgHex, bgHex, kind: p.kind, note: p.note, ratio, threshold, pass: ratio >= threshold });
    }
  }
  return out;
}

export function decorativePairs(pairs: readonly PairSpec[]): PairSpec[] {
  return pairs.filter((p) => p.kind === 'decorative');
}

/** A pair that fails today and is recorded for an owner decision (src/theme/known-gaps.ts). */
export interface KnownGap {
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
  threshold: number;
  note: string;
}

export interface GapReconciled {
  /** Failing pairs matched by an exact registry entry (same theme/fg/bg, ratio to 2 dp, threshold). */
  known: PairResult[];
  /** Failing pairs with no registry entry. Must be empty. */
  unlisted: PairResult[];
  /** Failing pairs whose registry entry has a different ratio or threshold (a colour or kind changed). Must be empty. */
  changed: { result: PairResult; entry: KnownGap }[];
  /** Registry entries with no failing pair (fixed, removed, or typo). Must be empty. */
  stale: KnownGap[];
}

export function reconcileGaps(results: readonly PairResult[], registry: readonly KnownGap[]): GapReconciled {
  const out: GapReconciled = { known: [], unlisted: [], changed: [], stale: [] };
  const used = new Set<KnownGap>();
  for (const r of results.filter((x) => !x.pass)) {
    const entry = registry.find((e) => e.theme === r.theme && e.fg === r.fg && e.bg === r.bg);
    if (!entry) out.unlisted.push(r);
    else {
      used.add(entry);
      if (entry.ratio.toFixed(2) === r.ratio.toFixed(2) && entry.threshold === r.threshold) out.known.push(r);
      else out.changed.push({ result: r, entry });
    }
  }
  out.stale = registry.filter((e) => !used.has(e));
  return out;
}
