import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { createClient } from 'redis';
import { redisConfig } from '../config/env';
import { REDIS_CLIENT } from './redis.constants';

export type RedisClient = ReturnType<typeof createClient>;

const redisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [redisConfig.KEY],
  useFactory: (config: ConfigType<typeof redisConfig>): RedisClient => {
    const client = createClient({
      url: config.url,
    });

    client.on('error', () => undefined);

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
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [redisClientProvider, RedisShutdown],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
