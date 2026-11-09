"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvCell = csvCell;
exports.toCsv = toCsv;
const FORMULA_START = /^[=+\-@\t\r]/;
function csvCell(value) {
    if (value === null || value === undefined)
        return '';
    let text;
    if (value instanceof Date)
        text = value.toISOString();
    else if (typeof value === 'string')
        text = value;
    else if (typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint')
        text = String(value);
    else
        text = JSON.stringify(value) ?? '';
    if (FORMULA_START.test(text))
        text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function toCsv(headers, rows) {
    const lines = [headers.map(csvCell).join(',')];
    for (const row of rows)
        lines.push(row.map(csvCell).join(','));
    return lines.join('\r\n') + '\r\n';
}
//# sourceMappingURL=csv.js.map