import { ReportError } from '../../domain/report-error';
export type PipelinePhase = 'compute' | 'render' | 'storage' | 'persist';
export declare function toReportError(err: unknown, phase: PipelinePhase): ReportError;
