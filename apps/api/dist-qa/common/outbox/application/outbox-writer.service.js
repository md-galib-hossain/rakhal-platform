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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWriterService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const outbox_queue_constants_1 = require("../infrastructure/queue/outbox.queue.constants");
let OutboxWriterService = class OutboxWriterService {
    prisma;
    queue;
    constructor(prisma, queue) {
        this.prisma = prisma;
        this.queue = queue;
    }
    async write(input, db = this.prisma) {
        const row = await db.outboxEvent.upsert({
            where: {
                farmId_idempotencyKey: {
                    farmId: input.farmId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
            create: {
                farmId: input.farmId,
                eventType: input.eventType,
                payload: input.payload,
                idempotencyKey: input.idempotencyKey,
            },
            update: {},
        });
        this.nudgeDrain();
        return row;
    }
    nudgeDrain() {
        this.queue
            ?.add(outbox_queue_constants_1.OUTBOX_NUDGE_JOB, {}, {
            jobId: outbox_queue_constants_1.OUTBOX_NUDGE_JOB,
            delay: outbox_queue_constants_1.OUTBOX_NUDGE_DELAY_MS,
            removeOnComplete: true,
            removeOnFail: true,
        })
            .catch(() => undefined);
    }
};
exports.OutboxWriterService = OutboxWriterService;
exports.OutboxWriterService = OutboxWriterService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, bullmq_1.InjectQueue)(outbox_queue_constants_1.OUTBOX_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], OutboxWriterService);
//# sourceMappingURL=outbox-writer.service.js.map