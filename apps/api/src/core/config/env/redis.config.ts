// src/config/env/redis.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const redisConfig = registerAs('redis', () => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  database: env.REDIS_DATABASE,
  tlsEnabled: env.REDIS_TLS_ENABLED,
  url: buildRedisUrl(),
}));

function buildRedisUrl(): string {
  const protocol = env.REDIS_TLS_ENABLED ? 'rediss' : 'redis';
  const credentials = [env.REDIS_USERNAME, env.REDIS_PASSWORD]
    .filter((value): value is string => Boolean(value))
    .map(encodeURIComponent)
    .join(':');
  const auth = credentials ? `${credentials}@` : '';

  return `${protocol}://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DATABASE}`;
}
