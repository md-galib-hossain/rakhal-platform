import {
  Global,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { createClient } from 'redis';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { redisConfig } from '../config/env';
import { REDIS_CLIENT } from './redis.constants';

export type RedisClient = ReturnType<typeof createClient>;

const redisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [redisConfig.KEY, LoggerService],
  useFactory: (
    config: ConfigType<typeof redisConfig>,
    logger: LoggerService,
  ): RedisClient => {
    const log = logger.setContext('RedisModule');
    const client = createClient({
      url: config.url,
      socket: {
        connectTimeout: config.connectTimeoutMs,
      },
    });

    client.on('error', (error) => {
      log.error('Redis client error', error, {
        host: config.host,
        port: config.port,
        tlsEnabled: config.tlsEnabled,
      });
    });

    return client;
  },
};

/**
 * RD-028 — node-redis v4 requires an explicit `.connect()`; nothing called it at boot, so every
 * `CacheService` consumer silently no-op'd (its try/catch swallows the "client is closed" error)
 * until `HealthController`'s on-demand `if (!isOpen) connect()` happened to run first. Connecting
 * once here, at module init, means the shared client is live before any request can reach it —
 * a failed initial connect is logged, not fatal (the client's default reconnect strategy keeps
 * retrying in the background, and `CacheService` already degrades gracefully while still down).
 */
class RedisBootstrap implements OnModuleInit, OnApplicationShutdown {
  private readonly log: LoggerService;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient,
    logger: LoggerService,
  ) {
    this.log = logger.setContext('RedisBootstrap');
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.log.error(
        'Initial Redis connect failed — will retry in background',
        error,
      );
    }
  }

  async onApplicationShutdown() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig), LoggerModule],
  providers: [redisClientProvider, RedisBootstrap],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
