import { SchedulerRegistry } from '@nestjs/schedule';
export declare class AdminSystemController {
    private readonly registry;
    constructor(registry: SchedulerRegistry);
    list(): {
        crons: {
            name: string;
            running: boolean;
            next_run: string | null;
            last_run: string | null;
        }[];
    };
}
