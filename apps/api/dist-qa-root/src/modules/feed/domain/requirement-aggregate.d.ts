import type { Requirements } from './requirements';
export interface AggregatedRequirements {
    total: Requirements;
    mean: Requirements;
    caPHeadcount: number;
}
export declare function aggregateRequirements(reqs: Requirements[]): AggregatedRequirements;
