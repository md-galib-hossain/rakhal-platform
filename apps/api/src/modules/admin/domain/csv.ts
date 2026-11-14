/**
 * Minimal, safe CSV writer for admin exports (Phase 6).
 *
 * Two hazards are handled here so no caller can forget them:
 *  - **CSV structure**: fields with commas, quotes or newlines are quoted and quotes doubled (RFC 4180).
 *  - **Formula injection**: a cell that starts with `= + - @` (or a tab / carriage return) is executed as a
 *    formula by Excel and Sheets. Exports hold user-controlled text (farm names, emails), so such cells are
 *    prefixed with `'` to force them to plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'string') text = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    text = String(value);
  else text = JSON.stringify(value) ?? '';
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  // CRLF per RFC 4180; trailing newline so the last row is terminated.
  return lines.join('\r\n') + '\r\n';
}
