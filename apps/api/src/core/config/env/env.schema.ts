// src/config/env/env.schema.ts

import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().default(5000),

  APP_NAME: z.string().default('rakhal-api'),
  APP_VERSION: z.string().default('1.0.0'),

  API_PREFIX: z.string().default('api/v1'),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  REDIS_HOST: z.string(),

  REDIS_PORT: z.coerce.number(),

  REDIS_PASSWORD: z.string().optional(),

  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),

  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),

  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  // Logging configuration
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),

  ENABLE_DB_LOGGING: z.coerce.boolean().default(false),

  ENABLE_HTTP_LOGGING: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;
