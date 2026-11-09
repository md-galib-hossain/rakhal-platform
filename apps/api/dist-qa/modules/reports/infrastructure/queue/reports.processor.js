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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const report_generation_service_1 = require("../../application/pipeline/report-generation.service");
const report_pipeline_constants_1 = require("../../application/pipeline/report-pipeline.constants");
let ReportsProcessor = class ReportsProcessor extends bullmq_1.WorkerHost {
    generation;
    constructor(generation) {
        super();
        this.generation = generation;
    }
    async process(job, token) {
        const outcome = await this.generation.process(job.data.reportId, {
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts.attempts ?? report_pipeline_constants_1.REPORT_JOB_ATTEMPTS,
        });
        switch (outcome.status) {
            case 'delayed':
                await job.moveToDelayed(Date.now() + outcome.delayMs, token);
                throw new bullmq_2.DelayedError();
            case 'retry':
                throw new Error(`report_transient:${outcome.category}`);
            case 'failed':
                throw new bullmq_2.UnrecoverableError(`report_failed:${outcome.category}`);
            default:
                return;
        }
    }
};
exports.ReportsProcessor = ReportsProcessor;
exports.ReportsProcessor = ReportsProcessor = __decorate([
    (0, bullmq_1.Processor)(report_pipeline_constants_1.REPORTS_QUEUE, { concurrency: report_pipeline_constants_1.REPORT_WORKER_CONCURRENCY }),
    __metadata("design:paramtypes", [report_generation_service_1.ReportGenerationService])
], ReportsProcessor);
//# sourceMappingURL=reports.processor.js.map