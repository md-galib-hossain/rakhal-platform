export declare const SCHEDULE_QUEUE_PORT: unique symbol;
export declare const NOTIFICATION_OCCURRENCE_QUEUE = "notification-occurrence";
export declare const NOTIFICATION_FIRE_JOB = "fire";
export declare const ENQUEUE_HORIZON_MS: number;
export interface ScheduleQueuePort {
    add(occurrenceId: string, delayMs: number): Promise<void>;
    remove(occurrenceId: string): Promise<void>;
    liveJobIds(): Promise<string[]>;
}
