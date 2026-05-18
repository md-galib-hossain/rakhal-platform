import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
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

class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  async onApplicationShutdown() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig), LoggerModule],
  providers: [redisClientProvider, RedisShutdown],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
