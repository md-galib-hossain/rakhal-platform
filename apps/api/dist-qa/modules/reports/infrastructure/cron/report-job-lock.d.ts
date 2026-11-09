import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare const REPORT_JOB_LOCK: unique symbol;
export type LockedRun<T> = {
    acquired: true;
    value: T;
} | {
    acquired: false;
};
export interface ReportJobLock {
    runExclusive<T>(jobName: string, fn: () => Promise<T>): Promise<LockedRun<T>>;
}
export declare class PgAdvisoryJobLock implements ReportJobLock {
    private readonly prisma;
    constructor(prisma: PrismaService);
    runExclusive<T>(jobName: string, fn: () => Promise<T>): Promise<LockedRun<T>>;
}
