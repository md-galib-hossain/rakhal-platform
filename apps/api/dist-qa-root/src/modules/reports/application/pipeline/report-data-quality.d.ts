import type { DataQuality } from '../../domain/contracts/data-quality';
export declare const emptyDataQuality: () => DataQuality;
export declare function mergeDataQuality(parts: readonly DataQuality[]): DataQuality;
