/**
 * The shape every report generator returns (PRD §22). A renderer-agnostic
 * tabular model: a title, an optional period label, a headline summary block,
 * and a columns/rows table. The CSV and PDF renderers consume this directly.
 */

export type Cell = string | number | null;

export interface ReportSummaryItem {
  label: string;
  value: string | number;
}

/** One named block of a multi-section report (e.g. "Cattle", "Milk"). */
export interface ReportSection {
  heading: string;
  summary?: ReportSummaryItem[];
  columns: string[];
  rows: Cell[][];
}

export interface ReportData {
  /** Human title, e.g. "Daily Milk Production — 2026-06-24". */
  title: string;
  /** Optional period label shown under the title (e.g. "2026-06" or a range). */
  period?: string;
  /** Headline figures rendered above the table. Ignored when `sections` is set. */
  summary?: ReportSummaryItem[];
  /** Table header. Ignored when `sections` is set. */
  columns: string[];
  /** Table body; each row aligns to `columns`. Ignored when `sections` is set. */
  rows: Cell[][];
  /**
   * Multi-section reports (e.g. Monthly Farm Report) set this instead of the
   * top-level columns/rows/summary — renderers treat it as authoritative when
   * present. Optional and additive: the 13 single-topic reports never set it.
   */
  sections?: ReportSection[];
}
