export type AnimalEventKind = 'HEALTH_STEP' | 'PREVENTIVE_STEP' | 'PREGNANCY_CHECK' | 'CALVING' | 'DRY_OFF' | 'TASK' | 'WITHDRAWAL_END' | 'WEANING';
export type AnimalEventUrgency = 'OVERDUE' | 'DUE_SOON' | 'LATER';
export declare const DUE_FILTERS: readonly ["overdue", "today", "week"];
export type DueFilter = (typeof DUE_FILTERS)[number];
export declare const DUE_WEEK_DAYS = 7;
export declare const DUE_SOON_DAYS = 3;
export declare const DEFAULT_WINDOW_DAYS = 14;
export declare const DEFAULT_EVENT_LIMIT = 10;
export interface UpcomingEventCandidate {
    kind: AnimalEventKind;
    labelKey: string;
    labelParams?: Record<string, string | number>;
    dueAt: Date;
    actionable: boolean;
    ref: {
        type: string;
        id: string;
    };
    sourceKey?: string;
    coversSourceKeys?: string[];
}
export interface AnimalUpcomingEvent {
    kind: AnimalEventKind;
    labelKey: string;
    labelParams?: Record<string, string | number>;
    dueAt: string;
    daysUntil: number;
    urgency: AnimalEventUrgency;
    actionable: boolean;
    ref: {
        type: string;
        id: string;
    };
}
export interface BuildUpcomingEventsOptions {
    now: Date;
    timezone: string;
    windowDays?: number;
}
export declare function farmDaysUntil(due: Date, timezone: string, now: Date): number;
export declare function urgencyForDaysUntil(daysUntil: number): AnimalEventUrgency;
export declare function buildAnimalUpcomingEvents(candidates: UpcomingEventCandidate[], options: BuildUpcomingEventsOptions): AnimalUpcomingEvent[];
