import { EventTypeDefinition } from './catalogue';
import { EligibilityResult } from './eligibility/evaluate';
export interface EventFinding {
    code: string;
    severity: 'BLOCK' | 'WARN';
}
export interface FindingFacts {
    categories: string[];
    hasPendingBreeding: boolean;
    breedingGiven: boolean;
}
export declare function buildFindings(def: EventTypeDefinition, eligibility: EligibilityResult, facts: FindingFacts): EventFinding[];
