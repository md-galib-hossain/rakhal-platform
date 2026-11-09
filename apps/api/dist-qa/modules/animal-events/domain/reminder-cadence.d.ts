export type ReminderStage = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';
export declare const FOLLOW_UP_LEAD_DAYS = 1;
export declare const REMINDER_OVERDUE_MAX_DAYS = 30;
export declare const STAGE_EVENT_KEY: Record<ReminderStage, string>;
export type ReminderDecision = {
    stage: 'UPCOMING';
    daysUntil: number;
} | {
    stage: 'DUE_TODAY';
    daysUntil: 0;
} | {
    stage: 'OVERDUE';
    daysOverdue: number;
};
export declare function decideReminder(daysUntil: number, leadDays: number | null): ReminderDecision | null;
export declare function nextOccurrence(from: Date, type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS', intervalDays?: number | null): Date;
