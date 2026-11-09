import { BreedingStatus } from '@prisma/client';
export interface BreedingStatusFacts {
    hasCalving: boolean;
    hasAbortion: boolean;
    hasActivePregnancy: boolean;
    hasFailedDiagnosis: boolean;
    hasReturnedToHeat: boolean;
}
export declare function deriveBreedingStatus(facts: BreedingStatusFacts): BreedingStatus;
