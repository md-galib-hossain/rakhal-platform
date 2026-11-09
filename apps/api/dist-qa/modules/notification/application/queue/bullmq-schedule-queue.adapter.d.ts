import { Queue } from 'bullmq';
import { ScheduleQueuePort } from './schedule-queue.port';
export declare class BullmqScheduleQueue implements ScheduleQueuePort {
    private readonly queue;
    constructor(queue: Queue);
    add(occurrenceId: string, delayMs: number): Promise<void>;
    remove(occurrenceId: string): Promise<void>;
    liveJobIds(): Promise<string[]>;
}
