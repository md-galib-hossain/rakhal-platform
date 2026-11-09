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
var DomainEventBusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEventBusService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let DomainEventBusService = DomainEventBusService_1 = class DomainEventBusService {
    emitter = new events_1.EventEmitter();
    log;
    safeListeners = new WeakMap();
    constructor(logger) {
        this.log = logger.setContext(DomainEventBusService_1.name);
    }
    emit(event, payload) {
        this.emitter.emit(event, payload);
    }
    on(event, listener) {
        const safeListener = (payload) => {
            try {
                const result = listener(payload);
                if (result && typeof result.then === 'function') {
                    result.catch((error) => {
                        this.log.error(`Listener for "${event}" rejected`, error);
                    });
                }
            }
            catch (error) {
                this.log.error(`Listener for "${event}" threw`, error);
            }
        };
        this.safeListeners.set(listener, safeListener);
        this.emitter.on(event, safeListener);
    }
    off(event, listener) {
        const safeListener = this.safeListeners.get(listener);
        if (!safeListener)
            return;
        this.emitter.off(event, safeListener);
        this.safeListeners.delete(listener);
    }
    onModuleDestroy() {
        this.emitter.removeAllListeners();
    }
};
exports.DomainEventBusService = DomainEventBusService;
exports.DomainEventBusService = DomainEventBusService = DomainEventBusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], DomainEventBusService);
//# sourceMappingURL=domain-event-bus.service.js.map