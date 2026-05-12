// src/config/env/env.schema.ts

import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().default(5000),

  APP_NAME: z.string().default('rakhal-api'),

  API_PREFIX: z.string().default('api/v1'),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_REFRESH_SECRET: z.string().min(32),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  REDIS_HOST: z.string(),

  REDIS_PORT: z.coerce.number(),

  REDIS_PASSWORD: z.string().optional(),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;
