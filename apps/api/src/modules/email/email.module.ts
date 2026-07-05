import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { emailConfig, redisConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { EMAIL_VERIFICATION_TOKEN_PORT } from '../auth/application/ports/email-verification-token.port';
import { AuthRepository } from '../auth/infrastructure/persistence/repositories/auth.repository';
import { QueueEmailUseCase } from './application/use-cases/queue-email.use-case';
import { SendPasswordResetEmailUseCase } from './application/use-cases/send-password-reset-email.use-case';
import { SendVerificationEmailUseCase } from './application/use-cases/send-verification-email.use-case';
import { EmailService } from './application/services/email.service';
import { TransactionalEmailService } from './application/services/transactional-email.service';
import { EMAIL_REPOSITORY } from './domain/repositories/email.repository';
import { PrismaEmailRepository } from './infrastructure/persistence/repositories/prisma-email.repository';
import { PdfGeneratorService } from './infrastructure/pdf/pdf-generator.service';
import { EmailProviderFactory } from './infrastructure/providers/email-provider.factory';
import { ResendEmailProvider } from './infrastructure/providers/resend-email.provider';
import { SmtpEmailProvider } from './infrastructure/providers/smtp-email.provider';
import { EmailProcessor } from './infrastructure/queue/email.processor';
import { EMAIL_QUEUE } from './infrastructure/queue/email.queue.constants';
import { EmailTemplateService } from './infrastructure/templates/email-template.service';
import { PasswordResetRequestedListener } from './presentation/listeners/password-reset-requested.listener';
import { UserRegisteredListener } from './presentation/listeners/user-registered.listener';

@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    ConfigModule.forFeature(emailConfig),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
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
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    LoggerModule,
    PrismaModule,
  ],
  providers: [
    AuthRepository,
    {
      provide: EMAIL_VERIFICATION_TOKEN_PORT,
      useExisting: AuthRepository,
    },
    PrismaEmailRepository,
    {
      provide: EMAIL_REPOSITORY,
      useExisting: PrismaEmailRepository,
    },
    QueueEmailUseCase,
    SendPasswordResetEmailUseCase,
    SendVerificationEmailUseCase,
    EmailService,
    TransactionalEmailService,
    EmailTemplateService,
    PdfGeneratorService,
    ResendEmailProvider,
    SmtpEmailProvider,
    EmailProviderFactory,
    EmailProcessor,
    UserRegisteredListener,
    PasswordResetRequestedListener,
  ],
  exports: [
    QueueEmailUseCase,
    SendVerificationEmailUseCase,
    SendPasswordResetEmailUseCase,
    EmailService,
    TransactionalEmailService,
  ],
})
export class EmailModule {}
