// src/config/env/auth.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const authConfig = registerAs('auth', () => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,

  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,

  bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
}));
