import PDFDocument from 'pdfkit';
import { Cell, ReportData } from './report-data';

/**
 * Render a {@link ReportData} to a simple tabular PDF (pdfkit), returning the
 * full document as a Buffer. Mirrors the email module's PdfGeneratorService
 * pattern (collect `data` chunks → `Buffer.concat`). Generic over any report:
 * title, period, summary block, then a paginated table.
 */

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 18;
const HEADER_FONT = 9;
const CELL_FONT = 8;

function cellText(value: Cell): string {
  return value === null || value === undefined ? '' : String(value);
}

export function renderPdf(report: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      layout: 'landscape',
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
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

    if (report.summary?.length) {
      doc.fontSize(10).font('Helvetica');
      for (const item of report.summary) {
        doc.text(`${item.label}: ${String(item.value)}`);
      }
      doc.moveDown(0.5);
    }

    const colCount = report.columns.length || 1;
    const colWidth = pageWidth / colCount;

    const drawRow = (cells: Cell[], bold: boolean) => {
      if (doc.y + ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
      }
      const y = doc.y;
      doc
        .fontSize(bold ? HEADER_FONT : CELL_FONT)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica');
      report.columns.forEach((_, i) => {
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

    drawRow(report.columns, true);
    if (report.rows.length === 0) {
      doc
        .moveDown(0.5)
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#777')
        .text('No data for the selected period.');
    } else {
      for (const row of report.rows) {
        drawRow(row, false);
      }
    }

    doc.end();
  });
}
