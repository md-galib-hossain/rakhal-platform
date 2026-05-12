// src/config/env/database.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const databaseConfig = registerAs('database', () => ({
  url: env.DATABASE_URL,
}));
