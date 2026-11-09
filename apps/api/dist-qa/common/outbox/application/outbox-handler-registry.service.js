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
var OutboxHandlerRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxHandlerRegistryService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const domain_event_bus_service_1 = require("src/common/events/domain-event-bus.service");
let OutboxHandlerRegistryService = OutboxHandlerRegistryService_1 = class OutboxHandlerRegistryService {
    eventBus;
    handlers = new Map();
    log;
    constructor(eventBus, logger) {
        this.eventBus = eventBus;
        this.log = logger.setContext(OutboxHandlerRegistryService_1.name);
    }
    register(eventType, handler) {
        if (this.handlers.has(eventType)) {
            this.log.warn('Overwriting existing outbox handler', { eventType });
        }
        this.handlers.set(eventType, handler);
    }
    async dispatch(eventType, payload) {
        const handler = this.handlers.get(eventType);
        if (handler) {
            await handler(payload);
            return;
        }
        this.eventBus.emit(eventType, payload);
    }
};
exports.OutboxHandlerRegistryService = OutboxHandlerRegistryService;
exports.OutboxHandlerRegistryService = OutboxHandlerRegistryService = OutboxHandlerRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [domain_event_bus_service_1.DomainEventBusService,
        logger_service_1.LoggerService])
], OutboxHandlerRegistryService);
//# sourceMappingURL=outbox-handler-registry.service.js.map