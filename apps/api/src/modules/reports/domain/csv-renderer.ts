import { Cell, ReportData } from './report-data';

/**
 * Render a {@link ReportData} to CSV (RFC 4180). Pure — no framework/Prisma.
 * Emits the title + optional period + summary lines as leading comment-ish rows,
 * then the table. Fields are quoted when they contain a comma, quote, or newline.
 */

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function renderCsv(report: ReportData): Buffer {
  const lines: string[] = [];

  lines.push(escapeCell(report.title));
  if (report.period) {
    lines.push(escapeCell(`Period: ${report.period}`));
  }

  if (report.sections?.length) {
    lines.push('');
    for (const section of report.sections) {
      lines.push(escapeCell(`=== ${section.heading} ===`));
      for (const item of section.summary ?? []) {
        lines.push([escapeCell(item.label), escapeCell(item.value)].join(','));
      }
      lines.push(section.columns.map(escapeCell).join(','));
      for (const row of section.rows) {
        lines.push(row.map(escapeCell).join(','));
      }
      lines.push('');
    }
    return Buffer.from(lines.join('\r\n'), 'utf-8');
  }

  for (const item of report.summary ?? []) {
    lines.push([escapeCell(item.label), escapeCell(item.value)].join(','));
  }
  if (report.summary?.length || report.period) {
    lines.push('');
  }

  lines.push(report.columns.map(escapeCell).join(','));
  for (const row of report.rows) {
    lines.push(row.map(escapeCell).join(','));
  }

  return Buffer.from(lines.join('\r\n'), 'utf-8');
}
