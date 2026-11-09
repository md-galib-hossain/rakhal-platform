"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const prisma_module_1 = require("src/core/database/prisma/prisma.module");
const domain_events_module_1 = require("src/common/events/domain-events.module");
const outbox_writer_service_1 = require("./application/outbox-writer.service");
const outbox_handler_registry_service_1 = require("./application/outbox-handler-registry.service");
const outbox_drain_service_1 = require("./application/outbox-drain.service");
const outbox_queue_service_1 = require("./infrastructure/queue/outbox-queue.service");
const outbox_processor_1 = require("./infrastructure/queue/outbox.processor");
const outbox_queue_constants_1 = require("./infrastructure/queue/outbox.queue.constants");
let OutboxModule = class OutboxModule {
};
exports.OutboxModule = OutboxModule;
exports.OutboxModule = OutboxModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            prisma_module_1.PrismaModule,
            domain_events_module_1.DomainEventsModule,
            config_1.ConfigModule.forFeature(env_1.redisConfig),
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule.forFeature(env_1.redisConfig)],
                inject: [env_1.redisConfig.KEY],
                useFactory: (config) => ({
                    prefix: process.env.NODE_ENV === 'test' ? 'bull-test' : undefined,
                    connection: {
                        host: config.host,
                        port: config.port,
                        username: config.username,
                        password: config.password,
                        db: config.database,
                        tls: config.tlsEnabled ? {} : undefined,
                        connectTimeout: config.connectTimeoutMs,
                        maxRetriesPerRequest: null,
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({ name: outbox_queue_constants_1.OUTBOX_QUEUE }),
        ],
        providers: [
            outbox_writer_service_1.OutboxWriterService,
            outbox_handler_registry_service_1.OutboxHandlerRegistryService,
            outbox_drain_service_1.OutboxDrainService,
            outbox_queue_service_1.OutboxQueueService,
            outbox_processor_1.OutboxProcessor,
        ],
        exports: [
            outbox_writer_service_1.OutboxWriterService,
            outbox_handler_registry_service_1.OutboxHandlerRegistryService,
            outbox_drain_service_1.OutboxDrainService,
        ],
    })
], OutboxModule);
//# sourceMappingURL=outbox.module.js.map