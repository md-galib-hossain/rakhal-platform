export declare const SCHEDULE_CATCH_UP_PERIODS = 2;
export declare const SCHEDULE_FARM_BATCH = 100;
export declare const RETENTION_SOFT_DELETE_GRACE_DAYS = 7;
export declare const RETENTION_FAILED_AGE_DAYS = 30;
export declare const SCHEDULE_TOMBSTONE_DAYS = 70;
export declare const RETENTION_BATCH = 200;
export declare const RETENTION_MAX_BATCHES = 5;
export declare const DAY_MS: number;
export declare const HOUR_MS: number;
export declare const REPORT_CRON: {
    readonly SCHEDULE_SWEEP: "reports-schedule-sweep";
    readonly RECONCILE: "reports-reconcile";
    readonly RETENTION: "reports-retention-cleanup";
};
