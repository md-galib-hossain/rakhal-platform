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
var SendPasswordResetEmailUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendPasswordResetEmailUseCase = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const env_1 = require("src/core/config/env");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const email_template_enum_1 = require("../../domain/enums/email-template.enum");
const queue_email_use_case_1 = require("./queue-email.use-case");
let SendPasswordResetEmailUseCase = SendPasswordResetEmailUseCase_1 = class SendPasswordResetEmailUseCase {
    config;
    queueEmailUseCase;
    log;
    constructor(config, queueEmailUseCase, logger) {
        this.config = config;
        this.queueEmailUseCase = queueEmailUseCase;
        this.log = logger.setContext(SendPasswordResetEmailUseCase_1.name);
    }
    async execute(input) {
        const emailId = (0, crypto_1.randomUUID)();
        const resetLink = `${this.config.passwordResetBaseUrl}?token=${input.token}`;
        await this.queueEmailUseCase.execute({
            emailId,
            to: input.email,
            subject: 'Reset your password',
            template: email_template_enum_1.EmailTemplate.PASSWORD_RESET,
            templateData: {
                name: input.name,
                resetLink,
            },
            tenantId: input.tenantId,
            farmId: input.farmId,
            userId: input.userId,
            correlationId: input.correlationId,
        });
        this.log.audit('email.password_reset.sent', {
            emailId,
            userId: input.userId,
            tenantId: input.tenantId,
            farmId: input.farmId,
            correlationId: input.correlationId,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.SendPasswordResetEmailUseCase = SendPasswordResetEmailUseCase;
exports.SendPasswordResetEmailUseCase = SendPasswordResetEmailUseCase = SendPasswordResetEmailUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.emailConfig.KEY)),
    __metadata("design:paramtypes", [void 0, queue_email_use_case_1.QueueEmailUseCase,
        logger_service_1.LoggerService])
], SendPasswordResetEmailUseCase);
//# sourceMappingURL=send-password-reset-email.use-case.js.map