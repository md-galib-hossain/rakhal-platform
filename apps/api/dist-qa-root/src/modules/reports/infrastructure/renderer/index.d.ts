import type { Provider } from '@nestjs/common';
export { PdfReportRenderer } from './pdf-report-renderer';
export { buildReportLayout } from './report-layout';
export type { ReportLayout, LayoutBlock } from './report-layout';
export { NullReportRenderer } from './null-report-renderer';
export declare const REPORT_RENDERER_PROVIDERS: Provider[];
