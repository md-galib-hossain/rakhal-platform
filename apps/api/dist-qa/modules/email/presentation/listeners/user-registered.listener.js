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
var UserRegisteredListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRegisteredListener = void 0;
const common_1 = require("@nestjs/common");
const domain_event_bus_service_1 = require("src/common/events/domain-event-bus.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const user_registered_event_1 = require("src/modules/auth/domain/events/user-registered.event");
const send_verification_email_use_case_1 = require("../../application/use-cases/send-verification-email.use-case");
let UserRegisteredListener = UserRegisteredListener_1 = class UserRegisteredListener {
    eventBus;
    sendVerificationEmail;
    log;
    constructor(eventBus, sendVerificationEmail, logger) {
        this.eventBus = eventBus;
        this.sendVerificationEmail = sendVerificationEmail;
        this.log = logger.setContext(UserRegisteredListener_1.name);
    }
    onModuleInit() {
        this.eventBus.on(user_registered_event_1.USER_REGISTERED_EVENT, this.handleUserRegistered);
    }
    onModuleDestroy() {
        this.eventBus.off(user_registered_event_1.USER_REGISTERED_EVENT, this.handleUserRegistered);
    }
    handleUserRegistered = async (event) => {
        await this.sendVerificationEmail.execute({
            userId: event.userId,
            email: event.email,
            name: event.name,
            tenantId: event.tenantId,
            farmId: event.farmId,
            correlationId: event.correlationId,
        });
        this.log.info('Verification email sent', {
            emailId: null,
            userId: event.userId,
            tenantId: event.tenantId,
            farmId: event.farmId,
            correlationId: event.correlationId,
            timestamp: new Date().toISOString(),
        });
    };
};
exports.UserRegisteredListener = UserRegisteredListener;
exports.UserRegisteredListener = UserRegisteredListener = UserRegisteredListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [domain_event_bus_service_1.DomainEventBusService,
        send_verification_email_use_case_1.SendVerificationEmailUseCase,
        logger_service_1.LoggerService])
], UserRegisteredListener);
//# sourceMappingURL=user-registered.listener.js.map