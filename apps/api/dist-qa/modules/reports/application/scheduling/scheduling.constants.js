"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_CRON = exports.HOUR_MS = exports.DAY_MS = exports.RETENTION_MAX_BATCHES = exports.RETENTION_BATCH = exports.SCHEDULE_TOMBSTONE_DAYS = exports.RETENTION_FAILED_AGE_DAYS = exports.RETENTION_SOFT_DELETE_GRACE_DAYS = exports.SCHEDULE_FARM_BATCH = exports.SCHEDULE_CATCH_UP_PERIODS = void 0;
exports.SCHEDULE_CATCH_UP_PERIODS = 2;
exports.SCHEDULE_FARM_BATCH = 100;
exports.RETENTION_SOFT_DELETE_GRACE_DAYS = 7;
exports.RETENTION_FAILED_AGE_DAYS = 30;
exports.SCHEDULE_TOMBSTONE_DAYS = 70;
exports.RETENTION_BATCH = 200;
exports.RETENTION_MAX_BATCHES = 5;
exports.DAY_MS = 24 * 60 * 60 * 1000;
exports.HOUR_MS = 60 * 60 * 1000;
exports.REPORT_CRON = {
    SCHEDULE_SWEEP: 'reports-schedule-sweep',
    RECONCILE: 'reports-reconcile',
    RETENTION: 'reports-retention-cleanup',
};
//# sourceMappingURL=scheduling.constants.js.map