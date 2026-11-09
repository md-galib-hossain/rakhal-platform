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
var OutboxProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const outbox_drain_service_1 = require("../../application/outbox-drain.service");
const outbox_queue_constants_1 = require("./outbox.queue.constants");
let OutboxProcessor = OutboxProcessor_1 = class OutboxProcessor extends bullmq_1.WorkerHost {
    drainService;
    log;
    constructor(drainService, logger) {
        super();
        this.drainService = drainService;
        this.log = logger.setContext(OutboxProcessor_1.name);
    }
    async process(job) {
        const result = await this.drainService.drainBatch();
        if (result.claimed > 0) {
            this.log.info('Outbox drain pass complete', {
                queueJobId: job.id,
                ...result,
            });
        }
    }
};
exports.OutboxProcessor = OutboxProcessor;
exports.OutboxProcessor = OutboxProcessor = OutboxProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(outbox_queue_constants_1.OUTBOX_QUEUE),
    __metadata("design:paramtypes", [outbox_drain_service_1.OutboxDrainService,
        logger_service_1.LoggerService])
], OutboxProcessor);
//# sourceMappingURL=outbox.processor.js.map