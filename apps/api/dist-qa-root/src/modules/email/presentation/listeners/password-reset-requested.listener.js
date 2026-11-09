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
var PasswordResetRequestedListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetRequestedListener = void 0;
const common_1 = require("@nestjs/common");
const domain_event_bus_service_1 = require("src/common/events/domain-event-bus.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const password_reset_requested_event_1 = require("src/modules/auth/domain/events/password-reset-requested.event");
const send_password_reset_email_use_case_1 = require("../../application/use-cases/send-password-reset-email.use-case");
let PasswordResetRequestedListener = PasswordResetRequestedListener_1 = class PasswordResetRequestedListener {
    eventBus;
    sendPasswordResetEmail;
    log;
    constructor(eventBus, sendPasswordResetEmail, logger) {
        this.eventBus = eventBus;
        this.sendPasswordResetEmail = sendPasswordResetEmail;
        this.log = logger.setContext(PasswordResetRequestedListener_1.name);
    }
    onModuleInit() {
        this.eventBus.on(password_reset_requested_event_1.PASSWORD_RESET_REQUESTED_EVENT, this.handlePasswordResetRequested);
    }
    onModuleDestroy() {
        this.eventBus.off(password_reset_requested_event_1.PASSWORD_RESET_REQUESTED_EVENT, this.handlePasswordResetRequested);
    }
    handlePasswordResetRequested = async (event) => {
        await this.sendPasswordResetEmail.execute({
            userId: event.userId,
            email: event.email,
            name: event.name,
            token: event.token,
            tenantId: event.tenantId,
            farmId: event.farmId,
            correlationId: event.correlationId,
        });
        this.log.info('Password reset email queued', {
            userId: event.userId,
            tenantId: event.tenantId,
            farmId: event.farmId,
            correlationId: event.correlationId,
            timestamp: new Date().toISOString(),
        });
    };
};
exports.PasswordResetRequestedListener = PasswordResetRequestedListener;
exports.PasswordResetRequestedListener = PasswordResetRequestedListener = PasswordResetRequestedListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [domain_event_bus_service_1.DomainEventBusService,
        send_password_reset_email_use_case_1.SendPasswordResetEmailUseCase,
        logger_service_1.LoggerService])
], PasswordResetRequestedListener);
//# sourceMappingURL=password-reset-requested.listener.js.map