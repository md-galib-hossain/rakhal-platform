import { ScheduleQueuePort } from './schedule-queue.port';
export declare class InMemoryScheduleQueue implements ScheduleQueuePort {
    private readonly clock;
    private readonly jobs;
    constructor(clock?: () => Date);
    add(occurrenceId: string, delayMs: number): Promise<void>;
    remove(occurrenceId: string): Promise<void>;
    liveJobIds(): Promise<string[]>;
    has(occurrenceId: string): boolean;
    get size(): number;
    flush(): void;
    dueIds(now: Date): string[];
    runDue(now: Date, handler: (occurrenceId: string) => Promise<void>): Promise<string[]>;
}
