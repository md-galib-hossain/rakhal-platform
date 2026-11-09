export type RoundKeyParts = {
    type: 'APPLICATION';
    applicationId: string;
} | {
    type: 'TREATMENT';
    planId: string;
    day: string;
};
export declare const applicationRoundKey: (applicationId: string) => string;
export declare const treatmentRoundKey: (planId: string, day: string) => string;
export declare function parseRoundKey(key: string): RoundKeyParts | null;
export type CellState = 'done' | 'skipped' | 'inactive' | 'overdue' | 'today' | 'upcoming';
export interface RoundTaskFact {
    id: string;
    runKey: string;
    stepNumber: number | null;
    title: string;
    status: string;
    dueDateTime: Date;
    completedAt: Date | null;
    live: boolean;
}
export declare function cellState(task: Pick<RoundTaskFact, 'status' | 'dueDateTime' | 'live'>, timezone: string, now: Date): {
    state: CellState;
    days: number;
};
export declare const isDueState: (state: CellState) => boolean;
export interface RoundSummary {
    stepsTotal: number;
    stepsDone: number;
    stepsSkipped: number;
    stepsOverdue: number;
    stepsDueToday: number;
    nextDueDate: string | null;
    status: 'RUNNING' | 'FINISHED';
}
export declare function summarizeRound(tasks: RoundTaskFact[], timezone: string, now: Date, dayOf: (due: Date) => string): RoundSummary;
export interface GridStepFact {
    dayNumber: number;
    title: string;
}
export interface GridRunFact {
    runKey: string;
    runType: 'CASE' | 'ENROLLMENT';
    healthCaseId: string | null;
    planEnrollmentId: string | null;
    caseCode: string | null;
    cattle: {
        id: string;
        name: string | null;
        tagNumber: string;
    };
}
export interface GridColumn {
    key: string;
    stepNumber: number | null;
    dayNumber: number | null;
    title: string;
}
export interface GridCell {
    taskId: string;
    state: CellState;
    days: number;
    title: string;
    status: string;
    stepNumber: number | null;
    dueDate: Date;
    doneAt: Date | null;
}
export interface GridRow extends GridRunFact {
    cells: Record<string, GridCell>;
    dueCount: number;
    overdueCount: number;
}
export declare function buildRoundGrid(runs: GridRunFact[], tasks: RoundTaskFact[], steps: GridStepFact[], timezone: string, now: Date): {
    columns: GridColumn[];
    rows: GridRow[];
};
