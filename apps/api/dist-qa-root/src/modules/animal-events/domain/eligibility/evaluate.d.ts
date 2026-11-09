import { ChipEligibility, EventTypeDefinition } from '../catalogue';
import { AnimalFacts, CategoryContext } from './categories';
export interface Finding {
    code: string;
    severity: 'BLOCK' | 'WARN';
}
export interface EligibilityResult {
    type: string;
    eligible: boolean;
    level: ChipEligibility;
    findings: Finding[];
}
export interface EvaluateInput {
    facts: AnimalFacts;
    ctx: CategoryContext;
    date?: Date;
    leftHerd?: boolean;
}
export declare function evaluateEligibility(def: EventTypeDefinition, input: EvaluateInput): EligibilityResult;
