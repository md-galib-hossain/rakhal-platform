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
var OutboxQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxQueueService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const outbox_queue_constants_1 = require("./outbox.queue.constants");
let OutboxQueueService = OutboxQueueService_1 = class OutboxQueueService {
    queue;
    log;
    constructor(queue, logger) {
        this.queue = queue;
        this.log = logger.setContext(OutboxQueueService_1.name);
    }
    async onModuleInit() {
        const existing = await this.queue.getRepeatableJobs();
        for (const job of existing) {
            if (job.name === outbox_queue_constants_1.OUTBOX_DRAIN_JOB &&
                job.every !== String(outbox_queue_constants_1.OUTBOX_DRAIN_INTERVAL_MS)) {
                await this.queue.removeRepeatableByKey(job.key);
            }
        }
        await this.queue.add(outbox_queue_constants_1.OUTBOX_DRAIN_JOB, {}, {
            jobId: outbox_queue_constants_1.OUTBOX_DRAIN_JOB,
            repeat: { every: outbox_queue_constants_1.OUTBOX_DRAIN_INTERVAL_MS },
            removeOnComplete: 100,
            removeOnFail: 100,
        });
        this.log.info('Outbox drain job scheduled', {
            intervalMs: outbox_queue_constants_1.OUTBOX_DRAIN_INTERVAL_MS,
        });
    }
    async triggerNow() {
        await this.queue.add(outbox_queue_constants_1.OUTBOX_DRAIN_JOB, {}, { removeOnComplete: 100, removeOnFail: 100 });
    }
};
exports.OutboxQueueService = OutboxQueueService;
exports.OutboxQueueService = OutboxQueueService = OutboxQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(outbox_queue_constants_1.OUTBOX_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        logger_service_1.LoggerService])
], OutboxQueueService);
//# sourceMappingURL=outbox-queue.service.js.map