"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_SCHEDULER_PROVIDERS = exports.REPORT_SCHEDULER_IMPORTS = void 0;
const report_retention_service_1 = require("../../application/scheduling/report-retention.service");
const report_schedule_service_1 = require("../../application/scheduling/report-schedule.service");
const report_job_lock_1 = require("./report-job-lock");
const report_scheduler_cron_1 = require("./report-scheduler.cron");
__exportStar(require("./report-job-lock"), exports);
__exportStar(require("./report-scheduler.cron"), exports);
exports.REPORT_SCHEDULER_IMPORTS = [];
exports.REPORT_SCHEDULER_PROVIDERS = [
    report_schedule_service_1.ReportScheduleService,
    report_retention_service_1.ReportRetentionService,
    report_job_lock_1.PgAdvisoryJobLock,
    { provide: report_job_lock_1.REPORT_JOB_LOCK, useExisting: report_job_lock_1.PgAdvisoryJobLock },
    report_scheduler_cron_1.ReportSchedulerCron,
];
//# sourceMappingURL=index.js.map