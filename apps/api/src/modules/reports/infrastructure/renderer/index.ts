import type { Provider } from '@nestjs/common';
import { REPORT_RENDERER } from '../../application/ports/report-ports';
import { PdfReportRenderer } from './pdf-report-renderer';

export { PdfReportRenderer } from './pdf-report-renderer';
export { buildReportLayout } from './report-layout';
export type { ReportLayout, LayoutBlock } from './report-layout';
export { NullReportRenderer } from './null-report-renderer';

/** Binds REPORT_RENDERER to the pdfkit renderer. The orchestrator spreads this into the pipeline providers. */
export const REPORT_RENDERER_PROVIDERS: Provider[] = [
  { provide: REPORT_RENDERER, useClass: PdfReportRenderer },
];
