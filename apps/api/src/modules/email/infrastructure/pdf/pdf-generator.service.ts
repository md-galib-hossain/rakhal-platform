import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
@Injectable()
export class PdfGeneratorService {
  async generateReportPdf(input: {
    title: string;
    lines: string[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(input.title);
      doc.moveDown();
      for (const line of input.lines) {
        doc.fontSize(11).text(line);
      }
      doc.end();
    });
  }
}
