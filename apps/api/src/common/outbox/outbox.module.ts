import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { redisConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { DomainEventsModule } from 'src/common/events/domain-events.module';
import { OutboxWriterService } from './application/outbox-writer.service';
import { OutboxHandlerRegistryService } from './application/outbox-handler-registry.service';
import { OutboxDrainService } from './application/outbox-drain.service';
import { OutboxQueueService } from './infrastructure/queue/outbox-queue.service';
import { OutboxProcessor } from './infrastructure/queue/outbox.processor';
import { OUTBOX_QUEUE } from './infrastructure/queue/outbox.queue.constants';

/**
 * Durable transactional outbox (RAKHAL-332, repays RD-014). `@Global()` +
 * exported so any module can inject `OutboxWriterService` to write a row
 * inside its own `$transaction`, or `OutboxHandlerRegistryService` to receive
 * dispatched events — mirrors `PrismaModule`/`DomainEventsModule`'s own
 * global registration, since this is exactly that class of cross-cutting
 * primitive.
 */
@Global()
@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    DomainEventsModule,
    ConfigModule.forFeature(redisConfig),
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        // Keep e2e runs off a developer's live queue (see reports.module.ts).
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
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
  ],
  providers: [
    OutboxWriterService,
    OutboxHandlerRegistryService,
    OutboxDrainService,
    OutboxQueueService,
    OutboxProcessor,
  ],
  exports: [
    OutboxWriterService,
    OutboxHandlerRegistryService,
    OutboxDrainService,
  ],
})
export class OutboxModule {}
