export type DerivedHealthStatus = 'HEALTHY' | 'SICK' | 'IN_TREATMENT';
export interface OpenHealthCaseInput {
    status: string;
    careType: string;
}
export declare function deriveHealthStatus(openCases: OpenHealthCaseInput[]): DerivedHealthStatus;
