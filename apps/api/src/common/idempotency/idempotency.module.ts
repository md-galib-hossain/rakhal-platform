import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { IdempotencyService } from './application/idempotency.service';

/**
 * Per-route `Idempotency-Key` handling for offline-queued writes (WP8a, ADR-006). `@Global()` + exported, like
 * `OutboxModule`, so a controller or the daily scheduler injects `IdempotencyService` without an import.
 */
@Global()
@Module({
  imports: [LoggerModule, PrismaModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
