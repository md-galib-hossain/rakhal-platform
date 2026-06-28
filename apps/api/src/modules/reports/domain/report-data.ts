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

export interface ReportData {
  /** Human title, e.g. "Daily Milk Production — 2026-06-24". */
  title: string;
  /** Optional period label shown under the title (e.g. "2026-06" or a range). */
  period?: string;
  /** Headline figures rendered above the table. */
  summary?: ReportSummaryItem[];
  /** Table header. */
  columns: string[];
  /** Table body; each row aligns to `columns`. */
  rows: Cell[][];
}
