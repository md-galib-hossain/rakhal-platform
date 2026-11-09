"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderReceiptPdf = renderReceiptPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const PAGE_MARGIN = 40;
const ROW_HEIGHT = 18;
const HEADER_FONT = 9;
const CELL_FONT = 8;
function cellText(value) {
    return value === null || value === undefined ? '' : String(value);
}
function renderSectionBody(doc, pageWidth, section) {
    if (section.summary?.length) {
        doc.fontSize(10).font('Helvetica');
        for (const item of section.summary) {
            doc.text(`${item.label}: ${String(item.value)}`);
        }
        doc.moveDown(0.5);
    }
    const colCount = section.columns.length || 1;
    const colWidth = pageWidth / colCount;
    const drawRow = (cells, bold) => {
        if (doc.y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
            doc.addPage();
        }
        const y = doc.y;
        doc
            .fontSize(bold ? HEADER_FONT : CELL_FONT)
            .font(bold ? 'Helvetica-Bold' : 'Helvetica');
        section.columns.forEach((_, i) => {
            const x = PAGE_MARGIN + i * colWidth;
            doc.text(cellText(cells[i]), x + 2, y + 4, {
                width: colWidth - 4,
                height: ROW_HEIGHT,
                ellipsis: true,
                lineBreak: false,
            });
        });
        doc
            .moveTo(PAGE_MARGIN, y + ROW_HEIGHT)
            .lineTo(PAGE_MARGIN + pageWidth, y + ROW_HEIGHT)
            .strokeColor('#ddd')
            .stroke();
        doc.y = y + ROW_HEIGHT;
        doc.x = PAGE_MARGIN;
    };
    drawRow(section.columns, true);
    if (section.rows.length === 0) {
        doc
            .moveDown(0.5)
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#777')
            .text('No data.');
        doc.fillColor('black');
    }
    else {
        for (const row of section.rows) {
            drawRow(row, false);
        }
    }
}
function renderReceiptPdf(report) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'A4',
            margin: PAGE_MARGIN,
            layout: 'landscape',
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        const pageWidth = doc.page.width - PAGE_MARGIN * 2;
        doc.fontSize(16).font('Helvetica-Bold').text(report.title);
        if (report.period) {
            doc.moveDown(0.2);
            doc.fontSize(10).font('Helvetica').fillColor('#555').text(report.period);
            doc.fillColor('black');
        }
        doc.moveDown(0.5);
        if (report.sections?.length) {
            report.sections.forEach((section, i) => {
                if (i > 0)
                    doc.addPage();
                doc.fontSize(13).font('Helvetica-Bold').text(section.heading);
                doc.moveDown(0.3);
                renderSectionBody(doc, pageWidth, section);
            });
        }
        else {
            if (report.summary?.length) {
                doc.fontSize(10).font('Helvetica');
                for (const item of report.summary) {
                    doc.text(`${item.label}: ${String(item.value)}`);
                }
                doc.moveDown(0.5);
            }
            renderSectionBody(doc, pageWidth, {
                columns: report.columns,
                rows: report.rows,
            });
        }
        doc.end();
    });
}
//# sourceMappingURL=receipt-pdf-renderer.js.map