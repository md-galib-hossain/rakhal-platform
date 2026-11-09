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
var SendVerificationEmailUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendVerificationEmailUseCase = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const env_1 = require("src/core/config/env");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const email_verification_token_port_1 = require("src/modules/auth/application/ports/email-verification-token.port");
const email_template_enum_1 = require("../../domain/enums/email-template.enum");
const queue_email_use_case_1 = require("./queue-email.use-case");
let SendVerificationEmailUseCase = SendVerificationEmailUseCase_1 = class SendVerificationEmailUseCase {
    config;
    emailVerificationTokenPort;
    queueEmailUseCase;
    log;
    constructor(config, emailVerificationTokenPort, queueEmailUseCase, logger) {
        this.config = config;
        this.emailVerificationTokenPort = emailVerificationTokenPort;
        this.queueEmailUseCase = queueEmailUseCase;
        this.log = logger.setContext(SendVerificationEmailUseCase_1.name);
    }
    async execute(input) {
        const verificationToken = (0, crypto_1.randomUUID)().replaceAll('-', '') + (0, crypto_1.randomUUID)().replaceAll('-', '');
        await this.emailVerificationTokenPort.createEmailVerificationToken({
            userId: input.userId,
            token: verificationToken,
            expiresAt: new Date(Date.now() + this.config.verificationTokenTtlMinutes * 60 * 1000),
        });
        const verificationLink = `${this.config.verificationBaseUrl}?token=${verificationToken}`;
        const emailId = (0, crypto_1.randomUUID)();
        await this.queueEmailUseCase.execute({
            emailId,
            to: input.email,
            subject: 'Verify your email address',
            template: email_template_enum_1.EmailTemplate.EMAIL_VERIFICATION,
            templateData: {
                name: input.name,
                verificationLink,
            },
            tenantId: input.tenantId,
            farmId: input.farmId,
            userId: input.userId,
            correlationId: input.correlationId,
        });
        this.log.audit('email.verification.sent', {
            emailId,
            userId: input.userId,
            tenantId: input.tenantId,
            farmId: input.farmId,
            correlationId: input.correlationId,
            timestamp: new Date().toISOString(),
            tokenType: client_1.TokenType.EMAIL_VERIFICATION,
        });
    }
};
exports.SendVerificationEmailUseCase = SendVerificationEmailUseCase;
exports.SendVerificationEmailUseCase = SendVerificationEmailUseCase = SendVerificationEmailUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.emailConfig.KEY)),
    __param(1, (0, common_1.Inject)(email_verification_token_port_1.EMAIL_VERIFICATION_TOKEN_PORT)),
    __metadata("design:paramtypes", [void 0, Object, queue_email_use_case_1.QueueEmailUseCase,
        logger_service_1.LoggerService])
], SendVerificationEmailUseCase);
//# sourceMappingURL=send-verification-email.use-case.js.map