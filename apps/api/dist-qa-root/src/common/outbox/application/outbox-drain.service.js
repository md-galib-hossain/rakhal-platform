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
var OutboxDrainService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxDrainService = exports.OUTBOX_MAX_ATTEMPTS = exports.OUTBOX_DEFAULT_BATCH_SIZE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const outbox_handler_registry_service_1 = require("./outbox-handler-registry.service");
exports.OUTBOX_DEFAULT_BATCH_SIZE = 25;
exports.OUTBOX_MAX_ATTEMPTS = 5;
let OutboxDrainService = OutboxDrainService_1 = class OutboxDrainService {
    prisma;
    handlers;
    log;
    constructor(prisma, handlers, logger) {
        this.prisma = prisma;
        this.handlers = handlers;
        this.log = logger.setContext(OutboxDrainService_1.name);
    }
    async drainBatch(batchSize = exports.OUTBOX_DEFAULT_BATCH_SIZE, maxAttempts = exports.OUTBOX_MAX_ATTEMPTS) {
        const candidates = await this.prisma.outboxEvent.findMany({
            where: { status: client_1.OutboxEventStatus.PENDING },
            orderBy: { createdAt: 'asc' },
            take: batchSize,
        });
        const result = {
            claimed: 0,
            processed: 0,
            failed: 0,
            deadLettered: 0,
        };
        for (const candidate of candidates) {
            const claim = await this.prisma.outboxEvent.updateMany({
                where: { id: candidate.id, status: client_1.OutboxEventStatus.PENDING },
                data: {
                    status: client_1.OutboxEventStatus.PROCESSING,
                    attempts: { increment: 1 },
                },
            });
            if (claim.count === 0)
                continue;
            result.claimed += 1;
            const attemptsMade = candidate.attempts + 1;
            try {
                await this.handlers.dispatch(candidate.eventType, candidate.payload);
                await this.prisma.outboxEvent.update({
                    where: { id: candidate.id },
                    data: {
                        status: client_1.OutboxEventStatus.PROCESSED,
                        processedAt: new Date(),
                    },
                });
                result.processed += 1;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const deadLetter = attemptsMade >= maxAttempts;
                await this.prisma.outboxEvent.update({
                    where: { id: candidate.id },
                    data: {
                        status: deadLetter
                            ? client_1.OutboxEventStatus.FAILED
                            : client_1.OutboxEventStatus.PENDING,
                        lastError: message.slice(0, 2000),
                    },
                });
                if (deadLetter) {
                    this.log.error('Outbox event dead-lettered after max attempts', error, {
                        outboxEventId: candidate.id,
                        eventType: candidate.eventType,
                        attempts: attemptsMade,
                    });
                    result.deadLettered += 1;
                }
                else {
                    this.log.warn('Outbox event dispatch failed, will retry', {
                        outboxEventId: candidate.id,
                        eventType: candidate.eventType,
                        attempts: attemptsMade,
                        error: message,
                    });
                    result.failed += 1;
                }
            }
        }
        return result;
    }
};
exports.OutboxDrainService = OutboxDrainService;
exports.OutboxDrainService = OutboxDrainService = OutboxDrainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        outbox_handler_registry_service_1.OutboxHandlerRegistryService,
        logger_service_1.LoggerService])
], OutboxDrainService);
//# sourceMappingURL=outbox-drain.service.js.map