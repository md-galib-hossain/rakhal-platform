// src/config/env/logging.config.ts
import { registerAs } from '@nestjs/config';
import { env } from './env';

export const loggingConfig = registerAs('logging', () => ({
  level: env.LOG_LEVEL,
  format: env.LOG_FORMAT,
  requestLogging: env.ENABLE_REQUEST_LOGGING,
  dbLogging: env.ENABLE_DB_LOGGING,
  httpLogging: env.ENABLE_HTTP_LOGGING,
}));
