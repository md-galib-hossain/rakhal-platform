import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { CacheService } from './cache.service';

/**
 * Global cache module exposing {@link CacheService} over the shared Redis client.
 *
 * Because it is `@Global`, no module needs to import it — just inject
 * `CacheService`. Relies on the (already global) `RedisModule` for `REDIS_CLIENT`.
 */
@Global()
@Module({
  imports: [LoggerModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
