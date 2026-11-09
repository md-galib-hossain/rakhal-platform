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
var QueueEmailUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEmailUseCase = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const email_queue_constants_1 = require("../../infrastructure/queue/email.queue.constants");
const email_repository_1 = require("src/modules/email/domain/repositories/email.repository");
let QueueEmailUseCase = QueueEmailUseCase_1 = class QueueEmailUseCase {
    queue;
    repository;
    log;
    constructor(queue, repository, logger) {
        this.queue = queue;
        this.repository = repository;
        this.log = logger.setContext(QueueEmailUseCase_1.name);
    }
    async execute(input) {
        await this.repository.create({
            id: input.emailId,
            to: input.to,
            subject: input.subject,
            template: input.template,
            tenantId: input.tenantId,
            farmId: input.farmId,
            userId: input.userId,
            correlationId: input.correlationId,
            scheduledAt: input.sendAt,
            idempotencyKey: input.idempotencyKey,
        });
        await this.queue.add(email_queue_constants_1.EMAIL_JOB, input, {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            delay: input.sendAt
                ? Math.max(input.sendAt.getTime() - Date.now(), 0)
                : undefined,
            jobId: input.emailId,
            removeOnComplete: 1000,
            removeOnFail: 1000,
        });
        this.log.info('Email queued for sending', {
            emailId: input.emailId,
            userId: input.userId,
            tenantId: input.tenantId,
            farmId: input.farmId,
            correlationId: input.correlationId,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.QueueEmailUseCase = QueueEmailUseCase;
exports.QueueEmailUseCase = QueueEmailUseCase = QueueEmailUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(email_queue_constants_1.EMAIL_QUEUE)),
    __param(1, (0, common_1.Inject)(email_repository_1.EMAIL_REPOSITORY)),
    __metadata("design:paramtypes", [bullmq_2.Queue, Object, logger_service_1.LoggerService])
], QueueEmailUseCase);
//# sourceMappingURL=queue-email.use-case.js.map