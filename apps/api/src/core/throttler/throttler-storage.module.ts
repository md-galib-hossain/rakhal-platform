import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Supplies the `storage` for `ThrottlerModule.forRootAsync`.
 *
 * Deliberately *not* `@Global()` — only `AppModule`'s throttler factory needs
 * it. `REDIS_CLIENT` resolves without importing `RedisModule` here because that
 * module is `@Global`; `LoggerModule` is imported for the transient
 * `LoggerService`, matching how `CacheModule` wires the same pair.
 */
@Module({
  imports: [LoggerModule],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
