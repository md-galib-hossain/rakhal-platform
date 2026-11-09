"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReportSchedulerCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportSchedulerCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const report_reconcile_service_1 = require("../../application/pipeline/report-reconcile.service");
const scheduling_constants_1 = require("../../application/scheduling/scheduling.constants");
const report_retention_service_1 = require("../../application/scheduling/report-retention.service");
const report_schedule_service_1 = require("../../application/scheduling/report-schedule.service");
const report_job_lock_1 = require("./report-job-lock");
let ReportSchedulerCron = ReportSchedulerCron_1 = class ReportSchedulerCron {
    schedule;
    reconcileService;
    retention;
    lock;
    log;
    constructor(schedule, reconcileService, retention, lock, logger) {
        this.schedule = schedule;
        this.reconcileService = reconcileService;
        this.retention = retention;
        this.lock = lock;
        this.log = logger.setContext(ReportSchedulerCron_1.name);
    }
    onModuleInit() {
        if (process.env.NODE_ENV === 'test' && !process.env.JEST_WORKER_ID) {
            this.log.warn('Report crons are DISABLED: NODE_ENV=test (scheduled sweep, reconcile and retention will not run)', {});
        }
    }
    async scheduleSweep() {
        if (process.env.NODE_ENV === 'test')
            return;
        await this.run(scheduling_constants_1.REPORT_CRON.SCHEDULE_SWEEP, () => this.schedule.sweep(new Date()));
    }
    async reconcile() {
        if (process.env.NODE_ENV === 'test')
            return;
        await this.run(scheduling_constants_1.REPORT_CRON.RECONCILE, () => this.reconcileService.reconcile(new Date()));
    }
    async retentionCleanup() {
        if (process.env.NODE_ENV === 'test')
            return;
        await this.run(scheduling_constants_1.REPORT_CRON.RETENTION, () => this.retention.cleanup(new Date()));
    }
    async run(jobName, fn) {
        try {
            const outcome = await this.lock.runExclusive(jobName, async () => {
                try {
                    return { ok: true, counts: await fn() };
                }
                catch (err) {
                    this.log.error('Report cron job failed', err, { job: jobName });
                    return { ok: false };
                }
            });
            if (!outcome.acquired) {
                this.log.info('Report cron skipped: lock held elsewhere', {
                    job: jobName,
                });
                return false;
            }
            return true;
        }
        catch (err) {
            this.log.error('Report cron lock failure', err, { job: jobName });
            return false;
        }
    }
};
exports.ReportSchedulerCron = ReportSchedulerCron;
__decorate([
    (0, schedule_1.Cron)('5 * * * *', { name: scheduling_constants_1.REPORT_CRON.SCHEDULE_SWEEP }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportSchedulerCron.prototype, "scheduleSweep", null);
__decorate([
    (0, schedule_1.Cron)('*/5 * * * *', { name: scheduling_constants_1.REPORT_CRON.RECONCILE }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportSchedulerCron.prototype, "reconcile", null);
__decorate([
    (0, schedule_1.Cron)('35 * * * *', { name: scheduling_constants_1.REPORT_CRON.RETENTION }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportSchedulerCron.prototype, "retentionCleanup", null);
exports.ReportSchedulerCron = ReportSchedulerCron = ReportSchedulerCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(report_job_lock_1.REPORT_JOB_LOCK)),
    __metadata("design:paramtypes", [report_schedule_service_1.ReportScheduleService,
        report_reconcile_service_1.ReportReconcileService,
        report_retention_service_1.ReportRetentionService, Object, logger_service_1.LoggerService])
], ReportSchedulerCron);
//# sourceMappingURL=report-scheduler.cron.js.map