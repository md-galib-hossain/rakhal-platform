// src/config/env/auth.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const authConfig = registerAs('auth', () => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,

  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,

  argon2MemoryCost: env.ARGON2_MEMORY_COST,
  argon2TimeCost: env.ARGON2_TIME_COST,
  argon2Parallelism: env.ARGON2_PARALLELISM,
}));
