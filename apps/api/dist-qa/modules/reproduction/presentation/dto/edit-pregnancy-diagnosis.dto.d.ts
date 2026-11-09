import { PregnancyDiagnosisMethod, PregnancyDiagnosisResult } from '@prisma/client';
export declare class EditPregnancyDiagnosisDto {
    cattleId?: string;
    breedingEventId?: string;
    diagnosisDate?: string;
    result?: PregnancyDiagnosisResult;
    diagnosisMethod?: PregnancyDiagnosisMethod;
    gestationDay?: number;
    expectedCalvingDate?: string;
    notes?: string;
}
