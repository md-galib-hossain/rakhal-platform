export type HealthReminderStage = 'T_MINUS_7' | 'T_MINUS_3' | 'T_MINUS_1' | 'DAY_OF';
export declare const HEALTH_REMINDER_CADENCE: {
    stage: HealthReminderStage;
    daysUntil: number;
}[];
export declare const OVERDUE_MAX_DAYS = 30;
export declare const STAGE_EVENT_KEY: Record<HealthReminderStage, string>;
export declare const OVERDUE_EVENT_KEY = "health_task_overdue";
export declare function farmDaysUntil(due: Date, timezone: string, now?: Date): number;
export declare function stageForDaysUntil(daysUntil: number): HealthReminderStage | null;
export type ReminderDecision = {
    kind: 'stage';
    stage: HealthReminderStage;
    daysUntil: number;
} | {
    kind: 'overdue';
    daysOverdue: number;
};
export declare function reminderFor(daysUntil: number): ReminderDecision | null;
