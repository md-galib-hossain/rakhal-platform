// src/config/env/redis.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const redisConfig = registerAs('redis', () => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
}));
