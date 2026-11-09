export type PlanKind = 'TREATMENT' | 'PREVENTION' | 'BREEDING';
export declare function planKind(category: string): PlanKind;
export interface PlanCaseFact {
    cattleId: string;
    status: string;
}
export interface PlanEnrollmentFact {
    cattleId: string;
    status: string;
}
export interface PlanSchedule {
    stepsDue: number;
    stepsOverdue: number;
    nextDueDate: string | null;
}
export declare const NO_SCHEDULE: PlanSchedule;
export declare function countStepsByFarmDay(dueTimes: Date[], timezone: string, now?: Date): Pick<PlanSchedule, 'stepsDue' | 'stepsOverdue'>;
export interface PlanStats extends PlanSchedule {
    kind: PlanKind;
    appliedTo: number;
    inProgress: number;
    recovered: number | null;
    mortality: number | null;
    recoveryRate: number | null;
    completed: number | null;
    due: number | null;
    coverageRate: number | null;
}
export declare function computePlanStats(category: string, cases: PlanCaseFact[], enrollments: PlanEnrollmentFact[], dueSteps: number, schedule?: PlanSchedule): PlanStats;
