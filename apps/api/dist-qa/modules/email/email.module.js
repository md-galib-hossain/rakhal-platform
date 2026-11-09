"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const prisma_module_1 = require("src/core/database/prisma/prisma.module");
const email_verification_token_port_1 = require("../auth/application/ports/email-verification-token.port");
const auth_repository_1 = require("../auth/infrastructure/persistence/repositories/auth.repository");
const queue_email_use_case_1 = require("./application/use-cases/queue-email.use-case");
const send_password_reset_email_use_case_1 = require("./application/use-cases/send-password-reset-email.use-case");
const send_verification_email_use_case_1 = require("./application/use-cases/send-verification-email.use-case");
const email_service_1 = require("./application/services/email.service");
const transactional_email_service_1 = require("./application/services/transactional-email.service");
const email_repository_1 = require("./domain/repositories/email.repository");
const prisma_email_repository_1 = require("./infrastructure/persistence/repositories/prisma-email.repository");
const pdf_generator_service_1 = require("./infrastructure/pdf/pdf-generator.service");
const email_provider_factory_1 = require("./infrastructure/providers/email-provider.factory");
const resend_email_provider_1 = require("./infrastructure/providers/resend-email.provider");
const smtp_email_provider_1 = require("./infrastructure/providers/smtp-email.provider");
const email_processor_1 = require("./infrastructure/queue/email.processor");
const email_queue_constants_1 = require("./infrastructure/queue/email.queue.constants");
const email_template_service_1 = require("./infrastructure/templates/email-template.service");
const password_reset_requested_listener_1 = require("./presentation/listeners/password-reset-requested.listener");
const user_registered_listener_1 = require("./presentation/listeners/user-registered.listener");
let EmailModule = class EmailModule {
};
exports.EmailModule = EmailModule;
exports.EmailModule = EmailModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forFeature(env_1.redisConfig),
            config_1.ConfigModule.forFeature(env_1.emailConfig),
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
            bullmq_1.BullModule.registerQueue({ name: email_queue_constants_1.EMAIL_QUEUE }),
            logger_module_1.LoggerModule,
            prisma_module_1.PrismaModule,
        ],
        providers: [
            auth_repository_1.AuthRepository,
            {
                provide: email_verification_token_port_1.EMAIL_VERIFICATION_TOKEN_PORT,
                useExisting: auth_repository_1.AuthRepository,
            },
            prisma_email_repository_1.PrismaEmailRepository,
            {
                provide: email_repository_1.EMAIL_REPOSITORY,
                useExisting: prisma_email_repository_1.PrismaEmailRepository,
            },
            queue_email_use_case_1.QueueEmailUseCase,
            send_password_reset_email_use_case_1.SendPasswordResetEmailUseCase,
            send_verification_email_use_case_1.SendVerificationEmailUseCase,
            email_service_1.EmailService,
            transactional_email_service_1.TransactionalEmailService,
            email_template_service_1.EmailTemplateService,
            pdf_generator_service_1.PdfGeneratorService,
            resend_email_provider_1.ResendEmailProvider,
            smtp_email_provider_1.SmtpEmailProvider,
            email_provider_factory_1.EmailProviderFactory,
            email_processor_1.EmailProcessor,
            user_registered_listener_1.UserRegisteredListener,
            password_reset_requested_listener_1.PasswordResetRequestedListener,
        ],
        exports: [
            queue_email_use_case_1.QueueEmailUseCase,
            send_verification_email_use_case_1.SendVerificationEmailUseCase,
            send_password_reset_email_use_case_1.SendPasswordResetEmailUseCase,
            email_service_1.EmailService,
            transactional_email_service_1.TransactionalEmailService,
        ],
    })
], EmailModule);
//# sourceMappingURL=email.module.js.map